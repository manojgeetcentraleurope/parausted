# Stripe Refund Validation and Launch Gates

**Project:** ParaUsted  
**Area:** Payments / Refunds / Stripe Connect  
**Date:** 2026-06-14  
**Recommended repo path:** `docs/architecture/payment/stripe-refund-validation-and-launch-gates.md`  
**Status:** Validation evidence and launch-gate note after offline + online refund saga implementation.

---

## 1. Purpose

This document records the validation evidence, launch gates, operational rules, and remaining risks for ParaUsted refund handling after the refund foundation work.

It covers:

- Offline/direct refund validation.
- Online Stripe/card refund validation.
- Happy-path and negative-path evidence.
- Audit evidence requirements.
- Pilot launch rules.
- Production hardening requirements.
- Architect, Product Owner, and PM learning notes.

This document is intentionally **evidence and governance focused**. It does not introduce new code, SQL, or product scope.

---

## 2. Implemented Refund Capabilities

### 2.1 Offline / Direct Refunds

Offline refunds apply to:

- Cash.
- Bizum direct.
- Bank transfer / IBAN.

Implemented behavior:

```text
OFFLINE payment_confirmed purchase
+ voucher issued/delivered
+ no redemptions
+ full balance
+ required reason
→ purchase.status = refunded
→ purchase.refunded_at populated
→ voucher.status = voided
→ audit events written
```

Important product meaning:

```text
ParaUsted updates DB state only.
Actual money return for offline payments is handled outside ParaUsted by merchant/support.
```

### 2.2 Online / Stripe Card Refunds

Online refunds apply to:

- `payment_source = ONLINE`
- `payment_method = card`
- Stripe Connect destination-charge purchases.

Implemented behavior:

```text
ONLINE/card payment_confirmed purchase
+ voucher issued/delivered
+ no redemptions
+ full balance
+ Stripe payment_intent present
+ required reason
→ begin_online_refund voids voucher and moves purchase to refund_pending
→ server action performs Stripe refund orchestration
→ finalize_online_refund marks purchase refunded on Stripe success
→ stripe_refund_id stored
→ audit events written
```

The UI supports:

```text
ONLINE payment_confirmed -> Refund card payment
ONLINE refund_pending    -> Processing/status only
ONLINE refund_failed     -> Retry Refund
ONLINE refunded          -> Status only
```

---

## 3. Implementation Timeline / Commits

Relevant refund commits:

```text
593a566 feat(payment): add offline refund void RPC
bc430f2 feat(payment): add offline refund void action
0c2cd6e feat(payment): add online refund schema states
664ab7a docs(payment): record stripe refund saga design
2cb5139 feat(payment): add online refund saga RPCs
a0c10b5 feat(payment): add online refund server action
0957eb6 feat(payment): add online refund dashboard UI
46de4a6 fix(payment): hide online refund action for non-refundable vouchers
```

Related preceding voucher/share commits:

```text
0b2cb07 feat(voucher): add whatsapp share links
01d0d4a feat(voucher): update app validation for custom prefixes
c54f1d5 feat(gift-card): add prefix field to admin form
ddd13ba feat(voucher): accept custom prefix in lookup and redemption
ebd8bff feat(voucher): support custom prefix in generation RPCs
89a9b96 feat(gift-card): add voucher code prefix column
```

---

## 4. Offline Refund Validation Evidence

### 4.1 Happy Path Tested

Test reference:

```text
reference_code: PU-84TL-EJQU
purchase_id: b8908ee9-fe2f-4678-b559-8b00fc0e03f3
voucher_id: 62bccecb-ea0b-4e1f-8e17-b3492e199366
voucher_code: ST-GC-LUX-8E5A-D1F7-BCA3
payment_source: OFFLINE
payment_method: cash
amount_cents: 3000
```

Final verified state:

```text
purchase_status = refunded
refunded_at != null
voucher_status = voided
original_amount_cents = 3000
balance_cents = 3000
redemption_count = 0
```

Audit events verified:

```text
purchase_refunded
voucher_voided
```

Audit payload included:

```text
reason
voucher_id
purchase_id
refund_type = offline_manual
amount_cents
voucher_code
reference_code
```

Redeem safety verified:

```text
Voucher remained voided.
redemption_count = 0.
A voided voucher cannot be redeemed.
```

