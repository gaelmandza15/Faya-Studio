/**
 * Rate limiter abstraction.
 *
 * - `memory` is the local/default implementation (sliding window).
 * - A distributed implementation (Redis/Upstash) plugs in through
 *   `getRateLimiter()` without changing routes.
 */

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export interface RateLimiter {
  check(identifier: string, options: RateLimitOptions): RateLimitResult;
}

interface RateLimitRecord {
  timestamps: number[];
}

const CLEANUP_INTERVAL = 5 * 60 * 1000;

class MemoryRateLimiter implements RateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private lastCleanup = Date.now();

  check(identifier: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    this.purgeStale(options.windowMs, now);

    let record = this.records.get(identifier);

    if (!record) {
      record = { timestamps: [] };
      this.records.set(identifier, record);
    }

    record.timestamps = record.timestamps.filter(
      (timestamp) => now - timestamp < options.windowMs,
    );

    if (record.timestamps.length >= options.max) {
      const oldest = record.timestamps[0];
      return {
        success: false,
        limit: options.max,
        remaining: 0,
        resetMs: Math.max(0, options.windowMs - (now - oldest)),
      };
    }

    record.timestamps.push(now);

    return {
      success: true,
      limit: options.max,
      remaining: options.max - record.timestamps.length,
      resetMs: options.windowMs,
    };
  }

  private purgeStale(windowMs: number, now: number) {
    if (now - this.lastCleanup < CLEANUP_INTERVAL) return;

    this.lastCleanup = now;

    for (const [key, record] of this.records.entries()) {
      const fresh = record.timestamps.filter(
        (timestamp) => now - timestamp < windowMs,
      );

      if (fresh.length === 0) {
        this.records.delete(key);
      } else {
        record.timestamps = fresh;
      }
    }
  }
}

const globalForRateLimit = globalThis as unknown as {
  __fayaRateLimiter?: RateLimiter;
};

/**
 * Returns the configured limiter. Only the memory adapter ships today; an
 * unknown provider fails loudly instead of silently degrading to local state.
 */
export function getRateLimiter(): RateLimiter {
  const provider = (process.env.RATE_LIMITER ?? "memory").toLowerCase();

  if (provider !== "memory") {
    throw new Error(
      `Rate limiter provider "${provider}" is not implemented. Use RATE_LIMITER=memory.`,
    );
  }

  if (!globalForRateLimit.__fayaRateLimiter) {
    globalForRateLimit.__fayaRateLimiter = new MemoryRateLimiter();
  }

  return globalForRateLimit.__fayaRateLimiter;
}

/**
 * Backwards-compatible helper for call sites that do not need the interface.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60_000, max: 120 },
): RateLimitResult {
  return getRateLimiter().check(identifier, options);
}
