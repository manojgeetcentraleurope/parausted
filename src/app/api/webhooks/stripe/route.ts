import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import type Stripe from 'stripe';

import { getStripeClient } from '@/lib/stripe/server';
import { supabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RpcResult {
  success: boolean;
  error?: string;
  voucher_code?: string;
  already_issued?: boolean;
  already_processed?: boolean;
}

// Permanent RPC errors that Stripe retrying will not fix — return 200 to acknowledge.
const PERMANENT_ERRORS = new Set([
  'not_found',
  'invalid_payment_source',
  'expired',
  'invalid_input',
  'unsupported_event_type',
  'already_processed',
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.warn('[stripe-webhook] Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Raw body required for Stripe signature verification — must not be parsed JSON.
  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification error';
    console.warn('[stripe-webhook] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[stripe-webhook] Received', { id: event.id, type: event.type });

  // Ignore all event types except checkout.session.completed.
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Only process sessions where Stripe has confirmed payment.
  if (session.payment_status !== 'paid') {
    console.log('[stripe-webhook] Ignoring unpaid session', { eventId: event.id });
    return NextResponse.json({ received: true });
  }

  // Only process one-time payment sessions, not subscriptions.
  if (session.mode !== 'payment') {
    console.log('[stripe-webhook] Ignoring non-payment mode session', { eventId: event.id });
    return NextResponse.json({ received: true });
  }

  // Extract purchase_id: prefer session.metadata, fall back to client_reference_id.
  const purchaseId =
    session.metadata?.purchase_id ?? session.client_reference_id ?? null;

  if (!purchaseId) {
    // Configuration error — retrying will not help; return 200 to stop Stripe retries.
    console.error('[stripe-webhook] No purchase_id found in session', { eventId: event.id });
    return NextResponse.json({ received: true });
  }

  // Extract payment_intent id only when it is a plain string (not an expanded object).
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null;

  const { data, error } = await supabaseAdminClient.rpc(
    'confirm_stripe_purchase_and_issue_voucher',
    {
      p_event_id: event.id,
      p_event_type: event.type,
      p_purchase_id: purchaseId,
      p_stripe_payment_intent_id: paymentIntentId,
    },
  );

  if (error) {
    console.error('[stripe-webhook] RPC error', {
      eventId: event.id,
      message: error.message,
    });
    // Transient DB error — return 500 so Stripe retries.
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  const result = data as RpcResult;

  if (!result.success) {
    if (result.error !== undefined && PERMANENT_ERRORS.has(result.error)) {
      // Permanent failure — no retry will help.
      console.error('[stripe-webhook] Permanent failure', {
        eventId: event.id,
        reason: result.error,
      });
      return NextResponse.json({ received: true });
    }

    // Unexpected/transient failure — return 500 so Stripe retries.
    console.error('[stripe-webhook] Transient failure', {
      eventId: event.id,
      reason: result.error,
    });
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }

  if (result.already_processed === true) {
    console.log('[stripe-webhook] Event already processed', { eventId: event.id });
  } else if (result.already_issued === true) {
    console.log('[stripe-webhook] Voucher already issued for purchase', { eventId: event.id });
  } else {
    console.log('[stripe-webhook] Purchase confirmed and voucher issued', { eventId: event.id });
  }

  return NextResponse.json({ received: true });
}