### 4.2 Negative Path Tested — Redeemed Voucher

Test reference:

```text
reference_code: PU-R9VX-32QC
voucher_code: PU-1D54-740E-9CC8
payment_source: OFFLINE
voucher_status: redeemed
balance_cents: 0
redemption_count: 1
```

Final verified state after blocked refund attempt:

```text
purchase_status remained payment_confirmed
refunded_at remained null
voucher_status remained redeemed
balance_cents remained 0
redemption_count remained 1
```

Side-effect check:

```text
No purchase_refunded audit event.
No voucher_voided audit event.
```

Result:

```text
PASS — redeemed vouchers cannot be refunded.
```

---

## 5. Online Stripe Refund Validation Evidence

### 5.1 Happy Path Tested

Test reference:

```text
reference_code: PU-VL7B-66W8
purchase_id: dfed98bd-1406-4374-8b46-27e60fee99bf
voucher_id: 074bbb03-f34f-4903-83a2-088daf94b44f
voucher_code: PU-8508-2BF0-A8B0
payment_source: ONLINE
payment_method: card
amount_cents: 2550
stripe_payment_intent_id: pi_3TglDC9qrmo5WtYo1mpea84d
stripe_refund_id: re_3TglDC9qrmo5WtYo1AiNwtPC
```

Final verified state:

```text
purchase_status = refunded
refunded_at = 2026-06-14 18:39:06.680057+00
stripe_refund_id = re_3TglDC9qrmo5WtYo1AiNwtPC
voucher_status = voided
original_amount_cents = 2550
balance_cents = 2550
redemption_count = 0
```

Audit events verified in order:

```text
refund_initiated
voucher_voided
purchase_refunded
```

Audit payload evidence:

```text
refund_type = online_stripe
stripe_payment_intent_id present
stripe_refund_id present on purchase_refunded
reason = stripe refund test
reference_code = PU-VL7B-66W8
```

Redeem safety verified:

```text
Redeem attempt returned: This voucher has been voided.
```

Result:

```text
PASS — online Stripe refund happy path completed and voucher is no longer redeemable.
```

### 5.2 Negative Path Tested — Redeemed Online Voucher

Test reference:

```text
reference_code: PU-4Q8P-L22D
purchase_id: 5dfa370f-4594-4f47-9f7b-4a965268f63a
voucher_id: 22e0d120-e10d-47ef-9eae-747d0694a082
voucher_code: PU-6CC1-31F6-28A7
payment_source: ONLINE
payment_method: card
amount_cents: 2550
stripe_payment_intent_id: pi_3Tgn2u9qrmo5WtYo14FT9grm
```

Initial state:

```text
purchase_status = payment_confirmed
refunded_at = null
stripe_refund_id = null
voucher_status = redeemed
balance_cents = 0
redemption_count = 1
```

After blocked refund attempt:

```text
purchase_status remained payment_confirmed
refunded_at remained null
stripe_refund_id remained null
voucher_status remained redeemed
balance_cents remained 0
redemption_count remained 1
```

UI behavior after 8b.4a fix:

```text
Refund card payment button is hidden for clearly non-refundable redeemed voucher.
No Retry Refund button appears.
No mutation action is offered.
```

Result:

```text
PASS — redeemed online vouchers cannot be refunded and the UI no longer offers an invalid refund action.
```

---

## 6. Current Launch Gates

### 6.1 Pilot Launch Gates — Required

Before pilot usage with real Stripe refunds, the following must be enforced operationally:

```text
All Stripe refunds must be initiated through ParaUsted.
Do not refund directly through Stripe Dashboard unless manually reconciled immediately.
Support/merchant must provide a reason for each refund.
Only full 100% refunds are allowed in V1.
No partial/custom/90% refunds.
No buyer self-service refunds.
```

### 6.2 Production Launch Gates — Required Before Broader SaaS Launch

Before broader SaaS launch, implement or document:

```text
Stripe external refund webhook reconciliation.
Operational runbook for refund_pending and refund_failed.
Support policy for pending refunds.
Support policy for failed refunds.
Ledger/payout strategy if platform fees or automated payouts become active.
Feature-gating for premium SaaS capabilities.
```

---

## 7. Known Limitations

### 7.1 External Stripe Dashboard Refunds

Current limitation:

