/**
 * src/lib/logger.ts
 *
 * Structured JSON logger for Faya-Studio.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *
 *   // In an API route, create a child logger with request context:
 *   const log = logger.child({ requestId: crypto.randomUUID(), projectId });
 *   log.info("Processing db request", { operation: "db_select" });
 *   log.error("SQL guard blocked query", { sql, reason });
 *
 *   // In a worker script (no requestId needed):
 *   const log = logger.child({ jobId });
 *   log.info("Generation started");
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  projectId?: string;
  jobId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface LogEntry extends LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Minimum level to emit. Set LOG_LEVEL env var or defaults to "info" in prod, "debug" in dev. */
function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as LogLevel | undefined;
  if (env && env in LEVEL_ORDER) return env;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(context: LogContext = {}) {
    this.context = context;
    this.minLevel = getMinLevel();
  }

  /** Create a child logger that inherits and merges the given context. */
  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }

  private emit(level: LogLevel, message: string, meta?: LogContext): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };

    const line = JSON.stringify(entry);

    // Route to the appropriate console method so Next.js / hosting platforms
    // can apply their own log-level filtering and colouring.
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  debug(message: string, meta?: LogContext): void {
    this.emit("debug", message, meta);
  }

  info(message: string, meta?: LogContext): void {
    this.emit("info", message, meta);
  }

  warn(message: string, meta?: LogContext): void {
    this.emit("warn", message, meta);
  }

  error(message: string, meta?: LogContext): void {
    this.emit("error", message, meta);
  }
}

/** Root logger — use `.child()` to attach request / job context. */
export const logger = new Logger();
