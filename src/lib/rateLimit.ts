// Sliding-window, in-memory rate limiter. Like the case store it lives on
// globalThis so every Next.js route bundle shares one set of buckets.

const MAX_TRACKED_KEYS = 10_000;
const MAX_KEY_CHARS = 100;

const globalBuckets = globalThis as typeof globalThis & {
  __upstRateBuckets?: Map<string, number[]>;
};
if (!globalBuckets.__upstRateBuckets) {
  globalBuckets.__upstRateBuckets = new Map<string, number[]>();
}
const buckets = globalBuckets.__upstRateBuckets;

// Records a hit for `key` and returns false when the key already has `limit`
// hits inside the window. Check and record happen synchronously, so concurrent
// requests cannot both pass on the same remaining slot.
export function takeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const k = key.slice(0, MAX_KEY_CHARS);
  const hits = (buckets.get(k) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.delete(k);
    buckets.set(k, hits);
    return false;
  }
  hits.push(now);
  buckets.delete(k);
  buckets.set(k, hits);

  // Buckets are re-inserted on every hit, so the first key is the least
  // recently seen one.
  while (buckets.size > MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
  return true;
}

export function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}
