import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildRateLimitKey, checkRateLimit } from '@/lib/security/rate-limit';
import { fingerprintSensitiveToken } from '@/lib/security/hash';
import { recordSecurityEvent } from '@/lib/security/security-events';

// ─── Types ────────────────────────────────────────────────────────

export interface RedeemVoucherResult {
  success: boolean;
  error?: string;
  voucherCode?: string;
  amountCents?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  redemptionId?: string;
  status?: string;
}

interface RedeemVoucherRpcResult {
  success: boolean;
  error?: string;
  redemption_id?: string;
  voucher_code?: string;
  amount_cents?: number;
  balance_before?: number;
  balance_after?: number;
  status?: string;
}

// ─── Core redemption logic ────────────────────────────────────────

/**
 * Redeems the full remaining balance of a voucher.
 *
 * Shared by the dashboard server action surface and the REST API route so the
 * auth check, per-user rate limiting, and atomic RPC call live in one place
 * (single source of truth). The `redeem_voucher_full` RPC enforces tenant
 * isolation, row locking, and append-only redemption/audit writes; this
 * helper never trusts a client-supplied merchant id.
 */
export async function redeemVoucherFull(
  voucherCode: string,
  notes?: string,
): Promise<RedeemVoucherResult> {
  const supabase = await createSupabaseServerClient();

  // Deny by default when the session is unclear; the RPC also enforces this.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  // Rate limit redemption attempts per authenticated user (30/min). Keyed by
  // the user id rather than IP since this is an authenticated merchant flow.
  const rateLimitDecision = await checkRateLimit(
    buildRateLimitKey('redemption_attempt', user.id),
    30,
    60,
  );
  if (rateLimitDecision.enforced && !rateLimitDecision.allowed) {
    await recordSecurityEvent({
      eventType: 'rate_limit_redemption_attempt',
      endpoint: 'redeemVoucherFull',
      severity: 'warning',
      autoAction: 'blocked',
      details: {
        scope: 'redemption_attempt',
        code_fingerprint: fingerprintSensitiveToken(voucherCode),
        count: rateLimitDecision.count,
        limit: rateLimitDecision.limit,
      },
    });
    return { success: false, error: 'rate_limited' };
  }

  const { data, error } = await supabase.rpc('redeem_voucher_full', {
    p_voucher_code: voucherCode,
    p_notes: notes ?? null,
  });

  if (error) {
    console.error('[redeemVoucherFull] RPC error', { message: error.message });
    return { success: false, error: 'unknown' };
  }

  const result = data as RedeemVoucherRpcResult;

  if (!result.success) {
    return { success: false, error: result.error ?? 'unknown' };
  }

  return {
    success: true,
    redemptionId: result.redemption_id,
    voucherCode: result.voucher_code,
    amountCents: result.amount_cents,
    balanceBefore: result.balance_before,
    balanceAfter: result.balance_after,
  };
}

/**
 * Redeems a partial amount of a voucher's remaining balance.
 *
 * Mirrors {@link redeemVoucherFull}: the auth check and per-user rate limiting
 * live here, while the `redeem_voucher_partial` RPC enforces tenant isolation,
 * row locking, the amount bounds, and append-only redemption/audit writes. The
 * merchant id is resolved from the session inside the RPC and never trusted
 * from the client. Sets the voucher to `partially_redeemed` when a remainder
 * is left, otherwise `redeemed`.
 */
export async function redeemVoucherPartial(
  voucherCode: string,
  amountCents: number,
  notes?: string,
  idempotencyKey?: string,
): Promise<RedeemVoucherResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const rateLimitDecision = await checkRateLimit(
    buildRateLimitKey('redemption_attempt', user.id),
    30,
    60,
  );
  if (rateLimitDecision.enforced && !rateLimitDecision.allowed) {
    await recordSecurityEvent({
      eventType: 'rate_limit_redemption_attempt',
      endpoint: 'redeemVoucherPartial',
      severity: 'warning',
      autoAction: 'blocked',
      details: {
        scope: 'redemption_attempt',
        code_fingerprint: fingerprintSensitiveToken(voucherCode),
        count: rateLimitDecision.count,
        limit: rateLimitDecision.limit,
      },
    });
    return { success: false, error: 'rate_limited' };
  }

  const { data, error } = await supabase.rpc('redeem_voucher_partial', {
    p_voucher_code: voucherCode,
    p_amount_cents: amountCents,
    p_notes: notes ?? null,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (error) {
    console.error('[redeemVoucherPartial] RPC error', { message: error.message });
    return { success: false, error: 'unknown' };
  }

  const result = data as RedeemVoucherRpcResult;

  if (!result.success) {
    return { success: false, error: result.error ?? 'unknown' };
  }

  return {
    success: true,
    redemptionId: result.redemption_id,
    voucherCode: result.voucher_code,
    amountCents: result.amount_cents,
    balanceBefore: result.balance_before,
    balanceAfter: result.balance_after,
    status: result.status,
  };
}
