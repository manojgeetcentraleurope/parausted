# ParaUsted Future Enhancements & Technical Debt Log

Date created: 2026-06-08

Purpose: Capture important future improvements without blocking the current MVP implementation. This keeps the team focused on the current sprint while preserving architectural, compliance, UX, and operational follow-ups.

---

## How to Use This File

When we find a future improvement during implementation:

1. Add it here instead of expanding current scope.
2. Mark it with priority and target phase.
3. Continue the current slice unless it is security-critical or legally blocking.
4. Review this file during sprint planning and before major releases.

Recommended labels:

- P0: Must fix before production / legal or security blocker
- P1: Important before MVP launch
- P2: Fast-follow after MVP launch
- P3: Later / V1.5+

---

## Open Items

### P1 — Move payment confirmation + audit + voucher issuance into DB transaction / RPC

**Context:** Current Week 4 Day 1-2 implementation updates the purchase first and then inserts an audit event. This is acceptable for the current slice, but it is not fully atomic.

**Risk:** If purchase update succeeds but audit insert fails, the action returns an error while the purchase may already be confirmed/cancelled.

**Future direction:** For voucher issuance, use a database transaction or Supabase RPC to perform these operations atomically:

- validate merchant ownership
- validate current purchase status
- update purchase status
- insert voucher
- insert audit event
- return voucher link/code

**Target phase:** Week 4 Day 3-4 / before production hardening

---

### P1 — Strong idempotency for voucher issuance

**Context:** Day 3-4 will create vouchers after payment confirmation.

**Risk:** Double confirm, retry, refresh, or network timeout could create duplicate voucher rows if not guarded.

**Future direction:** Add uniqueness/idempotency constraints such as:

- one voucher per purchase_id
- unique voucher code
- safe retry behavior
- explicit already-issued response

**Target phase:** Week 4 Day 3-4

---

### P2 — Preserve purchase form values after validation errors

**Context:** Known deferred UX polish item from handoff.

**Target phase:** UI polish pass after transaction lifecycle is complete

---

### P2 — Show actual Bizum amount in payment instructions

**Context:** Known deferred UX polish item from handoff. Current instruction may show a label instead of the exact amount.

**Target phase:** UI polish pass after transaction lifecycle is complete

---

### P2 — Warn or block same buyer and recipient email

**Context:** Known deferred business rule. Same email is currently allowed.

**Decision needed:** Decide whether to warn only or block completely.

**Target phase:** UX/business rule pass

---

### P2 — Voucher delivery automation

**Context:** V1 uses shareable voucher link + manual WhatsApp sending by buyer.

**Future direction:**

- Fast-follow: email delivery via Resend
- V1.5: WhatsApp Business API automated delivery

**Target phase:** V1 fast-follow / V1.5

---

### P2 — Make voucher-history relational joins explicit if schema evolves

**Context:** The voucher-history query uses nested Supabase/PostgREST embeds for `purchases` and `redemptions`. This is acceptable while the schema has unambiguous relationships.

**Risk:** If a second foreign key is later added between vouchers, purchases, or redemptions, automatic relationship detection may become ambiguous and break the dashboard query.

**Future direction:**

- If schema relationships become ambiguous, update nested selects to use explicit foreign-key hints.
- Verify generated Supabase types after schema changes.
- Add this to the migration review checklist when modifying voucher, purchase, or redemption relationships.

**Target phase:** When changing voucher/purchase/redemption relationships or before production hardening

---

### P3 — Personalized digital gift card experience

**Context:** Future idea discussed: personalized digital gift cards with image, audio, video, animation, or creative recipient experience.

**Future direction:** Keep modular. Do not block MVP. Consider feature flags and media storage design later.

**Target phase:** V1.5+

---

## Closed Items

_None yet._

---

### P1 — Use SECURITY DEFINER RPCs for money-state transitions

**Context:** Payment confirmation and cancellation are money-state transitions. The first implementation attempted to update `purchases` and then insert `audit_events` from server actions. This works conceptually but is not fully atomic and requires broader RLS policies.

**Decision:** Use a hybrid approach:
- Week 4 Day 1-2: implement `confirm_pending_purchase` and `cancel_pending_purchase` as database RPC functions.
- The RPC validates merchant ownership, validates purchase state, updates the purchase, and inserts the audit event in one database transaction.
- Do not grant dashboard clients direct generic insert access to `audit_events` if RPC can own audit writing.

