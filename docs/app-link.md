# Application link, sync and external connections

Exported applications are not dead artifacts: each project can be **linked** to
Faya-Studio. Linking is opt-in per application and gates two independent
capabilities:

1. **Data sync** — the local SQLite database is replicated between devices and
   the platform.
2. **Outbound webhooks** — the application can emit events to n8n, Make,
   Zapier, Slack or any HTTP endpoint.

An application with neither capability stays fully standalone.

## App key

Enabling either capability creates a project-level key (`fs_` + 40 hex chars),
stored on `Project.appKey` and shown only to roles with `project.update`.
Rotating the key invalidates every export already in the field; exports made
after the rotation embed the new key.

The key is embedded at build time in `faya-config.js`, next to the platform URL
(`FAYA_PLATFORM_URL`). It is a bearer credential scoped to one application, not
a user session.

## Sync protocol

All routes accept `POST` and `Authorization: Bearer <app key>`. CORS is open so
the Tauri WebView can call the platform directly.

### `POST /api/sync/handshake`

```json
{
  "deviceId": "uuid",
  "deviceName": "Poste caisse",
  "platform": "windows",
  "appVersion": "1.0.0"
}
```

Registers or refreshes a `SyncDevice` and returns the project name and whether
sync is currently enabled.

### `POST /api/sync/push`

```json
{
  "deviceId": "uuid",
  "changes": [
    {
      "table": "invoices",
      "id": "42",
      "updatedAt": "2026-11-17T12:00:00.000Z",
      "deleted": false,
      "data": { "id": 42, "total": 1200 }
    }
  ]
}
```

- Maximum 500 changes per call and 256 KB per row.
- Table names must match `^[A-Za-z_][A-Za-z0-9_]{0,63}$`.
- Each `(project, table, row)` is stored in `SyncRecord` with a monotonic
  `seq`.
- Last-write-wins on `updatedAt`. A stale or conflicting change is rejected
  and returned in `conflicts` with the current server row, so the client can
  apply it locally.
- Deletions are tombstones (`deleted: true`, `data: null`).

### `POST /api/sync/pull`

```json
{ "deviceId": "uuid", "since": 128, "limit": 500 }
```

Returns every record with `seq > since`, ordered by `seq`, plus `cursor` and
`hasMore`. Deleted records are included as tombstones. The client persists the
cursor in `_faya_sync_state`.

## Embedded engine

`templates/faya-runtime/faya-sync.js` is copied into the exported frontend and
loaded after `faya-config.js`. It:

- discovers tables with `sqlite_master` and columns with `PRAGMA table_info`;
- skips internal `_faya_*` tables and tables without a usable key (`id` or
  primary key);
- picks the most relevant timestamp column (`updated_at`, `modified_at`,
  `created_at`, case-insensitive);
- computes a content hash per row and compares it to `_faya_sync_rows` to
  detect inserts, edits and deletions without requiring the generated app to
  log writes;
- pushes local changes, then pulls remote changes until the cursor is caught
  up;
- applies remote rows with `INSERT` / `UPDATE` / `DELETE`, filtering columns to
  the local schema;
- never blocks the UI: offline errors leave the app fully functional and the
  next poll retries;
- polls every 20 seconds when visible, and on `online`, focus and visibility
  changes.

Status is exposed as:

```js
window.FayaSync.getStatus();
window.FayaSync.syncNow();
window.FayaSync.onChange(({ received }) => {});
window.dispatchEvent(new Event("faya:sync"));
```

A small opt-out badge (`showBadge: false`) shows `Synchronisé`, `Hors ligne`,
`Synchronisation…` or `Mise à jour reçue`. Clicking it forces a sync, or reloads
the page when remote changes were received.

## Browser execution bridge

`/app/[id]` opens a generated application full screen in an iframe, without
the AI studio. The workspace route injects a small bridge that defines both
`window.__TAURI__` and `window.__TAURI_INTERNALS__`, so generated code that
detects either one keeps using `invoke("db_select" | "db_execute", …)`.

The bridge posts to `POST /api/projects/[id]/db`:

- session required, plus membership in the project's organization;
- `db_select` requires only membership;
- `db_execute` requires `project.update` (viewers are read-only);
- one statement per request;
- parameters must be primitives;
- `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, `ANALYZE`, DDL and write statements
  disguised through `WITH` in `db_select` are rejected;
- the CSP restricts `connect-src` to the project's own data endpoint;
- the endpoint is limited to 180 requests/minute per user (HTTP 429 with
  `Retry-After`);
- `GET /api/projects/[id]/events` streams SSE events to the app runner.

The SSE registry is shared through `globalThis` so the events, db and sync
route bundles use the same listener map. Desktop pushes emit `desktop_push`;
web writes emit `web_write` with the originating tab's `clientId`. The runner
debounces reloads, refreshes on desktop pushes and on writes from other tabs,
and ignores its own writes.

The platform keeps one SQLite database per project in
`workspaces/<id>/.faya/app.db`. It is seeded from `desktop-schema.sql` on first
use and refreshed when the schema file changes:

- new tables through `CREATE TABLE IF NOT EXISTS`;
- new nullable/defaulted columns through `ALTER TABLE ADD COLUMN`.

### Bidirectional reconciliation

The web bridge and the desktop sync engine write to the same `SyncRecord`
stream:

- after a successful web `db_execute`, the bridge snapshots the affected table
  before and after, diffs inserted/updated/deleted rows, and stores the changes
  with `deviceId = "web"`;
- when a desktop `push` is accepted, the same rows are applied to the
  platform-side SQLite database;
- a desktop device pulling changes therefore receives browser edits, and a
  browser reload sees desktop edits.

Known limits: SQLite files, the SSE registry and the rate limiter are local to
one platform instance; a multi-instance deployment needs shared storage and a
shared pub/sub. Generated apps that depend on Tauri APIs other than `invoke`
are not supported in the browser. The iframe is same-origin with the platform,
which is a trust boundary to harden (separate app origin + scoped token) before
public exposure.

## External connections

The application calls:

```js
FayaSync.emit("facture.validee", { id: 42, total: 1200 });
```

which posts to `POST /api/hooks/events`. The platform authenticates the app
key, then relays the event to every enabled `WebhookEndpoint` for the project.

Headers on the outbound request:

| Header | Value |
| --- | --- |
| `X-Faya-Event` | event name |
| `X-Faya-Delivery` | delivery UUID |
| `X-Faya-Timestamp` | Unix seconds |
| `X-Faya-Signature` | `sha256=<hex hmac>` |

The signed string is `${timestamp}.${rawBody}`. Verification:

```js
const expected =
  "sha256=" +
  createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
```

Each delivery is stored in `WebhookDelivery` with the HTTP status and error.
Endpoints are limited to 10 per application. Delivery is synchronous with a
10-second timeout and no retry yet.

## Verification

```bash
# Two devices, real API, real embedded engine, real SQLite files
npm run sync:verify -- fs_<app key>

# Build-time injection: config first, idempotent, normalized URL
npm run sync:verify-runtime
```

## Production hardening

Before exposing this at scale:

- rate-limit sync and event endpoints per app key and per IP;
- add outbound egress filtering / SSRF protection for webhook URLs
  (private networks are currently allowed to support self-hosted n8n);
- encrypt `Project.appKey` and `WebhookEndpoint.secret` at rest;
- add retries with exponential backoff and a dead-letter view for webhooks;
- add periodic compaction/pruning of `SyncRecord` tombstones;
- add per-field merge or CRDT for concurrent edits on large records;
- add an audit log of key rotations and device registrations;
- add auto-update signing for exported applications.
