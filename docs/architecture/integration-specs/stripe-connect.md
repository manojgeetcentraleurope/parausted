# Integration Spec: Stripe Connect

## Overview
Stripe Connect (Express) handles all online payments. ParaUsted is the "platform", each merchant is a "connected account".

## Setup Flow
1. Merchant clicks "Connect Payments" in dashboard settings
2. Backend creates Stripe Account Link (Express onboarding)
3. Merchant completes Stripe's hosted onboarding (DNI, NIF/CIF, IBAN)
4. Stripe redirects back to ParaUsted with success/failure
5. Backend stores `stripe_account_id` on merchant record

## Payment Flow
1. Frontend creates checkout session via `/api/purchases` with `payment_method: 'card'`
2. Backend creates Stripe PaymentIntent:
   ```
   amount: purchase.amount_cents
   currency: 'eur'
   application_fee_amount: Math.round(purchase.amount_cents * 0.05)  // 5%
   transfer_data: { destination: merchant.stripe_account_id }
   ```
3. Frontend renders Stripe Payment Element (Stripe.js)
4. Customer authenticates (3D Secure)
5. Stripe sends webhook: `payment_intent.succeeded`

## Webhook Handling
- **Endpoint:** `POST /api/webhooks/stripe`
- **Verify:** `stripe.webhooks.constructEvent(body, sig, secret)`
- **Idempotency:** Check `processed_webhooks` table for `event.id`
- **On success:**
  1. Insert into `processed_webhooks`
  2. Update purchase status → `payment_confirmed`
  3. Generate voucher (crypto random code)
  4. Create ledger entries (revenue, payable_85, reserve_15)
  5. Queue delivery
  6. Insert audit_event

## Payout Configuration
- Stripe Connect `delay_days` controls payout timing
- We use manual payouts (not automatic) to control 85/15 split
- Payout cron creates Stripe Transfers on schedule

## Test Mode
- Use `pk_test_` and `sk_test_` keys
- Test card: 4242 4242 4242 4242 (any future expiry, any CVC)
- Test webhook: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
