# Slice 8b.6 Handoff — External Stripe Refund Reconciliation

**Project:** ParaUsted  
**Area:** Payments / Refunds / Stripe Connect / Webhook Reconciliation  
**Date:** 2026-06-15  
**Recommended repo path:** `docs/architecture/payment/stripe-refund-external-reconciliation-8b6-handoff.md`  
**Status:** Implementation, deployment, and sandbox validation completed.

---

## 1. Slice Summary

Slice 8b.6 hardens ParaUsted against the production-risk scenario where a Stripe refund is created outside ParaUsted, for example directly in the Stripe Dashboard.

Before this slice, the risk was:

```text
Stripe Dashboard refund succeeds
ParaUsted does not know
voucher remains issued/delivered
recipient can still redeem
```

After this slice, ParaUsted can reconcile Stripe refund lifecycle events:

```text
refund.created
refund.updated
refund.failed
```

and safely choose one of the following outcomes:

```text
unused voucher + full external refund -> auto-reconcile and void voucher
redeemed voucher + external refund    -> preserve state and open critical fraud/support flag
partial/mismatch/unknown states       -> flag for review
failed/canceled after existing flag   -> audit only, avoid noisy extra flags
```

---

## 2. Commits Included

```text
70dee43 feat(payment): add Stripe refund reconciliation RPC
8f31c62 feat(payment): reconcile Stripe refund webhook events
8b57440 fix(payment): deduplicate external refund fraud flags
```

Supporting prior commits:

```text
9552aed docs(payment): record refund policy and validation gates
46de4a6 fix(payment): hide online refund action for non-refundable vouchers
0957eb6 feat(payment): add online refund dashboard UI
a0c10b5 feat(payment): add online refund server action
2cb5139 feat(payment): add online refund saga RPCs
664ab7a docs(payment): record stripe refund saga design
```

---

## 3. Files / Areas Changed

### SQL migrations

```text
supabase/migrations/20260614000005_create_stripe_refund_reconciliation_rpc.sql
supabase/migrations/20260615000001_harden_stripe_refund_reconciliation_fraud_dedup.sql
```

### Webhook route

```text
src/app/api/webhooks/stripe/route.ts
```

No changes were made to:

```text
dashboard UI
Stripe refund helper/server action
ledger/payout
delivery/email
B2B API
buyer self-service flows
```

---

## 4. Architecture Design

### 4.1 Responsibility Split

```text
Stripe webhook route
  -> verifies signature
  -> parses Stripe refund event
  -> normalizes fields
  -> calls DB RPC

DB reconciliation RPC
  -> handles idempotency
  -> locks same refund_id processing
  -> maps purchase
  -> checks voucher/redemptions
  -> mutates safe states or creates fraud flags
  -> writes audit events
```

### 4.2 DB RPC

The DB function is:

```text
public.reconcile_stripe_refund_webhook(...)
```

It receives normalized fields:

```text
p_event_id
p_event_type
p_refund_id
p_refund_status
p_refund_amount_cents
p_currency
p_payment_intent_id
p_charge_id
p_purchase_id
```

Security properties:

```text
SECURITY DEFINER
SET search_path = public, pg_temp
service_role only
no Stripe/network call
no ledger/payout/delivery/email side effects
no redemption mutation
no broad EXCEPTION WHEN OTHERS
```

### 4.3 Event Idempotency and Fraud Dedup

The final architecture is layered:

```text
processed_webhooks
  = event-level idempotency

pg_advisory_xact_lock(refund_id)
  = same-refund concurrency protection

fraud_flags
  = de-duplicated support work queue

audit_events
  = append-only event history
```

This protects against Stripe sending multiple events for the same refund, such as `refund.created` followed by `refund.updated`.

---

## 5. Implemented Outcomes

### 5.1 External full refund + unused voucher

If Stripe sends a succeeded full refund for an unused voucher:

```text
purchase.status = refunded
purchase.refunded_at populated
purchase.stripe_refund_id stored
voucher.status = voided
audit: external_refund_detected
audit: voucher_voided
audit: purchase_refunded
```

### 5.2 External full refund + redeemed voucher

If Stripe sends a succeeded refund but the voucher already has redemptions:

```text
purchase remains payment_confirmed
voucher remains redeemed/consumed
purchase.stripe_refund_id remains null
fraud_flags.rule_code = external_refund_after_redemption
fraud_flags.severity = critical
audit: external_refund_conflict
```

This preserves factual truth and avoids hiding a financial conflict as a normal refund.

### 5.3 Partial / over-refund / currency mismatch / missing voucher

These are flagged for manual review:

```text
external_partial_refund_detected
external_refund_amount_mismatch
external_refund_currency_mismatch
external_refund_missing_voucher
external_refund_status_mismatch
```

No automatic partial refund behavior is implemented in V1.

