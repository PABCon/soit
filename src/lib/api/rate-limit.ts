import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Security audit finding: `/api/v1/*` had no rate limiting at all — a
 * leaked or misused API key (low real risk given the key's own 192-bit
 * entropy, per authenticateApiRequest's own doc comment, but a real gap
 * regardless) could hammer the API with no throttling, costing real
 * compute/DB load with no safety net. Sliding window, 60 requests/60s per
 * company — generous for genuine integration use (this is a low-volume
 * B2B surface, occasional job CRUD, not a polling API) while giving
 * abuse an actual ceiling. Keyed by `companyId`, not the raw key or IP:
 * the threat this protects against is a *valid* key being abused, not
 * key-guessing (infeasible at this entropy) — so the limit should follow
 * the company's own usage, consistently, even if they rotate keys.
 */
const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  prefix: "api-v1-ratelimit",
});

export async function checkApiRateLimit(companyId: string): Promise<boolean> {
  const { success } = await ratelimit.limit(companyId);
  return success;
}
