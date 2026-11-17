/**
 * Guards the SQL accepted by the browser data bridge.
 *
 * Generated apps only need CRUD at runtime. Anything that can escape the
 * project database (ATTACH), change the schema or alter connection state
 * (PRAGMA, DDL) is rejected before reaching SQLite.
 */

export type SqlCommand = "db_select" | "db_execute";

export interface SqlWriteTarget {
  verb: "insert" | "replace" | "update" | "delete";
  table: string;
}

export type SqlInspection =
  | { ok: true; kind: "read" | "write"; target: SqlWriteTarget | null }
  | { ok: false; error: string };

const FORBIDDEN =
  /\b(attach|detach|pragma|vacuum|reindex|analyze|load_extension|create|drop|alter|savepoint|release|begin|commit|rollback|trigger)\b/i;

const WRITE_VERBS = /\b(insert|replace|update|delete)\b/i;

const MAX_QUERY_LENGTH = 100_000;

/**
 * Replaces comments and string literals with spaces, and unwraps quoted
 * identifiers so keyword checks cannot be bypassed with `"ATTACH"` or
 * `/* ... *\/`.
 */
export function stripSqlNoise(sql: string): string {
  let output = "";
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];

    if (char === "-" && sql[index + 1] === "-") {
      while (index < sql.length && sql[index] !== "\n") index += 1;
      output += " ";
      continue;
    }

    if (char === "/" && sql[index + 1] === "*") {
      index += 2;
      while (
        index < sql.length &&
        !(sql[index] === "*" && sql[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 2;
      output += " ";
      continue;
    }

    if (char === "'") {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'") {
          if (sql[index + 1] === "'") {
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      output += " '' ";
      continue;
    }

    if (char === '"' || char === "`" || char === "[") {
      const closing = char === "[" ? "]" : char;
      index += 1;
      let content = "";

      while (index < sql.length) {
        if (sql[index] === closing) {
          if (closing !== "]" && sql[index + 1] === closing) {
            content += closing;
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        content += sql[index];
        index += 1;
      }

      output += /^[A-Za-z_][A-Za-z0-9_]*$/.test(content)
        ? ` ${content} `
        : " '' ";
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

function extractTarget(cleaned: string): SqlWriteTarget | null {
  const patterns: Array<{ verb: SqlWriteTarget["verb"]; regex: RegExp }> = [
    {
      verb: "insert",
      regex: /\binsert\s+(?:or\s+[a-z]+\s+)?into\s+([A-Za-z_][A-Za-z0-9_]*)/i,
    },
    {
      verb: "replace",
      regex: /\breplace\s+into\s+([A-Za-z_][A-Za-z0-9_]*)/i,
    },
    {
      verb: "update",
      regex: /\bupdate\s+(?:or\s+[a-z]+\s+)?([A-Za-z_][A-Za-z0-9_]*)/i,
    },
    {
      verb: "delete",
      regex: /\bdelete\s+from\s+([A-Za-z_][A-Za-z0-9_]*)/i,
    },
  ];

  for (const pattern of patterns) {
    const match = pattern.regex.exec(cleaned);

    if (match?.[1]) {
      return { verb: pattern.verb, table: match[1] };
    }
  }

  return null;
}

export function inspectSql(
  command: SqlCommand,
  sql: unknown,
): SqlInspection {
  if (typeof sql !== "string" || !sql.trim()) {
    return { ok: false, error: "Requête SQL manquante" };
  }

  if (sql.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: "Requête SQL trop longue" };
  }

  if (sql.includes("\u0000")) {
    return { ok: false, error: "Requête SQL invalide" };
  }

  const cleaned = stripSqlNoise(sql);
  const trimmed = cleaned.trim().replace(/;+\s*$/, "");

  if (trimmed.includes(";")) {
    return {
      ok: false,
      error: "Une seule instruction SQL est autorisée par requête",
    };
  }

  if (FORBIDDEN.test(trimmed)) {
    return {
      ok: false,
      error:
        "Cette instruction SQL n'est pas autorisée par le pont de données.",
    };
  }

  const first = /^([a-z]+)/i.exec(trimmed)?.[1]?.toLowerCase();

  if (!first) {
    return { ok: false, error: "Requête SQL invalide" };
  }

  if (command === "db_select") {
    const isRead =
      first === "select" || (first === "with" && !WRITE_VERBS.test(trimmed));

    if (!isRead) {
      return {
        ok: false,
        error: "db_select accepte uniquement des requêtes de lecture.",
      };
    }

    return { ok: true, kind: "read", target: null };
  }

  const isWrite =
    first === "insert" ||
    first === "replace" ||
    first === "update" ||
    first === "delete" ||
    (first === "with" && WRITE_VERBS.test(trimmed));

  if (!isWrite) {
    return {
      ok: false,
      error: "db_execute accepte uniquement INSERT, UPDATE ou DELETE.",
    };
  }

  return { ok: true, kind: "write", target: extractTarget(trimmed) };
}