```text
If a refund is created directly in Stripe Dashboard, ParaUsted may not know immediately.
The voucher could remain active unless manually reconciled.
```

Pilot mitigation:

```text
App-only refunds during pilot.
Manual reconciliation if Stripe Dashboard is used accidentally.
```

Required future slice:

```text
8b.6 — Stripe external refund webhook reconciliation
```

### 7.2 Pending Refund Recovery

If Stripe returns a pending refund state:

```text
purchase remains refund_pending
voucher remains voided
UI shows processing/status only
```

Recovery depends on re-invocation of the server action, and future webhook reconciliation may improve this.

### 7.3 Ledger / Payout / Fee Handling

Deferred:

```text
ledger refund entries
payout reconciliation
transfer reversal reporting
refund_application_fee for non-zero platform fee
charge/transfer/balance transaction id storage
```

### 7.4 Component Complexity

`purchase-manager.tsx` has grown and should later be refactored into smaller pieces:

```text
purchase table
status badges
payment badges
dialogs
error mapping helpers
```

Do not refactor inside current money-state slices unless necessary.

---

## 8. Architect Notes

### 8.1 Key Architecture Principles Preserved

```text
DB RPCs are the source of truth.
UI is a state-aware caller, not the authority.
Voucher is voided before Stripe refund completion.
Stripe refund state is handled through a saga.
refund_pending and refund_failed are recoverable states.
Audit events are append-only.
No redemptions are mutated.
No ledger/payout side effects were introduced.
```

### 8.2 Why UI Guard Was Added

The negative online test showed a redeemed voucher still displayed a refund button. The backend correctly blocked it, but UI should not invite invalid actions.

The fix added best-effort UI eligibility signals:

```text
voucher_status
voucher_balance_cents
voucher_original_amount_cents
```

The UI now fails closed when voucher eligibility is unclear.

### 8.3 What Remains Architecturally Important

The UI guard must never be treated as the source of truth. Race conditions still require RPC validation:

```text
voucher FOR UPDATE
redemptions existence check
balance invariant
merchant-scoped purchase/voucher lookup
```

---

## 9. Product Owner Notes

### 9.1 Product Rules Locked for V1

```text
Full 100% refund only.
No partial refund.
No custom percentage refund.
No 90% refund.
No buyer self-service refund.
Reason required.
Voucher must be unused.
Voucher is voided on refund.
```

### 9.2 Merchant Trust

The dashboard now guides merchants toward valid actions:

```text
Refund button appears only for apparently refundable online vouchers.
Redeemed vouchers do not invite a refund action.
Failed online refunds can be retried.
Pending refunds are clearly processing.
```

### 9.3 SaaS / Upsell Reminder

Separate feature-gating work is still needed for broader SaaS launch:

```text
custom branded prefixes
WhatsApp share
email delivery
Stripe/card payments
merchant branding
analytics
```

Do not mix refund logic with SaaS plan enforcement until a dedicated feature-gating slice.

---

## 10. PM Notes

### 10.1 Validation Completed

Validated:

```text
offline happy path
offline redeemed negative path
online happy path
online redeemed negative path
voided voucher redemption block
audit events
UI guard for non-refundable online voucher
```

### 10.2 Recommended Next Steps

Recommended next slice:

```text
8b.6 — external Stripe refund webhook reconciliation planning/discovery
```

Alternative before that:

```text
Create a short operational runbook for support:
- how to process refunds
- when not to use Stripe Dashboard
- how to handle refund_pending
- how to handle refund_failed
```

### 10.3 Release Notes Draft

```text
Refund foundation is ready for controlled pilot:
- merchants can refund eligible offline/direct purchases
- merchants can refund eligible Stripe/card purchases
- redeemed vouchers block refunds
- refunded vouchers are voided and cannot be redeemed
- audit trail records refund decisions
```

Do not announce broader production readiness until external Stripe Dashboard refund reconciliation and operational runbooks are complete.

---

## 11. Final Status

```text
Offline refund foundation: PASS
Online Stripe refund saga: PASS for happy path and redeemed negative path
Dashboard UI: PASS after non-refundable voucher guard
Audit evidence: PASS
Pilot readiness: CONDITIONAL PASS with operational guardrails
Production readiness: NOT YET — needs webhook reconciliation and runbook
```
