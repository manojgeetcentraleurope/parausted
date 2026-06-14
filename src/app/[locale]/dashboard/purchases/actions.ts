'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { maskEmail } from '@/lib/utils/mask-email';

// ─── Types ────────────────────────────────────────────────────────

export interface PendingPurchaseRow {
  id: string;
  reference_code: string;
  gift_card_title: string;
  amount_cents: number;
  currency: string;
  payment_method: string;
  buyer_email_masked: string;
  recipient_name: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
  status: string;
}

export interface ListPendingPurchasesResult {
  purchases: PendingPurchaseRow[];
  error?: string;
}

export interface MutatePurchaseResult {
  success: boolean;
  error?: string;
  voucherCode?: string;
  alreadyIssued?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

async function getMerchantIdForUser(): Promise<{
  merchantId: string | null;
  userId: string | null;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { merchantId: null, userId: null, error: 'unauthorized' };
  }

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (merchantError || !merchant) {
    return { merchantId: null, userId: user.id, error: 'no_merchant' };
  }

  return { merchantId: merchant.id, userId: user.id };
}

/**
 * Guard for merchant manual confirmation/rejection actions.
 * Only OFFLINE purchases may be confirmed or rejected from this center.
 * ONLINE/card purchases are exclusively confirmed via the Stripe webhook.
 */
async function assertOfflinePendingPurchase(
  purchaseId: string,
  merchantId: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('purchases')
    .select('status, payment_source, payment_method')
    .eq('id', purchaseId)
    .eq('merchant_id', merchantId)
    .single();

  if (!data) return { valid: false, error: 'not_found' };
  if (data.payment_source !== 'OFFLINE') return { valid: false, error: 'not_found' };
  if (!['bizum_direct', 'bank_transfer', 'cash'].includes(data.payment_method as string)) {
    return { valid: false, error: 'not_found' };
  }
  if (data.status !== 'pending') return { valid: false, error: 'already_processed' };

  return { valid: true };
}

/**
 * Guard for merchant refund/void action.
 * Only OFFLINE purchases that already have a confirmed payment may be refunded
 * from this center. ONLINE/card refunds are deferred to the Stripe slice.
 */
async function assertOfflineConfirmedPurchase(
  purchaseId: string,
  merchantId: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('purchases')
    .select('status, payment_source')
    .eq('id', purchaseId)
    .eq('merchant_id', merchantId)
    .single();

  if (!data) return { valid: false, error: 'not_found' };
  if (data.payment_source !== 'OFFLINE') return { valid: false, error: 'invalid_payment_source' };
  if (data.status !== 'payment_confirmed') {
    if (['refunded', 'cancelled', 'partially_refunded'].includes(data.status as string)) {
      return { valid: false, error: 'already_processed' };
    }
    return { valid: false, error: 'not_refundable' };
  }

  return { valid: true };
}

// ─── List Pending Purchases ──────────────────────────────────────

export async function listPendingPurchases(
  search?: string
): Promise<ListPendingPurchasesResult> {
  const { merchantId, error } = await getMerchantIdForUser();
  if (error || !merchantId) {
    return { purchases: [], error: error ?? 'unauthorized' };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('purchases')
    .select(
      `
      id,
      reference_code,
      amount_cents,
      currency,
      payment_method,
      buyer_email,
      recipient_name,
      created_at,
      expires_at,
      status,
      gift_cards ( title, title_en )
    `
    )
    .eq('merchant_id', merchantId)
    .in('status', ['pending', 'payment_confirmed'])
    .eq('payment_source', 'OFFLINE')
    .order('created_at', { ascending: false });

  if (search && search.trim().length > 0) {
    query = query.ilike('reference_code', `%${search.trim()}%`);
  }

  const { data, error: queryError } = await query;

  if (queryError) {
    console.error('[listPendingPurchases] query error:', queryError.message);
    return { purchases: [], error: 'unknown' };
  }

  const now = new Date();
  const purchases: PendingPurchaseRow[] = (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    return {
      id: r.id as string,
      reference_code: r.reference_code as string,
      gift_card_title: (r.gift_cards?.title as string | undefined) ?? '',
      amount_cents: r.amount_cents as number,
      currency: (r.currency as string | undefined) ?? 'EUR',
      payment_method: r.payment_method as string,
      buyer_email_masked: maskEmail((r.buyer_email as string | undefined) ?? ''),
      recipient_name: (r.recipient_name as string | undefined) ?? '',
      created_at: r.created_at as string,
      expires_at: r.expires_at as string,
      is_expired: new Date(r.expires_at as string) < now,
      status: r.status as string,
    };
  });

  return { purchases };
}

