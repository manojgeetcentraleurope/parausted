import 'server-only';

import { supabaseAdminClient } from '@/lib/supabase/admin';
import { resolveAppUrl } from '@/lib/utils/app-url';

import type { DeliveryContext } from './types';

export async function loadDeliveryContext(
  deliveryEventId: string,
): Promise<DeliveryContext | null> {
  const { data: event, error: eventError } = await supabaseAdminClient
    .from('delivery_events')
    .select('id, purchase_id, voucher_id, merchant_id, channel, recipient_contact, idempotency_key')
    .eq('id', deliveryEventId)
    .single();

  if (eventError || !event) {
    console.error('[delivery-context] Failed to load delivery event', {
      deliveryEventId,
      error: eventError?.message,
    });
    return null;
  }

  if (event.channel !== 'email') {
    console.error('[delivery-context] Unsupported channel', {
      deliveryEventId,
      channel: event.channel,
    });
    return null;
  }

  if (!event.voucher_id) {
    console.error('[delivery-context] Delivery event missing voucher_id', { deliveryEventId });
    return null;
  }

  const [voucherResult, purchaseResult, merchantResult] = await Promise.all([
    supabaseAdminClient
      .from('vouchers')
      .select('id, code, original_amount_cents')
      .eq('id', event.voucher_id)
      .single(),
    supabaseAdminClient
      .from('purchases')
      .select('id, recipient_name, sender_name, personal_message, currency')
      .eq('id', event.purchase_id)
      .single(),
    supabaseAdminClient
      .from('merchants')
      .select('id, name')
      .eq('id', event.merchant_id)
      .single(),
  ]);

  if (voucherResult.error || !voucherResult.data) {
    console.error('[delivery-context] Failed to load voucher', {
      deliveryEventId,
      voucherId: event.voucher_id,
      error: voucherResult.error?.message,
    });
    return null;
  }

  if (purchaseResult.error || !purchaseResult.data) {
    console.error('[delivery-context] Failed to load purchase', {
      deliveryEventId,
      purchaseId: event.purchase_id,
      error: purchaseResult.error?.message,
    });
    return null;
  }

  if (merchantResult.error || !merchantResult.data) {
    console.error('[delivery-context] Failed to load merchant', {
      deliveryEventId,
      merchantId: event.merchant_id,
      error: merchantResult.error?.message,
    });
    return null;
  }

  const appUrl = resolveAppUrl();
  const voucherCode = voucherResult.data.code;
  const voucherUrl = `${appUrl}/es/v/${voucherCode}`;

  return {
    deliveryEventId,
    purchaseId: event.purchase_id,
    voucherId: event.voucher_id,
    merchantId: event.merchant_id,
    channel: 'email',
    recipientContact: event.recipient_contact,
    idempotencyKey: event.idempotency_key ?? `delivery:${deliveryEventId}`,
    voucherCode,
    voucherUrl,
    recipientName: purchaseResult.data.recipient_name,
    senderName: purchaseResult.data.sender_name,
    personalMessage: purchaseResult.data.personal_message,
    merchantName: merchantResult.data.name,
    amountCents: voucherResult.data.original_amount_cents,
    currency: purchaseResult.data.currency,
    locale: 'es',
  };
}
