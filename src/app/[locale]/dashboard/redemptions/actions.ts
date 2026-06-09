'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────

export interface RedeemVoucherResult {
  success: boolean;
  error?: string;
  voucherCode?: string;
  amountCents?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  redemptionId?: string;
}

// ─── Action ───────────────────────────────────────────────────────

export async function redeemVoucherFull(
  voucherCode: string,
  notes?: string,
): Promise<RedeemVoucherResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('redeem_voucher_full', {
    p_voucher_code: voucherCode,
    p_notes: notes ?? null,
  });

  if (error) {
    console.error('[redeemVoucherFull] RPC error', { message: error.message });
    return { success: false, error: 'unknown' };
  }

  const result = data as {
    success: boolean;
    error?: string;
    redemption_id?: string;
    voucher_code?: string;
    amount_cents?: number;
    balance_before?: number;
    balance_after?: number;
    status?: string;
  };

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
