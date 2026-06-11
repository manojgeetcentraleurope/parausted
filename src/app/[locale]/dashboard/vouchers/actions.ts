'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

// --- Types ---

export type VoucherHistoryRow = {
  id: string;
  code: string;
  status: string;
  original_amount_cents: number;
  balance_cents: number;
  expires_at: string;
  issued_at: string;
  reference_code: string;
  recipient_name: string;
  last_redeemed_at: string | null;
  delivery_channel: string | null;
  delivery_status: string | null;
};

type ListVouchersResult =
  | { ok: true; vouchers: VoucherHistoryRow[] }
  | { ok: false; error: string };

type DeliveryEventQueryRow = {
  channel: string;
  status: string;
  queued_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
};

type VoucherQueryRow = {
  id: string;
  code: string;
  status: string;
  original_amount_cents: number;
  balance_cents: number;
  expires_at: string;
  issued_at: string;
  purchases: { reference_code: string; recipient_name: string } | null;
  redemptions: { redeemed_at: string }[] | null;
  delivery_events: DeliveryEventQueryRow[] | null;
};

// --- Action ---

export async function listMerchantVouchers(): Promise<ListVouchersResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: true, vouchers: [] };
  }

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (merchantError) {
    console.error('[listMerchantVouchers] merchant query error', {
      message: merchantError.message,
    });
    return { ok: false, error: 'query_failed' };
  }

  if (!merchant) {
    return { ok: true, vouchers: [] };
  }

  const { data: raw, error } = await supabase
    .from('vouchers')
    .select(
      `
      id,
      code,
      status,
      original_amount_cents,
      balance_cents,
      expires_at,
      issued_at,
      purchases ( reference_code, recipient_name ),
      redemptions ( redeemed_at ),
      delivery_events ( channel, status, queued_at, sent_at, delivered_at, failed_at )
    `
    )
    .eq('merchant_id', merchant.id)
    .order('issued_at', { ascending: false });

  if (error) {
    console.error('[listMerchantVouchers] query error', { message: error.message });
    return { ok: false, error: 'query_failed' };
  }

  const rows = (raw ?? []) as unknown as VoucherQueryRow[];
  const vouchers: VoucherHistoryRow[] = rows.map((r) => {
    const purchase = r.purchases;
    const redemptionRows = r.redemptions;
    const deliveryEvent = (r.delivery_events ?? [])[0] ?? null;
    const dates = (redemptionRows ?? [])
      .map((rd) => rd.redeemed_at)
      .filter((d): d is string => typeof d === 'string' && d.length > 0);
    const lastRedeemedAt =
      dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

    return {
      id: r.id,
      code: r.code,
      status: r.status,
      original_amount_cents: r.original_amount_cents,
      balance_cents: r.balance_cents,
      expires_at: r.expires_at,
      issued_at: r.issued_at,
      reference_code: purchase?.reference_code ?? '',
      recipient_name: purchase?.recipient_name ?? '',
      last_redeemed_at: lastRedeemedAt,
      delivery_channel: deliveryEvent?.channel ?? null,
      delivery_status: deliveryEvent?.status ?? null,
    };
  });

  return { ok: true, vouchers };
}
