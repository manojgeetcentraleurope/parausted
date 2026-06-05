# AI Context Pack — ParaUsted

> Paste this into any AI prompt for full project context.
> This is a condensed version of the PRD optimized for token efficiency.

## What is ParaUsted?

Digital gift card SaaS for local businesses in Spain. Merchants (barbers, restaurants) create personalized gift cards. Buyers purchase (online via Stripe or offline via Bizum/cash). Recipients redeem at the merchant. No recipient account needed.

## Tech Stack

Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth + Storage) + Stripe Connect + Resend + Meta WhatsApp API + Cloudflare

## Database Tables (12)

```
merchants        (id, slug, name, category, stripe_account_id, bizum_phone, bank_iban)
gift_cards       (id, merchant_id, card_type, title, amount_cents, valid_days)
purchases        (id, merchant_id, gift_card_id, amount_cents, buyer_email, recipient_name,
                  relationship, design_template, personal_message, sender_name,
                  payment_source[ONLINE|OFFLINE], payment_method, reference_code, status)
vouchers         (id, purchase_id, merchant_id, code, balance_cents, status, expires_at)
redemptions      (id, voucher_id, merchant_id, amount_cents, balance_before, balance_after)
delivery_events  (id, purchase_id, channel, status, provider_message_id)
ledger_accounts  (id, owner_type, owner_id, account_type, balance_cents)
ledger_entries   (id, account_id, entry_type, amount_cents, reference_type) — IMMUTABLE
payouts          (id, merchant_id, amount_cents, payout_type, status, scheduled_for)
audit_events     (id, merchant_id, event_type, actor_type, entity_type, entity_id, payload) — IMMUTABLE
security_events  (id, event_type, ip_address, severity, auto_action) — IMMUTABLE
processed_webhooks (event_id, provider, processed_at)
```

## Key Rules

1. All money in INTEGER cents. Never float.
2. Every table has RLS with merchant_id isolation.
3. merchant_id from JWT, never from request body.
4. Voucher codes: crypto random, 12+ chars, non-sequential.
5. Redemption: atomic (SELECT...FOR UPDATE + transaction).
6. Payment source is metadata, not logic. One redemption flow for all.
7. Voucher generated ONLY after payment confirmation.
8. ledger_entries + audit_events: APPEND-ONLY. No UPDATE/DELETE.
9. Generic errors to client. Detailed logs server-side.
10. Backend-only for: WhatsApp, payment processing, admin actions.

## Statuses

Purchase: pending → payment_confirmed → refunded | partially_refunded | cancelled
Voucher: issued → delivered → partially_redeemed → redeemed | exchanged | expired | voided
