/**
 * Minimal in-memory fixed-window rate limiter for public endpoints.
 *
 * Keyed by API key id (authenticated) or client IP (anonymous). This is
 * per-process — fine for the single-node deployment; swap the Map for Redis if
 * you ever run multiple app instances behind a load balancer.
 */
type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  // Occasional sweep so the Map can't grow unbounded.
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
    lastSweep = now;
  }
  let b = buckets.get(key);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

/** Real client IP = last entry of X-Forwarded-For (the one the proxy appended). */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (!xff) return "unknown";
  const parts = xff
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}