### 5.4 Failed/canceled after existing conflict

If a refund is later canceled/failed after an existing open fraud flag for the same purchase/refund exists:

```text
no new status_mismatch fraud flag
audit external_refund_conflict
outcome = conflict_refund_terminal_after_existing_flag
existing flag remains open for manual review
```

No auto-clear is performed yet.

---

## 6. Sandbox Validation Evidence

### 6.1 External refund happy path

Test reference:

```text
reference_code: PU-KUMA-685X
purchase_id: 732764f6-ffe4-44a7-b51c-7e4c5c43ee97
payment_intent: pi_3TiFet9qrmo5WtYo1PEAV43I
refund_id: re_3TiFet9qrmo5WtYo1FpgJewo
amount_cents: 3000
```

Final verified state:

```text
purchase_status = refunded
stripe_refund_id = re_3TiFet9qrmo5WtYo1FpgJewo
voucher_status = voided
balance_cents = 3000
redemption_count = 0
```

Audit events verified:

```text
external_refund_detected
voucher_voided
purchase_refunded
```

Fraud flags:

```text
No rows returned
```

### 6.2 External refund after redemption conflict

Test reference:

```text
reference_code: PU-4Q8P-L22D
purchase_id: 5dfa370f-4594-4f47-9f7b-4a965268f63a
payment_intent: pi_3Tgn2u9qrmo5WtYo14FT9grm
refund_id: re_3Tgn2u9qrmo5WtYo1SI0nhUc
amount_cents: 2550
```

Final verified state:

```text
purchase_status = payment_confirmed
refunded_at = null
stripe_refund_id = null
voucher_status = redeemed
balance_cents = 0
redemption_count = 1
```

Fraud flag created:

```text
rule_code = external_refund_after_redemption
severity = critical
status = open
```

Audit event created:

```text
external_refund_conflict
conflict = refund_after_redemption
```

### 6.3 Refund cancellation observation

After canceling the external refund in Stripe Dashboard, Stripe emitted:

```text
refund.failed
refund_status = canceled
```

ParaUsted state remained safe:

```text
purchase_status = payment_confirmed
stripe_refund_id = null
voucher_status = redeemed
redemption_count = 1
```

The later 8b.6e hardening ensures that future canceled/failed events after an existing conflict are audit-only and do not create an additional noisy status-mismatch fraud flag.

---

## 7. Stripe Event Strategy

ParaUsted now handles:

```text
refund.created
refund.updated
refund.failed
```

`charge.refunded` remains intentionally deferred.

Sandbox testing showed the expected `refund.created` and `refund.updated` events for direct Stripe Dashboard refunds, so the `refund.*` strategy is validated for the current integration.

---

## 8. Refund Cancellation Strategy

Stripe refund cancellation is not a general remedy.

Architecture decision:

```text
Do not auto-cancel Stripe refunds from webhook in V1.
```

Reason:

```text
normal card refunds commonly complete quickly
succeeded refunds cannot be reliably canceled
cancel support should be a future manual platform-admin action only for requires_action refunds
```

Current ParaUsted remedy is:

```text
reconcile safe full unused refunds
flag redeemed/partial/conflict cases
manual support/finance review
```

---

## 9. Product Owner Perspective

Refund reconciliation is not a buyer entitlement feature. It is platform protection and merchant-support tooling.

The product rule remains:

```text
Refunds are merchant/support-controlled.
V1 supports full unused voucher refunds only.
Redeemed vouchers are not automatically refunded.
External Stripe Dashboard refunds are reconciled or flagged.
```

For personalized gift cards, refund availability remains policy/legal dependent and should not be advertised as universal.

---

## 10. PM Perspective

### Completed

```text
DB reconciliation RPC deployed
Webhook route wired for refund.* events
Sandbox happy path validated
Sandbox conflict path validated
Refund cancel observation captured
Fraud flag dedup hardening deployed and live-verified
```

### Not completed / future work

```text
platform/admin alerting for critical refund flags
support runbook
merchant notification workflow
manual refund cancel support for requires_action only
ledger/payout/platform-fee reconciliation
partial refund support
B2B refund API
admin support UI
```

### Recommended next slice

```text
8b.6f — support runbook and/or platform-admin alerting for critical refund conflicts
```

---

## 11. Remaining Operational Decision

Old duplicate sandbox fraud flags created before 8b.6e can be left as validation evidence, or later manually marked as cleared with a resolution note.

Recommended for now:

```text
Leave old sandbox duplicates unless they interfere with support testing.
```

---

## 12. Final Status

```text
External refund reconciliation: PASS
Webhook route refund.* wiring: PASS
External happy-path validation: PASS
External redeemed-conflict validation: PASS
Fraud flag dedup hardening: PASS
Production readiness: CONDITIONAL PASS pending alerting/support runbook
```
