/*
 * Faya-Studio runtime link.
 *
 * This file is injected into exported desktop applications. It keeps the local
 * SQLite database in sync with the platform (optional, opt-in per application)
 * and exposes FayaSync.emit() for outbound webhooks.
 *
 * Design goals:
 * - the app always works offline: it only touches SQLite locally;
 * - sync is best-effort: failures never block the UI;
 * - last-write-wins per row, with local change detection through a shadow
 *   table (_faya_sync_rows) so the generated app does not need to change its
 *   own persistence code.
 */
(function () {
  "use strict";

  var config = window.FAYA_CONFIG || {};
  var tauri = window.__TAURI__;
  var invoke = tauri && tauri.core ? tauri.core.invoke : null;

  if (!invoke || (!config.sync && !config.hooks) || !config.baseUrl) {
    return;
  }

  var BASE_URL = String(config.baseUrl).replace(/\/+$/, "");
  var SYNC_ENABLED = config.sync === true;
  var HOOKS_ENABLED = config.hooks === true;
  var LOCALE = config.locale === "en" ? "en" : "fr";
  var DEVICE_ID = getDeviceId();
  var DEVICE_NAME = config.deviceName || detectDeviceName();
  var APP_VERSION = config.appVersion || "1.0.0";
  var POLL_MS = 20000;
  var MAX_CYCLES = 20;
  var BATCH_SIZE = 200;
  var tablesCache = null;
  var columnsCache = {};
  var sqliteReady = false;

  var state = {
    status: SYNC_ENABLED ? "idle" : "hooks",
    running: false,
    lastSyncAt: null,
    lastError: null,
    pending: 0,
    updateAvailable: false,
    received: 0,
  };
  var listeners = [];

  /* ------------------------------------------------------------------ */
  /* Utilities                                                           */
  /* ------------------------------------------------------------------ */

  function getDeviceId() {
    try {
      var existing = localStorage.getItem("faya.deviceId");
      if (existing) return existing;
      var id =
        window.crypto && crypto.randomUUID
          ? crypto.randomUUID()
          : "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("faya.deviceId", id);
      return id;
    } catch {
      return "dev-" + Math.random().toString(36).slice(2);
    }
  }

  function detectDeviceName() {
    var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (/win/i.test(platform)) return "Poste Windows";
    if (/mac/i.test(platform)) return "Poste macOS";
    if (/linux/i.test(platform)) return "Poste Linux";
    return "Appareil";
  }

  function quoteIdentifier(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  function toDbValue(value) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  }

  function hashRow(row) {
    var text = JSON.stringify(row);
    var h1 = 0xdeadbeef;
    var h2 = 0x41c6ce57;

    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      h1 = Math.imul(h1 ^ code, 2654435761);
      h2 = Math.imul(h2 ^ code, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function normalizeTimestamp(value) {
    if (value === null || value === undefined || value === "") return null;

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value.toISOString();
    }

    var text = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/.test(text)) {
      return text.replace(" ", "T") + "Z";
    }

    if (/^\d+$/.test(text)) {
      var numeric = Number(text);
      var millis = numeric < 1e12 ? numeric * 1000 : numeric;
      if (millis > 1e11) {
        var fromEpoch = new Date(millis);
        if (!isNaN(fromEpoch.getTime())) return fromEpoch.toISOString();
      }
    }

    var parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  function isNumericType(type) {
    return /INT/i.test(type || "");
  }

  function coerceKey(value, column) {
    if (!column || !isNumericType(column.type)) return String(value);
    return /^-?\d+$/.test(String(value)) ? Number(value) : String(value);
  }

  function getColumns(table) {
    if (columnsCache[table]) return Promise.resolve(columnsCache[table]);

    return select("PRAGMA table_info(" + quoteIdentifier(table) + ")", []).then(
      function (rows) {
        columnsCache[table] = rows.map(function (row) {
          return {
            name: row.name,
            type: row.type,
            pk: Number(row.pk) || 0,
            notNull: Number(row.notnull) || 0,
          };
        });
        return columnsCache[table];
      },
    );
  }

  function pickKeyColumn(columns) {
    var byName = columns.filter(function (column) {
      return String(column.name).toLowerCase() === "id";
    })[0];
    if (byName) return byName;
    return columns.filter(function (column) {
      return column.pk > 0;
    })[0] || null;
  }

  function pickTimestampColumn(columns) {
    var candidates = ["updated_at", "updatedat", "modified_at", "modifiedat", "created_at", "createdat"];
    for (var index = 0; index < candidates.length; index += 1) {
      var match = columns.filter(function (column) {
        return String(column.name).toLowerCase() === candidates[index];
      })[0];
      if (match) return match;
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* SQLite access                                                       */
  /* ------------------------------------------------------------------ */

  function select(query, params) {
    return invoke("db_select", { query: query, params: params || [] });
  }

  function execute(query, params) {
    return invoke("db_execute", { query: query, params: params || [] });
  }

  function ensureInternalTables() {
    if (sqliteReady) return Promise.resolve();

    return execute(
      "CREATE TABLE IF NOT EXISTS _faya_sync_rows (table_name TEXT NOT NULL, row_key TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (table_name, row_key))",
      [],
    )
      .then(function () {
        return execute(
          "CREATE TABLE IF NOT EXISTS _faya_sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
          [],
        );
      })
      .then(function () {
        sqliteReady = true;
      });
  }

  function listTables() {
    if (tablesCache) return Promise.resolve(tablesCache);

    return select(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_faya_%'",
      [],
    ).then(function (rows) {
      tablesCache = rows.map(function (row) {
        return String(row.name);
      });
      return tablesCache;
    });
  }

  function loadCursor() {
    return select("SELECT value FROM _faya_sync_state WHERE key = 'cursor'", [])
      .then(function (rows) {
        return rows.length ? Number(rows[0].value) || 0 : 0;
      })
      .catch(function () {
        return 0;
      });
  }

  function saveCursor(cursor) {
    return execute(
      "INSERT INTO _faya_sync_state (key, value) VALUES ('cursor', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [String(cursor)],
    );
  }

  function loadShadow() {
    return select("SELECT table_name, row_key, hash FROM _faya_sync_rows", []).then(
      function (rows) {
        var map = Object.create(null);
        rows.forEach(function (row) {
          map[row.table_name + "\u0000" + row.row_key] = String(row.hash);
        });
        return map;
      },
    );
  }

  function writeShadow(shadow, tables) {
    var valid = Object.create(null);
    tables.forEach(function (table) {
      valid[table] = true;
    });

    var entries = [];
    Object.keys(shadow).forEach(function (key) {
      var separator = key.indexOf("\u0000");
      var table = key.slice(0, separator);
      if (!valid[table]) return;
      entries.push([table, key.slice(separator + 1), shadow[key]]);
    });

    return execute("DELETE FROM _faya_sync_rows", []).then(function () {
      var index = 0;

      function insertChunk() {
        if (index >= entries.length) return Promise.resolve();
        var chunk = entries.slice(index, index + 100);
        index += 100;
        var placeholders = chunk.map(function () {
          return "(?, ?, ?)";
        });
        var params = [];
        chunk.forEach(function (entry) {
          params.push(entry[0], entry[1], entry[2]);
        });

        return execute(
          "INSERT OR REPLACE INTO _faya_sync_rows (table_name, row_key, hash) VALUES " +
            placeholders.join(", "),
          params,
        ).then(insertChunk);
      }

      return insertChunk();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Platform API                                                        */
  /* ------------------------------------------------------------------ */

  function api(action, body) {
    return fetch(BASE_URL + "/api/sync/" + action, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + config.appKey,
      },
      body: JSON.stringify(
        Object.assign(
          {
            deviceId: DEVICE_ID,
            deviceName: DEVICE_NAME,
            platform: "windows",
            appVersion: APP_VERSION,
          },
          body || {},
        ),
      ),
      cache: "no-store",
    }).then(function (response) {
      if (!response.ok) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (payload) {
            var error = new Error(payload.error || "HTTP " + response.status);
            error.status = response.status;
            throw error;
          });
      }
      return response.json();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Local change detection                                              */
  /* ------------------------------------------------------------------ */

  function collectLocalChanges() {
    return listTables().then(function (tables) {
      return loadShadow().then(function (shadow) {
        var changes = [];
        var snapshot = Object.create(null);
        var chain = Promise.resolve();

        tables.forEach(function (table) {
          chain = chain.then(function () {
            return getColumns(table).then(function (columns) {
              var keyColumn = pickKeyColumn(columns);
              if (!keyColumn) return;
              var timestampColumn = pickTimestampColumn(columns);

              return select("SELECT * FROM " + quoteIdentifier(table), []).then(function (rows) {
                rows.forEach(function (row) {
                  var key = String(row[keyColumn.name]);
                  var shadowKey = table + "\u0000" + key;
                  var hash = hashRow(row);
                  snapshot[shadowKey] = hash;

                  if (shadow[shadowKey] === hash) return;

                  var existing = shadow[shadowKey] !== undefined;
                  var timestamp = timestampColumn
                    ? normalizeTimestamp(row[timestampColumn.name])
                    : null;

                  changes.push({
                    table: table,
                    id: key,
                    deleted: false,
                    data: row,
                    updatedAt: existing
                      ? new Date().toISOString()
                      : timestamp || new Date().toISOString(),
                    shadowKey: shadowKey,
                  });
                });
              });
            });
          });
        });

        return chain.then(function () {
          var tablesByName = Object.create(null);
          tables.forEach(function (table) {
            tablesByName[table] = true;
          });

          Object.keys(shadow).forEach(function (shadowKey) {
            if (snapshot[shadowKey] !== undefined) return;
            var separator = shadowKey.indexOf("\u0000");
            var table = shadowKey.slice(0, separator);
            if (!tablesByName[table]) return;

            changes.push({
              table: table,
              id: shadowKey.slice(separator + 1),
              deleted: true,
              data: null,
              updatedAt: new Date().toISOString(),
              shadowKey: shadowKey,
            });
          });

          return { tables: tables, changes: changes, shadow: snapshot };
        });
      });
    });
  }

  function applyRemoteChange(change, tables) {
    if (tables.indexOf(change.table) === -1) return Promise.resolve(false);

    return getColumns(change.table).then(function (columns) {
      var keyColumn = pickKeyColumn(columns);
      if (!keyColumn) return false;

      var key = coerceKey(change.id, keyColumn);

      if (change.deleted) {
        return execute(
          "DELETE FROM " + quoteIdentifier(change.table) + " WHERE " + quoteIdentifier(keyColumn.name) + " = ?",
          [key],
        ).then(function () {
          return true;
        });
      }

      var data = change.data && typeof change.data === "object" ? change.data : {};
      var available = Object.create(null);
      columns.forEach(function (column) {
        available[String(column.name)] = column;
      });

      var names = Object.keys(data).filter(function (name) {
        return available[name] !== undefined;
      });

      if (names.indexOf(keyColumn.name) === -1) {
        names.unshift(keyColumn.name);
      }

      var values = names.map(function (name) {
        if (name === keyColumn.name) return key;
        return toDbValue(data[name]);
      });

      return select(
        "SELECT " + quoteIdentifier(keyColumn.name) + " FROM " + quoteIdentifier(change.table) + " WHERE " + quoteIdentifier(keyColumn.name) + " = ? LIMIT 1",
        [key],
      ).then(function (existing) {
        if (existing.length) {
          var setters = names.filter(function (name) {
            return name !== keyColumn.name;
          });

          if (!setters.length) return false;

          return execute(
            "UPDATE " + quoteIdentifier(change.table) + " SET " +
              setters.map(function (name) {
                return quoteIdentifier(name) + " = ?";
              }).join(", ") +
              " WHERE " + quoteIdentifier(keyColumn.name) + " = ?",
            setters
              .map(function (name) {
                return toDbValue(data[name]);
              })
              .concat([key]),
          ).then(function () {
            return true;
          });
        }

        return execute(
          "INSERT INTO " + quoteIdentifier(change.table) + " (" +
            names.map(quoteIdentifier).join(", ") +
            ") VALUES (" +
            names.map(function () {
              return "?";
            }).join(", ") +
            ")",
          values,
        ).then(function () {
          return true;
        });
      });
    });
  }

  function localIsNewer(change) {
    return getColumns(change.table).then(function (columns) {
      var keyColumn = pickKeyColumn(columns);
      var timestampColumn = pickTimestampColumn(columns);
      if (!keyColumn || !timestampColumn) return false;

      var key = coerceKey(change.id, keyColumn);

      return select(
        "SELECT " + quoteIdentifier(timestampColumn.name) + " FROM " + quoteIdentifier(change.table) + " WHERE " + quoteIdentifier(keyColumn.name) + " = ? LIMIT 1",
        [key],
      ).then(function (rows) {
        if (!rows.length) return false;
        var local = normalizeTimestamp(rows[0][timestampColumn.name]);
        return Boolean(local && change.updatedAt && local > change.updatedAt);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sync cycle                                                          */
  /* ------------------------------------------------------------------ */

  function pushBatch(changes, shadow) {
    return api("push", {
      changes: changes.map(function (change) {
        return {
          table: change.table,
          id: change.id,
          updatedAt: change.updatedAt,
          deleted: change.deleted,
          data: change.deleted ? null : change.data,
        };
      }),
    }).then(function (result) {
      var chain = Promise.resolve();

      changes.forEach(function (change) {
        if (change.deleted) {
          delete shadow[change.shadowKey];
        } else {
          shadow[change.shadowKey] = hashRow(change.data);
        }
      });

      (result.conflicts || []).forEach(function (conflict) {
        chain = chain.then(function () {
          return applyRemoteChange(conflict, tablesCache || []).then(function (applied) {
            var shadowKey = conflict.table + "\u0000" + conflict.id;
            if (conflict.deleted) {
              delete shadow[shadowKey];
              return null;
            }
            if (!applied) return null;

            return refreshShadowRow(conflict.table, conflict.id, shadow, shadowKey);
          });
        });
      });

      return chain;
    });
  }

  function refreshShadowRow(table, id, shadow, shadowKey) {
    return getColumns(table).then(function (columns) {
      var keyColumn = pickKeyColumn(columns);
      if (!keyColumn) return null;

      return select(
        "SELECT * FROM " + quoteIdentifier(table) + " WHERE " +
          quoteIdentifier(keyColumn.name) + " = ? LIMIT 1",
        [coerceKey(id, keyColumn)],
      ).then(function (rows) {
        if (rows.length) shadow[shadowKey] = hashRow(rows[0]);
      });
    });
  }

  function pushAll(changes, shadow) {
    if (!changes.length) return Promise.resolve();

    var index = 0;

    function next() {
      if (index >= changes.length) return Promise.resolve();
      var batch = changes.slice(index, index + BATCH_SIZE);
      index += BATCH_SIZE;
      state.pending = changes.length - index;
      render();

      return pushBatch(batch, shadow).then(next);
    }

    return next();
  }

  function pullAll(shadow, tables) {
    var since = 0;
    var received = 0;

    return loadCursor()
      .then(function (cursor) {
        since = cursor;
      })
      .then(function nextPage(page) {
        if (page >= MAX_CYCLES) return received;

        return api("pull", { since: since, limit: 500 }).then(function (result) {
          var chain = Promise.resolve();
          var changes = result.changes || [];

          changes.forEach(function (change) {
            chain = chain.then(function () {
              if (change.deviceId && change.deviceId === DEVICE_ID) {
                return null;
              }

              return localIsNewer(change).then(function (newer) {
                if (newer) return null;

                return applyRemoteChange(change, tables).then(function (applied) {
                  if (!applied) return null;
                  received += 1;
                  var shadowKey = change.table + "\u0000" + change.id;

                  if (change.deleted) {
                    delete shadow[shadowKey];
                    return null;
                  }

                  return refreshShadowRow(change.table, change.id, shadow, shadowKey);
                });
              });
            });
          });

          return chain.then(function () {
            since = Number(result.cursor) || since;
            return saveCursor(since).then(function () {
              if (result.hasMore) return nextPage((page || 0) + 1);
              return received;
            });
          });
        });
      })
      .then(function (count) {
        return { received: count, cursor: since };
      });
  }

  function syncNow() {
    if (!SYNC_ENABLED || state.running) return Promise.resolve(state);
    state.running = true;
    state.status = "syncing";
    state.lastError = null;
    render();

    return ensureInternalTables()
      .then(function () {
        return collectLocalChanges();
      })
      .then(function (collected) {
        return pushAll(collected.changes, collected.shadow).then(function () {
          return pullAll(collected.shadow, collected.tables).then(function (result) {
            return writeShadow(collected.shadow, collected.tables).then(function () {
              state.lastSyncAt = new Date();
              state.pending = 0;
              state.received = result.received;
              state.updateAvailable = result.received > 0;
              state.status = "synced";
              if (result.received > 0) {
                notifyListeners(result.received);
              }
            });
          });
        });
      })
      .catch(function (error) {
        state.status = "offline";
        state.lastError = error && error.message ? error.message : "sync failed";
      })
      .then(function () {
        state.running = false;
        render();
        return state;
      });
  }

  function notifyListeners(count) {
    try {
      window.dispatchEvent(
        new CustomEvent("faya:sync", { detail: { received: count } }),
      );
    } catch {
      /* CustomEvent constructor unavailable: ignore */
    }

    listeners.forEach(function (listener) {
      try {
        listener({ received: count, status: state.status });
      } catch {
        /* never let a listener break sync */
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Outbound webhooks                                                   */
  /* ------------------------------------------------------------------ */

  function emit(event, data) {
    if (!HOOKS_ENABLED) {
      return Promise.reject(new Error("hooks disabled"));
    }

    return fetch(BASE_URL + "/api/hooks/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + config.appKey,
      },
      body: JSON.stringify({ event: event, data: data || {} }),
      cache: "no-store",
    }).then(function (response) {
      return response.json().catch(function () {
        return { ok: false, error: "invalid response" };
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Status badge                                                        */
  /* ------------------------------------------------------------------ */

  var badge = null;

  function labels() {
    if (LOCALE === "en") {
      return {
        syncing: "Syncing…",
        synced: "Synced",
        offline: "Offline",
        update: "Update available",
        hooks: "Connected",
        pending: " pending",
        title: "Faya-Studio sync",
      };
    }
    return {
      syncing: "Synchronisation…",
      synced: "Synchronisé",
      offline: "Hors ligne",
      update: "Mise à jour reçue",
      hooks: "Connecté",
      pending: " en attente",
      title: "Synchronisation Faya-Studio",
    };
  }

  function ensureBadge() {
    if (badge || config.showBadge === false) return badge;

    badge = document.createElement("button");
    badge.type = "button";
    badge.setAttribute("aria-live", "polite");
    badge.style.cssText = [
      "position:fixed",
      "right:14px",
      "bottom:14px",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "gap:6px",
      "padding:6px 10px",
      "border-radius:999px",
      "border:1px solid rgba(255,255,255,0.14)",
      "background:rgba(9,14,18,0.82)",
      "color:#cbd5e1",
      "font:500 10px/1.4 ui-sans-serif,system-ui,sans-serif",
      "letter-spacing:.01em",
      "cursor:pointer",
      "backdrop-filter:blur(6px)",
      "box-shadow:0 6px 18px rgba(0,0,0,0.28)",
    ].join(";");

    badge.addEventListener("click", function () {
      if (state.updateAvailable) {
        state.updateAvailable = false;
        window.location.reload();
        return;
      }
      syncNow("manual");
    });

    document.body.appendChild(badge);
    return badge;
  }

  function render() {
    if (!ensureBadge()) return;

    var text = labels();
    var label = text.synced;
    var color = "#1be67a";

    if (!SYNC_ENABLED) {
      label = text.hooks;
      color = "#38bdf8";
    } else if (state.status === "syncing") {
      label = text.syncing;
      color = "#fbbf24";
    } else if (state.status === "offline") {
      label = text.offline + (state.pending ? " · " + state.pending + text.pending : "");
      color = "#f87171";
    } else if (state.updateAvailable) {
      label = text.update;
      color = "#38bdf8";
    } else if (state.lastSyncAt) {
      label = text.synced;
    } else {
      label = text.synced;
      color = "#64748b";
    }

    var dot = document.createElement("span");
    dot.style.cssText =
      "width:6px;height:6px;border-radius:999px;background:" + color + ";box-shadow:0 0 6px " + color;

    badge.textContent = "";
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode(label));
    badge.title = state.lastSyncAt
      ? text.title + " · " + state.lastSyncAt.toLocaleString()
      : text.title;
    badge.setAttribute("data-faya-status", state.status);
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  function boot() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", boot);
      return;
    }

    ensureBadge();
    render();

    if (!SYNC_ENABLED) return;

    ensureInternalTables()
      .then(function () {
        return syncNow("boot");
      })
      .catch(function () {
        state.status = "offline";
        render();
      });

    setInterval(function () {
      if (document.visibilityState === "visible" && navigator.onLine) {
        syncNow("poll");
      }
    }, POLL_MS);

    window.addEventListener("online", function () {
      syncNow("online");
    });
    window.addEventListener("focus", function () {
      if (navigator.onLine) syncNow("focus");
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && navigator.onLine) {
        syncNow("visible");
      }
    });
  }

  window.FayaSync = {
    config: config,
    deviceId: DEVICE_ID,
    syncNow: syncNow,
    emit: emit,
    getStatus: function () {
      return {
        enabled: SYNC_ENABLED,
        hooks: HOOKS_ENABLED,
        status: state.status,
        lastSyncAt: state.lastSyncAt,
        lastError: state.lastError,
        pending: state.pending,
        received: state.received,
        deviceId: DEVICE_ID,
      };
    },
    onChange: function (listener) {
      if (typeof listener === "function") listeners.push(listener);
    },
    reload: function () {
      window.location.reload();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
