# Refund Conflict Support Runbook

**Project:** ParaUsted  
**Area:** Payments / Refunds / Stripe Connect / Support Operations  
**Date:** 2026-06-15  
**Recommended repo path:** `docs/operations/payment/refund-conflict-support-runbook.md`  
**Status:** Operational runbook for support/platform review. No implementation included.

> **Important disclaimer:** This runbook is an operational support guide, not legal, tax, accounting, or financial advice. Escalate legal, consumer-rights, accounting, or merchant-liability questions to qualified advisors before final resolution.

---

## 1. Purpose

This runbook explains how ParaUsted platform/support should respond when external Stripe refund reconciliation creates a refund conflict flag.

The purpose is to protect against this risk:

```text
Money refunded in Stripe
+ voucher already redeemed or unsafe to void
= financial reconciliation conflict
```

The runbook covers:

```text
how to inspect fraud_flags
how to inspect audit_events
how to compare Stripe Dashboard evidence
how to decide whether to clear, confirm, or escalate
what not to mutate manually
how to document resolution
```

---

## 2. Who Should Use This Runbook

This runbook is for:

```text
ParaUsted platform support
ParaUsted operations/admin
technical support during Stripe refund incidents
future finance/reconciliation reviewers
```

It is not intended for buyers or public merchant-facing documentation.

---

## 3. When This Runbook Applies

Use this runbook when `fraud_flags` contains refund reconciliation rules such as:

```text
external_refund_after_redemption
external_partial_refund_detected
external_refund_amount_mismatch
external_refund_currency_mismatch
external_refund_missing_voucher
external_refund_mapping_ambiguous
external_refund_unmapped
external_refund_status_mismatch
```

Most critical case:

```text
external_refund_after_redemption
```

This means Stripe reported a refund, but ParaUsted already shows voucher value was consumed.

---

## 4. Key Principle

A refund conflict flag does **not** automatically mean customer fraud.

It means:

```text
Stripe money movement conflicts with ParaUsted voucher lifecycle state.
Manual review is required.
```

Possible causes include:

```text
platform support mistake
merchant/operator mistake
merchant goodwill refund
legal/customer-service exception
buyer abuse or suspected fraud
Stripe Dashboard refund outside ParaUsted process
```

---

## 5. Current System Behavior

### 5.1 Safe external refund

When an external Stripe refund is full and voucher is unused:

```text
purchase.status -> refunded
purchase.stripe_refund_id -> Stripe refund id
voucher.status -> voided
audit -> external_refund_detected, voucher_voided, purchase_refunded
fraud_flags -> none
```

### 5.2 Conflict external refund

When an external Stripe refund is detected after voucher redemption:

```text
purchase.status remains payment_confirmed
purchase.refunded_at remains null
purchase.stripe_refund_id remains null
voucher.status remains redeemed
redemption_count remains > 0
fraud_flags -> external_refund_after_redemption / critical
audit -> external_refund_conflict
```

This behavior is intentional. Do not force the purchase into a normal `refunded` state.

---

## 6. Triage Checklist

When a refund conflict flag appears:

1. Identify the fraud flag.
2. Confirm the Stripe refund id.
3. Confirm the purchase/reference code.
4. Confirm voucher status and redemption count.
5. Compare Stripe Dashboard evidence.
6. Determine who initiated the Stripe refund.
7. Decide resolution status.
8. Add a resolution note.
9. Escalate if needed.

---

## 7. SQL Inspection Queries

### 7.1 Inspect open refund conflict flags

```sql
SELECT
  id,
  purchase_id,
  merchant_id,
  rule_code,
  severity,
  description,
  evidence->>'reference_code' AS reference_code,
  evidence->>'refund_id' AS refund_id,
  evidence->>'payment_intent_id' AS payment_intent_id,
  evidence->>'refund_status' AS refund_status,
  evidence->>'refund_amount_cents' AS refund_amount_cents,
  evidence->>'voucher_status' AS voucher_status,
  evidence->>'redemption_count' AS redemption_count,
  status,
  created_at
FROM fraud_flags
WHERE status = 'open'
  AND rule_code LIKE 'external_refund%'
ORDER BY created_at DESC;
```

### 7.2 Inspect one purchase/voucher state

