import 'server-only';

import type Stripe from 'stripe';

import { getStripeClient } from './server';

// ---------------------------------------------------------------------------
// Online (Stripe Connect destination charge) refund resolution.
//
// This module performs ONLY the Stripe side of the refund saga. It never
// touches the database. The server action orchestrates begin/finalize RPCs
// around it. Full-refund-only for V1: no `amount`, no `stripeAccount` header,
// no `refund_application_fee` while the platform fee is 0.
// ---------------------------------------------------------------------------

export type RefundOutcome =
  | { kind: 'succeeded'; refundId: string }
  | { kind: 'pending' }
  | { kind: 'failed'; failureCode: string };

interface ResolveRefundInput {
  purchaseId: string;
  paymentIntentId: string;
  amountCents: number;
  existingRefundId: string | null;
}

// Map a Stripe refund status to a saga outcome. `status` is `string | null`.
function classifyRefund(refund: Stripe.Refund): RefundOutcome {
  switch (refund.status) {
    case 'succeeded':
      return { kind: 'succeeded', refundId: refund.id };
    case 'pending':
    case 'requires_action':
      return { kind: 'pending' };
    case 'canceled':
      return { kind: 'failed', failureCode: 'stripe_refund_canceled' };
    case 'failed':
      return { kind: 'failed', failureCode: 'stripe_refund_failed' };
    default:
      return { kind: 'failed', failureCode: 'stripe_refund_error' };
  }
}

// A refund is useful for full-refund recovery only if it is still progressing
// (succeeded/pending/requires_action) and, when an amount is present, matches
// the full amount. Kept consistent with classifyRefund's pending mapping.
function isUsefulRefund(refund: Stripe.Refund, amountCents: number): boolean {
  if (
    refund.status !== 'succeeded' &&
    refund.status !== 'pending' &&
    refund.status !== 'requires_action'
  ) {
    return false;
  }
  if (typeof refund.amount === 'number' && refund.amount !== amountCents) {
    return false;
  }
  return true;
}

function pickUsefulRefund(
  refunds: Stripe.Refund[],
  purchaseId: string,
  amountCents: number,
): Stripe.Refund | null {
  const useful = refunds.filter((refund) => isUsefulRefund(refund, amountCents));
  if (useful.length === 0) {
    return null;
  }
  // Prefer a refund our own flow created (metadata.purchase_id), else first.
  const matched = useful.find((refund) => refund.metadata?.purchase_id === purchaseId);
  return matched ?? useful[0];
}

/**
 * Resolve the Stripe refund for an online/card purchase.
 *
 * Recovery-first to avoid double refunds when an idempotency key has expired:
 *   1. If a refund id is already known, retrieve and classify it.
 *   2. Otherwise look for a useful existing refund on the PaymentIntent.
 *   3. Only if none exists, create a new full refund with a deterministic
 *      idempotency key (`refund:{purchaseId}`).
 *
 * May throw on Stripe/network errors; the caller finalizes as failed.
 */
export async function resolveOnlineRefund(input: ResolveRefundInput): Promise<RefundOutcome> {
  const stripe = getStripeClient();

  // 1. Known refund id from a prior attempt: retrieve and classify.
  if (input.existingRefundId) {
    const existing = await stripe.refunds.retrieve(input.existingRefundId);
    return classifyRefund(existing);
  }

  // 2. Recover any useful refund already created for this PaymentIntent.
  const list = await stripe.refunds.list({
    payment_intent: input.paymentIntentId,
    limit: 100,
  });

  const recovered = pickUsefulRefund(list.data, input.purchaseId, input.amountCents);
  if (recovered) {
    return classifyRefund(recovered);
  }

  // 3. No useful prior refund: create a new full refund (idempotent).
  const created = await stripe.refunds.create(
    {
      payment_intent: input.paymentIntentId,
      reverse_transfer: true,
      metadata: {
        purchase_id: input.purchaseId,
        refund_type: 'online_stripe',
      },
    },
    {
      idempotencyKey: `refund:${input.purchaseId}`,
    },
  );

  return classifyRefund(created);
}
