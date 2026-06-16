import 'server-only';

import { supabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Scope of a rate-limit bucket. Keeps keys stable and collision-free across
 * different protected actions (e.g. a purchase IP bucket vs a redemption
 * merchant bucket).
 */
export type RateLimitScope =
  | 'purchase_create'
  | 'voucher_lookup'
  | 'redemption_attempt';

export type RateLimitDecision = {
  /** Whether the caller should be allowed to proceed. */
  allowed: boolean;
  /** Count of requests recorded in the current window (0 when unknown). */
  count: number;
  /** Configured limit echoed back. */
  limit: number;
  /** Seconds until the current window resets (0 when unknown). */
  retryAfterSeconds: number;
  /**
   * True when the decision came from a healthy RPC call. False means the
   * infrastructure failed and the result is a fail-open default — useful for
   * deciding whether to emit a security event when wiring this in (8b.10b).
   */
  enforced: boolean;
};

type RpcResult = {
  allowed?: boolean;
  count?: number;
  limit?: number;
  retry_after_seconds?: number;
};

/**
 * Builds a stable, low-cardinality rate-limit key.
 *
 * The identifier must already be safe to persist (an IP, a UUID, or a hashed
 * token). Never pass a raw voucher code or raw email — hash or mask first.
 */
export function buildRateLimitKey(scope: RateLimitScope, identifier: string): string {
  return `${scope}:${identifier.trim()}`;
}

/**
 * Calls the durable `check_and_increment_rate_limit` RPC.
 *
 * Fail-open policy: if the RPC errors or returns an unexpected shape, this
 * resolves to `allowed: true` with `enforced: false`. Buyer-facing flows must
 * not break because the rate-limit store is briefly unavailable; the actual
 * throttle/block decision is applied by callers once wired in slice 8b.10b.
 * Infrastructure failures are logged here (without PII) for observability.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
  const failOpen: RateLimitDecision = {
    allowed: true,
    count: 0,
    limit,
    retryAfterSeconds: 0,
    enforced: false,
  };

  try {
    const { data, error } = await supabaseAdminClient.rpc('check_and_increment_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error('[rate-limit] RPC error', { message: error.message });
      return failOpen;
    }

    const result = data as RpcResult | null;
    if (result === null || typeof result.allowed !== 'boolean') {
      console.error('[rate-limit] unexpected RPC result shape');
      return failOpen;
    }

    return {
      allowed: result.allowed,
      count: typeof result.count === 'number' ? result.count : 0,
      limit: typeof result.limit === 'number' ? result.limit : limit,
      retryAfterSeconds:
        typeof result.retry_after_seconds === 'number' ? result.retry_after_seconds : 0,
      enforced: true,
    };
  } catch (err) {
    console.error('[rate-limit] unexpected failure', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return failOpen;
  }
}