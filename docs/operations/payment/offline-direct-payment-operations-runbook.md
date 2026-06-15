# Offline / Direct Payment Operations Runbook

**Project:** ParaUsted  
**Area:** Payments / Offline Payments / Manual Verification / Support Operations  
**Date:** 2026-06-15  
**Recommended repo path:** `docs/operations/payment/offline-direct-payment-operations-runbook.md`  
**Status:** Operational runbook and future implementation planning note. No implementation included.

> **Important disclaimer:** This runbook is an operational and product-control guide. It is not legal, tax, accounting, or financial advice. Offline payment terms, refund obligations, merchant responsibilities, and buyer-facing policy wording should be reviewed by qualified Spain/EU counsel and finance/accounting advisors before broader production launch.

---

## 1. Purpose

This runbook defines how ParaUsted should handle manually verified offline/direct payments such as:

```text
Cash
Bizum direct
Bank transfer / IBAN
Other merchant-confirmed direct payment methods
```

Unlike Stripe card payments, these methods do not currently provide ParaUsted with reliable automatic payment/refund webhooks. Therefore, the correct V1 control model is:

```text
manual verification + audit trail + evidence notes + operational reports
```

not:

```text
automated provider reconciliation
```

---

## 2. Scope

This runbook applies to purchases where:

```text
payment_source = OFFLINE
```

and payment is confirmed outside ParaUsted by a merchant/operator/support user.

Typical methods:

```text
cash
Bizum
bank_transfer / IBAN
other configured direct methods
```

---

## 3. Core Difference From Stripe/Card Payments

### Stripe/Card

Stripe/card money movement can happen externally in Stripe Dashboard and Stripe sends machine-readable webhook events.

Therefore ParaUsted supports:

```text
Stripe refund webhook reconciliation
processed_webhooks idempotency
external refund fraud/support flags
platform/admin alerting
```

### Offline/Direct

For Cash/Bizum/IBAN, ParaUsted does not automatically know whether money was actually received or returned.

Therefore ParaUsted must rely on:

```text
merchant/support confirmation
audit_events
manual evidence notes
operational reconciliation reports
clear merchant responsibility
```

---

## 4. Current V1 Behavior

### 4.1 Offline purchase confirmation

When an offline payment is confirmed manually:

```text
purchase.status -> payment_confirmed
voucher is issued/generated
voucher becomes usable
business/audit events are recorded
```

### 4.2 Offline refund / void

When an offline refund is processed through ParaUsted support/merchant tooling:

```text
purchase.status -> refunded
purchase.refunded_at populated
voucher.status -> voided, if unused
redemptions are not deleted
business/audit events are recorded
```

### 4.3 Redeemed voucher safety

If the voucher has been redeemed, offline refund/void should not be treated as a normal safe refund.

Expected behavior:

```text
block normal refund/void flow
preserve voucher/redemption truth
handle as manual support/finance exception
```

---

## 5. Primary Offline Risks

Offline/direct payments have different risks from Stripe refunds.

### Risk A — Payment confirmed but money not received

Example:

```text
merchant confirms Bizum/cash/bank transfer before actually receiving money
voucher is issued
recipient redeems value
merchant later discovers no payment arrived
```

### Risk B — Money refunded externally but voucher not voided

Example:

```text
merchant returns cash/Bizum/bank transfer outside ParaUsted
merchant forgets to refund/void in ParaUsted
voucher remains usable
```

### Risk C — ParaUsted state says refunded but money was not returned

Example:

```text
merchant clicks refund/void in ParaUsted
but does not actually return money through cash/Bizum/bank transfer
```

### Risk D — Wrong purchase manually confirmed/refunded

Example:

```text
merchant confirms/refunds a similar reference code by mistake
```

### Risk E — Old pending offline purchases remain unresolved

Example:

```text
buyer submitted offline purchase request
merchant never confirms or rejects
purchase remains pending too long
```

---

## 6. Operational Principles

### 6.1 Preserve truth

Do not rewrite history to hide operational mistakes.

Never manually:

```text
delete redemptions
delete audit events
force refunded state after voucher redemption without support decision
change voucher status to hide a payment mistake
```

### 6.2 Offline money movement is merchant/support responsibility

ParaUsted records system state, but direct payment receipt/refund outside ParaUsted must be verified by the merchant/operator.

Recommended policy language:

```text
For direct/offline payment methods, the merchant is responsible for verifying receipt of funds and performing any external refund movement. ParaUsted records the voucher and purchase state based on merchant/support actions.
```

### 6.3 Evidence should be captured where possible

V1 may not yet enforce evidence fields, but operational users should record notes such as:

```text
Bizum transaction reference
bank transfer reference
cash receipt note
refund reference
operator initials / internal note
```

---

## 7. Manual Confirmation Checklist

Before confirming an offline payment, merchant/support should verify:

```text
correct reference_code
correct buyer/order amount
correct merchant/business
money actually received
payment method matches purchase/payment instructions
no duplicate confirmation exists
purchase is still pending and not expired/cancelled
```

Recommended evidence note:

```text
Payment confirmed by Bizum. Reference: <reference>. Amount checked: EUR <amount>. Confirmed by <operator>.
```

For cash:

```text
Cash received in store/tour desk. Amount checked: EUR <amount>. Confirmed by <operator>.
```

For bank transfer:

```text
Bank transfer received. Bank reference: <reference>. Amount checked: EUR <amount>. Confirmed by <operator>.
```

---

## 8. Manual Refund Checklist

