/**
 * Server-side environment validation.
 *
 * Imported by `next.config.ts` so a missing or malformed required variable
 * fails at build/boot time instead of in a random request.
 */

export type FayaEnvironment = "development" | "production" | "test";
export type FayaLogLevel = "debug" | "info" | "warn" | "error";

export interface FayaEnv {
  DATABASE_URL: string;
  DEEPSEEK_API_KEY: string | undefined;
  DEEPSEEK_MODEL: string;
  FAYA_PLATFORM_URL: string;
  NODE_ENV: FayaEnvironment;
  LOG_LEVEL: FayaLogLevel;
}

const NODE_ENVIRONMENTS: FayaEnvironment[] = [
  "development",
  "production",
  "test",
];
const LOG_LEVELS: FayaLogLevel[] = ["debug", "info", "warn", "error"];

function normalizePlatformUrl(value: string, errors: string[]): string {
  const trimmed = value.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      errors.push(
        "FAYA_PLATFORM_URL must use http:// or https:// (got " +
          parsed.protocol +
          ").",
      );
    }

    return trimmed;
  } catch {
    errors.push(`FAYA_PLATFORM_URL is not a valid URL: "${value}".`);
    return trimmed;
  }
}

/** Validate and return typed env. Throws on missing required vars. */
export function validateEnv(): FayaEnv {
  const errors: string[] = [];
  const warnings: string[] = [];

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    errors.push("DATABASE_URL is required (Prisma connection string).");
  } else if (!/^(file:|postgres(ql)?:\/\/)/.test(DATABASE_URL)) {
    errors.push(
      "DATABASE_URL must start with file: or postgres:// (got an unsupported scheme).",
    );
  }

  const rawNodeEnv = process.env.NODE_ENV ?? "development";
  const NODE_ENV = NODE_ENVIRONMENTS.includes(rawNodeEnv as FayaEnvironment)
    ? (rawNodeEnv as FayaEnvironment)
    : "development";

  if (NODE_ENV !== rawNodeEnv) {
    warnings.push(
      `NODE_ENV "${rawNodeEnv}" is not recognized; falling back to development.`,
    );
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

  if (!DEEPSEEK_API_KEY && NODE_ENV === "production") {
    warnings.push(
      "DEEPSEEK_API_KEY is not set — AI generation will be unavailable.",
    );
  }

  const rawPlatformUrl =
    process.env.FAYA_PLATFORM_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const FAYA_PLATFORM_URL = normalizePlatformUrl(rawPlatformUrl, errors);

  if (
    !process.env.FAYA_PLATFORM_URL &&
    !process.env.NEXT_PUBLIC_APP_URL &&
    NODE_ENV === "production"
  ) {
    warnings.push(
      "FAYA_PLATFORM_URL is not set — exported apps will point to localhost:3000.",
    );
  }

  if (NODE_ENV === "production" && DATABASE_URL?.startsWith("file:")) {
    warnings.push(
      "DATABASE_URL points to a local SQLite file. This is single-instance only; use PostgreSQL for a multi-instance deployment.",
    );
  }

  const rawLogLevel = process.env.LOG_LEVEL;
  const LOG_LEVEL = LOG_LEVELS.includes(rawLogLevel as FayaLogLevel)
    ? (rawLogLevel as FayaLogLevel)
    : NODE_ENV === "production"
      ? "info"
      : "debug";

  if (rawLogLevel && !LOG_LEVELS.includes(rawLogLevel as FayaLogLevel)) {
    warnings.push(
      `LOG_LEVEL "${rawLogLevel}" is invalid; using "${LOG_LEVEL}".`,
    );
  }

  for (const warning of warnings) {
    console.warn(`[faya-env] WARN: ${warning}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `\n[faya-env] Missing or invalid environment variables:\n${errors
        .map((entry) => `  • ${entry}`)
        .join("\n")}\n`,
    );
  }

  return {
    DATABASE_URL: DATABASE_URL as string,
    DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-flash",
    FAYA_PLATFORM_URL,
    NODE_ENV,
    LOG_LEVEL,
  };
}

let cached: FayaEnv | undefined;

export function getEnv(): FayaEnv {
  if (!cached) {
    cached = validateEnv();
  }

  return cached;
}

/** Typed lazy singleton, safe to import from server-only modules. */
export const env = new Proxy({} as FayaEnv, {
  get(_target, property: string) {
    return getEnv()[property as keyof FayaEnv];
  },
});