**Why:** This reduces partial-state risk:
- purchase updated but audit insert fails
- double-click/race condition creates inconsistent audit records
- client receives failure while DB state changed

**Security requirements:**
- RPC must be `SECURITY DEFINER`.
- RPC must set a safe `search_path`.
- RPC must validate `auth.uid()` owns the merchant.
- RPC must only allow valid transitions from `pending`.
- RPC must not trust `merchant_id` from the client.
- RPC must return typed, non-sensitive errors.
- RPC must not expose buyer PII.

**Target phase:** Week 4 Day 1-2 / before committing Payment Confirmation Center

---

### P1 — Extend payment confirmation RPC to issue vouchers atomically

**Context:** Voucher issuance is scheduled for Week 4 Day 3-4. Once a purchase is confirmed, the system must generate a voucher without risking duplicate vouchers or partial state.

**Future direction:** Extend or replace `confirm_pending_purchase` with a transaction-safe RPC such as `confirm_purchase_and_issue_voucher`.

The RPC should atomically:
- validate merchant ownership
- validate purchase is `pending`
- validate purchase has not expired
- update purchase to `payment_confirmed`
- generate or accept a safely generated voucher code
- insert exactly one voucher for the purchase
- insert audit event for payment confirmation
- insert audit event for voucher issuance
- return voucher code/link or a safe already-issued response

**Idempotency requirements:**
- enforce one voucher per `purchase_id`
- enforce unique voucher code
- handle double-click/retry safely
- return deterministic response if voucher already exists

**Target phase:** Week 4 Day 3-4 Voucher Issuance Service

---

### P1 — Gift card lifecycle policy: archive/delete/price-change rules

**Context:** Merchants may want to remove or change a fixed gift card/service, such as a tour, barber service, restaurant offer, or experience, after some buyers have already purchased it.

**Policy direction:**
- If a gift card has no purchases, hard delete may be allowed.
- If a gift card has purchases, vouchers, or redemptions, block hard delete.
- Allow deactivate/archive instead.
- Public pages must hide inactive/archived gift cards from new buyers.
- Existing purchases and vouchers must remain valid according to their own status and terms.
- Price changes must not affect historical purchases because `purchases.amount_cents` is the historical source of truth.

**Why:** Purchased gift cards are part of financial, consumer, and audit history. Hard deletion or retroactive price mutation can break dispute evidence, voucher display, reporting, and consumer trust.

**Target phase:** Before production hardening / gift card lifecycle polish

---

### P1 — Migration lint/check for shared updated_at trigger usage

**Context:** The `purchases` table had a `purchases_updated_at` trigger using `update_updated_at()`, but the table was missing an `updated_at` column. This caused purchase updates to fail.

**Future direction:** Add a migration/schema review checklist:
- every table using `update_updated_at()` must define `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- migrations should be reviewed for trigger/table-column consistency
- future CI may include schema linting for common trigger assumptions

**Target phase:** Before production hardening

---

## Stripe Checkout Recovery Tracking  
  
Track abandoned, failed, and expired Stripe Checkout attempts for `ONLINE/card` purchases.  
  
Current MVP behavior:  
- A pending `ONLINE/card` purchase is created before Stripe Checkout redirect.  
- Successful card payments are confirmed via verified Stripe webhook.  
- Voucher issuance happens automatically after webhook-confirmed payment.  
- Failed, abandoned, or expired Checkout attempts are not yet tracked as durable recovery events.  
  
Future slice should consider:  
- Store `stripe_checkout_session_id` on purchases or in a dedicated checkout-attempt table.  
- Handle `checkout.session.expired` and/or relevant failed payment events.  
- Track recovery state, such as:  
  - checkout status  
  - last failure reason, if safe and useful  
  - last reminder sent timestamp  
  - reminder count  
- Support at most one transactional recovery reminder before purchase expiry.  
- Ensure reminder language is transactional, not marketing-oriented.  
- Ensure GDPR-safe handling of buyer email and avoid logging PII.  
- Keep webhook confirmation as the only source of truth for successful card payment confirmation.  
  
Priority: Post-MVP / Stripe hardening.  
Owner lens: Architect + PO + Compliance.