Before refunding/voiding an offline payment in ParaUsted, merchant/support should verify:

```text
correct reference_code
voucher is unused / not redeemed
refund is permitted by merchant policy
external money return has happened or is about to happen
refund method is recorded
refund reason is recorded
support/merchant actor is known
```

Recommended evidence note:

```text
Offline refund completed via Bizum. Refund reference: <reference>. Amount EUR <amount>. Voucher verified unused and voided in ParaUsted.
```

If money has not yet been returned externally, do not mark the ParaUsted purchase refunded unless the operational policy explicitly allows recording refund state before external settlement.

---

## 9. What Not To Do

Do not:

```text
confirm offline payment based only on buyer screenshot without merchant verification
refund/void redeemed vouchers as normal refunds
delete redemption rows
edit audit history
send buyer or merchant accusation emails automatically
use Stripe refund reconciliation rules for offline payments
create fraud flags automatically merely because payment is offline
```

Offline risk is usually operational/process risk, not automatically fraud.

---

## 10. Recommended SQL Inspection Queries

### 10.1 Pending offline purchases

```sql
SELECT
  id,
  reference_code,
  status,
  payment_source,
  payment_method,
  amount_cents,
  currency,
  created_at,
  expires_at
FROM purchases
WHERE payment_source = 'OFFLINE'
  AND status = 'pending'
ORDER BY created_at ASC;
```

### 10.2 Confirmed offline purchases and voucher state

```sql
SELECT
  p.id AS purchase_id,
  p.reference_code,
  p.status AS purchase_status,
  p.payment_method,
  p.amount_cents,
  p.currency,
  p.created_at,
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
WHERE p.payment_source = 'OFFLINE'
  AND p.status = 'payment_confirmed'
GROUP BY
  p.id,
  p.reference_code,
  p.status,
  p.payment_method,
  p.amount_cents,
  p.currency,
  p.created_at,
  v.id,
  v.code,
  v.status,
  v.original_amount_cents,
  v.balance_cents
ORDER BY p.created_at DESC;
```

### 10.3 Refunded offline purchases

```sql
SELECT
  p.id AS purchase_id,
  p.reference_code,
  p.status AS purchase_status,
  p.refunded_at,
  p.payment_method,
  p.amount_cents,
  p.currency,
  v.code AS voucher_code,
  v.status AS voucher_status,
  v.balance_cents
FROM purchases p
LEFT JOIN vouchers v
  ON v.purchase_id = p.id
 AND v.merchant_id = p.merchant_id
WHERE p.payment_source = 'OFFLINE'
  AND p.status = 'refunded'
ORDER BY p.refunded_at DESC;
```

### 10.4 Offline audit events by reference code

```sql
SELECT
  event_type,
  actor_type,
  actor_id,
  entity_type,
  entity_id,
  payload,
  created_at
FROM audit_events
WHERE payload->>'reference_code' = '<reference_code>'
ORDER BY created_at ASC;
```

---

## 11. Future Implementation Slices

### 8b.6h-1 — Offline/direct payment operations runbook

Status:

```text
This document.
```

### 8b.6h-2 — Add offline confirmation evidence fields

Potential fields:

```text
payment_confirmed_at
payment_confirmation_note
payment_confirmation_reference
payment_confirmed_by
```

Alternative: keep evidence in `audit_events.payload` only.

### 8b.6h-3 — Add offline refund evidence fields

Potential fields:

```text
refund_method
refund_reference_note
refund_reason
refund_actor_note
```

Alternative: keep evidence in refund RPC parameters/audit payload.

### 8b.6h-4 — Pending offline purchase reminders/report

Recommended report:

```text
pending offline purchases older than X hours
pending offline purchases close to expiry
expired pending offline purchases
```

### 8b.6h-5 — Merchant dashboard reconciliation view

Possible filters:

```text
pending offline
confirmed offline
refunded offline
expired offline
manual refund required
```

### 8b.6h-6 — Platform/admin alerting for stale offline pending purchases

Only after the report/runbook exists.

---

## 12. What To Defer

Do not implement now:

```text
automatic bank/Bizum reconciliation
automatic fraud flags for all offline payments
buyer/merchant accusation emails
offline partial refund automation
ledger/payout reconciliation
direct bank API integration
cash drawer/accounting controls
```

These require additional provider, legal, finance, and accounting design.

---

## 13. Architect Notes

Offline/direct payments are manual-truth workflows.

Architecture should focus on:

```text
auditability
evidence capture
safe manual state transitions
reports
role boundaries
```

not provider webhook reconciliation unless a bank/Bizum provider integration is added later.

---

## 14. Product Owner Notes

For V1, direct/offline payments are merchant-supported payment methods.

Product policy should be clear:

```text
merchant confirms receipt
merchant performs external refund movement
ParaUsted records purchase/voucher state and audit trail
```

Do not promise automatic refund detection for cash/Bizum/IBAN.

---

## 15. PM Notes

Recommended order after Stripe alerting:

```text
1. Commit this offline/direct payment runbook.
2. Add lightweight confirmation/refund evidence fields or audit payload enrichment.
3. Add stale pending offline purchase report/reminder.
4. Add merchant reconciliation dashboard filters.
```

Keep this separate from the Stripe refund reconciliation/alerting epic to avoid scope mixing.

---

## 16. Final Operational Rule

For offline/direct payments:

```text
Do not automate what ParaUsted cannot observe.
Require merchant/support verification.
Record evidence.
Preserve audit truth.
Use reports and reminders to reduce operational mistakes.
```