```sql
SELECT
  p.id AS purchase_id,
  p.reference_code,
  p.status AS purchase_status,
  p.refunded_at,
  p.payment_source,
  p.payment_method,
  p.amount_cents,
  p.currency,
  p.stripe_payment_intent_id,
  p.stripe_refund_id,
  v.id AS voucher_id,
  v.code AS voucher_code,
  v.status AS voucher_status,
  v.original_amount_cents,
  v.balance_cents,
  COUNT(r.id) AS redemption_count
FROM purchases p
JOIN vouchers v
  ON v.purchase_id = p.id
 AND v.merchant_id = p.merchant_id
LEFT JOIN redemptions r
  ON r.voucher_id = v.id
 AND r.merchant_id = v.merchant_id
WHERE p.id = '<purchase_id>'
GROUP BY
  p.id,
  p.reference_code,
  p.status,
  p.refunded_at,
  p.payment_source,
  p.payment_method,
  p.amount_cents,
  p.currency,
  p.stripe_payment_intent_id,
  p.stripe_refund_id,
  v.id,
  v.code,
  v.status,
  v.original_amount_cents,
  v.balance_cents;
```

### 7.3 Inspect audit evidence

```sql
SELECT
  event_type,
  actor_type,
  actor_id,
  entity_type,
  entity_id,
  payload->>'refund_id' AS refund_id,
  payload->>'refund_status' AS refund_status,
  payload->>'event_type' AS stripe_event_type,
  payload->>'event_id' AS stripe_event_id,
  payload->>'conflict' AS conflict,
  payload,
  created_at
FROM audit_events
WHERE payload->>'reference_code' = '<reference_code>'
  AND event_type IN (
    'external_refund_conflict',
    'external_refund_detected',
    'voucher_voided',
    'purchase_refunded',
    'external_partial_refund_detected',
    'refund_failed'
  )
ORDER BY created_at ASC;
```

### 7.4 Inspect processed Stripe refund webhook events

```sql
SELECT
  event_id,
  provider,
  event_type,
  processed_at
FROM processed_webhooks
WHERE event_type IN ('refund.created', 'refund.updated', 'refund.failed')
ORDER BY processed_at DESC
LIMIT 20;
```

---

## 8. Stripe Dashboard Checks

In Stripe Dashboard/Sandbox or Live mode, inspect:

```text
PaymentIntent id
Refund id
Refund amount
Refund status
Refund created timestamp
Refund actor / Dashboard event history if available
Charge id
Whether refund was full or partial
Whether refund was canceled/failed later
```

Do not rely only on the Stripe payment badge. Compare Stripe evidence with ParaUsted DB state and audit payload.

---

## 9. Decision Tree

### 9.1 `external_refund_after_redemption`

Meaning:

```text
Stripe refund succeeded after voucher value was already consumed.
```

Expected DB state:

```text
purchase remains payment_confirmed
voucher remains redeemed or partially_redeemed
stripe_refund_id remains null
fraud flag remains open until reviewed
```

Support action:

```text
identify refund origin
confirm whether refund was accidental or intentional
escalate if responsibility is unclear
record resolution note
```

Do not:

```text
mark purchase refunded manually
unredeem voucher
delete redemption rows
void/unvoid voucher manually
```

### 9.2 `external_partial_refund_detected`

Meaning:

```text
Stripe refund amount is less than ParaUsted purchase amount.
```

V1 policy:

```text
partial refunds are not supported automatically
```

Support action:

```text
review Stripe refund
confirm if partial refund was intentional
escalate for manual finance/product decision
```

### 9.3 `external_refund_amount_mismatch`

Meaning:

```text
Stripe refund amount exceeds or does not match purchase amount.
```

Support action:

```text
review Stripe transaction
confirm currency and amount
escalate to finance/platform admin
```

### 9.4 `external_refund_currency_mismatch`

Meaning:

```text
Stripe refund currency differs from purchase currency.
```

Support action:

```text
verify Stripe account/mode
verify payment intent
verify whether event belongs to ParaUsted purchase
escalate if mismatch is real
```

### 9.5 `external_refund_missing_voucher`

Meaning:

```text
Stripe refund maps to purchase, but ParaUsted cannot find associated voucher.
```

Support action:

```text
inspect checkout/session completion history
inspect voucher issuance audit
escalate to engineering if voucher generation failed
```

### 9.6 `external_refund_unmapped`

Meaning:

```text
Stripe refund event could not be mapped to a ParaUsted purchase.
```

Support action:

```text
check payment_intent_id in Stripe
confirm Stripe account/mode
confirm webhook endpoint environment
escalate if event belongs to a valid ParaUsted payment but mapping failed
```

### 9.7 `conflict_refund_terminal_after_existing_flag`

Meaning:

```text
Stripe later sent failed/canceled for a refund that already had an open conflict flag.
```

Support action:

```text
review whether the original conflict is still relevant
if cancellation resolved the money movement, consider clearing the flag with resolution note
if uncertainty remains, keep escalated/open
```

Do not auto-clear without review.

---

## 10. Resolution Status Guidance

Use the existing `fraud_flags.status` values:

```text
open
escalated
confirmed
cleared
```

### `open`

Use when:

```text
new conflict detected
not yet reviewed
```

### `escalated`

Use when:

```text
requires platform/merchant/finance/legal review
responsibility unclear
potential financial loss exists
```

### `confirmed`

Use when:

```text
real conflict or policy breach confirmed
loss/responsibility documented
```

### `cleared`

Use when:

```text
review completed and no further action required
merchant intentionally accepted the refund
Stripe refund was canceled and risk resolved
flag was sandbox/test validation noise
```

---

## 11. Resolution Note Examples

### Merchant goodwill refund

```text
Merchant intentionally refunded after voucher redemption as goodwill. No ParaUsted state mutation required. Merchant accepts cost.
```

### Platform mistake

```text
External Stripe Dashboard refund was created by platform support accidentally after voucher redemption. Platform accepts responsibility. Support process updated.
```

### Merchant mistake

```text
Merchant/operator refunded directly in Stripe Dashboard after voucher redemption. Merchant notified to use ParaUsted refund tooling only.
```

### Refund canceled later

```text
Stripe refund was later canceled. Purchase/voucher state remained unchanged. Conflict reviewed and cleared.
```

### Sandbox validation

```text
Sandbox validation artifact from external refund reconciliation testing. Cleared after confirming 8b.6e fraud flag dedup hardening.
```

---

## 12. Manual Resolution SQL Pattern

Use only after human review.

```sql
UPDATE fraud_flags
SET
  status = 'cleared',
  reviewed_at = now(),
  resolution_note = 'Sandbox validation artifact from external refund reconciliation testing. Cleared after confirming 8b.6e fraud flag dedup hardening.'
WHERE id = '<fraud_flag_id>'
  AND status = 'open';
```

For production conflicts, prefer `confirmed` or `escalated` unless the issue is genuinely resolved.

---

## 13. What Not To Do

Do not manually:

```text
set purchase.status = refunded for redeemed voucher conflicts
delete redemption rows
change voucher.status from redeemed to voided to hide the conflict
remove audit events
delete fraud_flags
email buyer with fraud language
assign liability without review
call Stripe refund cancel automatically from webhook
```

Preserve truth first. Use `fraud_flags.resolution_note` for the business decision.

---

## 14. Merchant Communication Guidance

In V1, do not automatically email merchants for every conflict.

Recommended flow:

```text
platform receives/reviews conflict
platform determines whether merchant action is needed
platform contacts merchant with clear, non-technical wording
```

Avoid wording like:

```text
fraud detected by your customer
```

Prefer wording like:

```text
A payment/voucher reconciliation exception was detected. A Stripe refund appears to have been created after the voucher was already used. Please review this case with support.
```

---

## 15. Alerting Guidance

Future platform/admin alerting should notify platform ops/support first for critical flags.

Recommended first alert scope:

```text
external_refund_after_redemption
external_refund_mapping_ambiguous
external_refund_amount_mismatch
external_refund_currency_mismatch
external_refund_missing_voucher
```

Do not alert buyers.

Merchant alerts should come later, after platform triage workflow and wording are approved.

---

## 16. Architect Notes

```text
fraud_flags = de-duplicated work queue
audit_events = immutable event history
processed_webhooks = event-level idempotency
pg_advisory_xact_lock(refund_id) = same-refund concurrency safety
```

Do not convert fraud flags into automatic state mutations without a dedicated design.

---

## 17. Product Owner Notes

Refund conflict handling is a trust and liability workflow.

Do not position conflict flags as buyer fraud by default. They are reconciliation exceptions that require review.

Refunds remain:

```text
merchant/support-controlled
policy/legal dependent
full unused voucher only in V1
```

---

## 18. PM Notes

Before broader production launch, ParaUsted should have:

```text
support runbook committed
platform/admin alerting path
clear merchant communication guidance
legal-reviewed refund policy wording
process for clearing/confirming/escalating fraud_flags
```

Recommended next slice after this runbook:

```text
8b.6g — platform/admin alerting for critical refund conflicts
```

---

## 19. Final Operational Rule

When a refund conflict is detected:

```text
Do not rewrite history.
Do not silently mutate purchase/voucher/redemption state.
Review evidence.
Decide responsibility.
Record resolution.
Escalate if uncertain.
```