// ─── Confirm Purchase (issues voucher atomically) ───────────────

export async function confirmPurchase(
  purchaseId: string
): Promise<MutatePurchaseResult> {
  const auth = await getMerchantIdForUser();
  if (auth.error || !auth.merchantId || !auth.userId) {
    return { success: false, error: 'unauthorized' };
  }

  const supabase = await createSupabaseServerClient();

  const guard = await assertOfflinePendingPurchase(purchaseId, auth.merchantId);
  if (!guard.valid) {
    return { success: false, error: guard.error };
  }

  const { data, error: rpcErr } = await supabase.rpc(
    'confirm_purchase_and_issue_voucher',
    { p_purchase_id: purchaseId }
  );

  if (rpcErr) {
    console.error('[confirmPurchase] rpc failed:', rpcErr.message);
    return { success: false, error: 'unknown' };
  }

  const result = data as {
    success?: boolean;
    error?: string;
    voucher_code?: string;
    already_issued?: boolean;
  } | null;

  if (result?.success) {
    return {
      success: true,
      voucherCode: result.voucher_code,
      alreadyIssued: result.already_issued ?? false,
    };
  }

  return { success: false, error: result?.error ?? 'unknown' };
}

// ─── Reject Purchase ────────────────────────────────────────────

export async function rejectPurchase(
  purchaseId: string,
  reason?: string
): Promise<MutatePurchaseResult> {
  // 1. Validate auth + merchant ownership
  const auth = await getMerchantIdForUser();
  if (auth.error || !auth.merchantId || !auth.userId) {
    return { success: false, error: 'unauthorized' };
  }

  const supabase = await createSupabaseServerClient();

  const guard = await assertOfflinePendingPurchase(purchaseId, auth.merchantId);
  if (!guard.valid) {
    return { success: false, error: guard.error };
  }

  const { data, error: rpcErr } = await supabase.rpc('cancel_pending_purchase', {
    p_purchase_id: purchaseId,
    p_reason: reason ?? null,
  });

  if (rpcErr) {
    console.error('[rejectPurchase] rpc failed:', rpcErr.message);
    return { success: false, error: 'unknown' };
  }

  const result = data as { success?: boolean; error?: string } | null;

  if (result?.success) {
    return { success: true };
  }

  return { success: false, error: result?.error ?? 'unknown' };
}

// ─── Refund / Void Purchase (offline, DB-state only) ────────────

export async function refundPurchase(
  purchaseId: string,
  reason: string
): Promise<MutatePurchaseResult> {
  // 1. Validate auth + merchant ownership
  const auth = await getMerchantIdForUser();
  if (auth.error || !auth.merchantId || !auth.userId) {
    return { success: false, error: 'unauthorized' };
  }

  // 2. Reason is required (non-empty after trim) before touching the RPC
  const trimmedReason = (reason ?? '').trim();
  if (trimmedReason.length === 0) {
    return { success: false, error: 'invalid_reason' };
  }

  const supabase = await createSupabaseServerClient();

  // 3. Guard: only OFFLINE payment_confirmed purchases may be refunded
  const guard = await assertOfflineConfirmedPurchase(purchaseId, auth.merchantId);
  if (!guard.valid) {
    return { success: false, error: guard.error };
  }

  const { data, error: rpcErr } = await supabase.rpc('refund_offline_purchase', {
    p_purchase_id: purchaseId,
    p_reason: trimmedReason,
  });

  if (rpcErr) {
    console.error('[refundPurchase] rpc failed:', rpcErr.message);
    return { success: false, error: 'unknown' };
  }

  const result = data as {
    success?: boolean;
    error?: string;
    refund_type?: string;
  } | null;

  if (result?.success) {
    return { success: true };
  }

  return { success: false, error: result?.error ?? 'unknown' };
}
