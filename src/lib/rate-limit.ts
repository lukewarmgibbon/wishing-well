/**
 * In-process rate limiting.
 *
 * Deliberately dependency-free. Note the limitation: this is per-instance, so a
 * multi-instance deployment needs a shared store (Redis, Upstash) instead. The
 * interface here is small enough to swap without touching call sites.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

// Keep the map from growing without bound on a long-lived process.
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}

export type RateLimit = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimit {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: opts.limit - existing.count, retryAfterSeconds: 0 };
}

/** Best-effort client identity. Honours a single proxy hop. */
export function clientKey(req: Request, scope: string) {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}

/** Presets tuned to what these endpoints actually cost. */
export const LIMITS = {
  login: { limit: 8, windowMs: 10 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 4, windowMs: 60 * 60_000 },
  emailVerification: { limit: 3, windowMs: 60 * 60_000 },
  itemCreate: { limit: 60, windowMs: 60_000 },
  share: { limit: 20, windowMs: 10 * 60_000 },
  apiWrite: { limit: 120, windowMs: 60_000 },
  itemBulk: { limit: 10, windowMs: 60_000 },
  // Each call makes the server fetch a third-party page, so this is both an
  // abuse limit and our egress bill. Generous enough for bulk adding by hand.
  metadata: { limit: 60, windowMs: 60_000 },
} as const;

export function guard(req: Request, scope: keyof typeof LIMITS): RateLimit {
  return rateLimit(clientKey(req, scope), LIMITS[scope]);
}
