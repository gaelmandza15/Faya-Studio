/**
 * In-memory sliding-window rate limiter for sensitive endpoints.
 * Operates per client identifier (IP / Session).
 */

interface RateLimitRecord {
  timestamps: number[];
}

const globalForRateLimit = globalThis as unknown as {
  __fayaRateLimitRecords?: Map<string, RateLimitRecord>;
};

const records: Map<string, RateLimitRecord> =
  globalForRateLimit.__fayaRateLimitRecords ??
  (globalForRateLimit.__fayaRateLimitRecords = new Map<
    string,
    RateLimitRecord
  >());

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function purgeStale(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, record] of records.entries()) {
    const fresh = record.timestamps.filter((ts) => now - ts < windowMs);
    if (fresh.length === 0) {
      records.delete(key);
    } else {
      record.timestamps = fresh;
    }
  }
}

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

export function rateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60_000, max: 120 },
): RateLimitResult {
  const now = Date.now();
  purgeStale(options.windowMs);

  let record = records.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    records.set(identifier, record);
  }

  // Filter out timestamps outside the sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < options.windowMs);

  if (record.timestamps.length >= options.max) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, options.windowMs - (now - oldest));
    return {
      success: false,
      limit: options.max,
      remaining: 0,
      resetMs,
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
