// @ts-nocheck
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxCalls: number, windowMs: number): boolean {
  const now = Date.now();
  const calls = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  if (calls.length >= maxCalls) return true;
  calls.push(now);
  buckets.set(key, calls);
  return false;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
