# ParaUsted Stripe Refund / Transfer Reversal Design Notes

**Date:** 2026-06-14
**Scope:** Stripe Connect online/card refund design discussion after Slice 8a offline refund completion.
**Status:** Planning / design-validation notes. No implementation included in this document.

---

## 1. Current Confirmed State

### Completed Before Stripe Refund Work

The offline refund foundation is complete and validated:

- `refund_offline_purchase(p_purchase_id UUID, p_reason TEXT)` is deployed and verified.
- Offline/direct refunds are DB-state only.
- Eligible `OFFLINE + payment_confirmed` purchases can be marked `refunded`.
- Their vouchers are moved to `voided`.
- Any redemption row blocks refund.
- Audit events are written:
  - `purchase_refunded`
  - `voucher_voided`
- No Stripe, ledger, payout, delivery, or email side effects were added in Slice 8a.

### Existing Stripe Architecture

Current ParaUsted Stripe flow uses **Stripe Connect destination charges** for V1 pilot:

- Checkout Session is created on the platform account.
- `payment_intent_data.transfer_data.destination` sends funds to the merchant connected account.
- Platform fee is currently `0` for the controlled pilot.
- Direct charges are deferred to post-pilot evaluation.
- Charge model must not be changed during the refund/prefix sprint.

Current stored identifiers:

- `purchases.stripe_payment_intent_id` exists.
- `merchants.stripe_account_id` exists.
- No current purchase columns for:
  - `stripe_refund_id`
  - `stripe_checkout_session_id`
  - `stripe_charge_id`
  - `stripe_transfer_id`

Installed Stripe package verification:

- Stripe package: `^22.2.0`
- Stripe API version in code: `2026-05-27.dahlia`
- Local Stripe typings expose refund creation params including `payment_intent`, `reverse_transfer`, and `refund_application_fee`.

---

## 2. Stripe Facts We Validated

Stripe’s Refund API can create a refund by specifying either a `Charge` or a `PaymentIntent`, and `payment_intent` is an official refund parameter. The Refund API also supports Connect-only parameters such as `reverse_transfer` and `refund_application_fee`. citeturn128search15

For destination charges, Stripe creates the charge on the platform account and transfers funds to the connected account via `transfer_data.destination`. In this model, the platform account is responsible for Stripe fees, refunds, and chargebacks. citeturn128search5

Stripe refund documentation states that refunds use the available Stripe balance, and for destination charges or separate charges and transfers, the platform is debited for refunds and should reverse transfers to recover the refund amount from connected accounts. citeturn128search6

Therefore, for ParaUsted V1 destination charges, the correct API shape is expected to be:

```ts
stripe.refunds.create(
  {
    payment_intent: stripePaymentIntentId,
    reverse_transfer: true,
    metadata: {
      purchase_id: purchaseId,
      refund_type: 'online_stripe',
    },
  },
  {
    idempotencyKey: `refund:${purchaseId}`,
  },
);
```

Important rules:

- Do **not** use the `stripeAccount` request option/header for this destination-charge refund path.
- Do **not** change the Stripe charge model during this sprint.
- Do **not** use `refund_application_fee` now because pilot platform fee is `0`.
- Future non-zero platform fees must revisit `refund_application_fee` behavior explicitly.

---

## 3. Main Risk: Stripe Dashboard Refunds Outside ParaUsted

A key risk was identified:

If a platform/support user refunds directly from the Stripe Dashboard and forgets to void the voucher in ParaUsted, the system can become inconsistent:

```text
Stripe money refunded ✅
ParaUsted purchase still payment_confirmed ❌
Voucher still issued/delivered ❌
Recipient can still redeem ❌
```

This is a **double-loss risk**.

### Pilot Operational Rule

For controlled pilot:

```text
All Stripe refunds must be initiated through ParaUsted only.
Do not refund directly from Stripe Dashboard unless the voucher is manually voided/reconciled immediately in ParaUsted.
```

This is acceptable only as a controlled pilot operational rule.

### Production Requirement

Before broader SaaS launch, ParaUsted needs Stripe refund reconciliation through webhook handling, for example events such as:

- `charge.refunded`
- `refund.updated`

The exact events should be confirmed in Stripe test mode before implementation.

Possible future reconciliation behavior:

```text
If external Stripe refund detected and voucher has no redemptions:
  purchase → refunded or external_refund_detected
  voucher → voided
  audit → external_refund_detected + voucher_voided

If external Stripe refund detected and voucher already redeemed:
  create fraud/support flag
  do not silently mutate
  audit → external_refund_conflict
```

This is deferred as a future hardening slice, tentatively:

```text
8b.6 — Stripe external refund webhook reconciliation
```

---

## 4. Recommended Slice Split

Do **not** implement Stripe refund/reversal in one large slice.

Recommended sub-slices:

```text
8b.0 — verification/discussion only
8b.1 — schema migration only
8b.2 — DB RPCs only
8b.3 — server action Stripe orchestration only
8b.4 — dashboard UI only
8b.5 — manual Stripe test matrix
8b.6 — external Stripe refund reconciliation webhook, before production/broader launch
```

Rationale:

- Stripe refund is a saga, not a single DB update.
- It includes unavoidable dual-write behavior: DB state + Stripe network side effect.
- Small slices reduce blast radius and make rollback/review easier.

---

## 5. 8b.1 — Minimum Schema Migration

Recommended minimum schema changes:

```text
purchases.status:
  add refund_pending
  add refund_failed

purchases:
  add stripe_refund_id TEXT NULL
```

Do **not** add these yet unless a later implementation proves they are required:

```text
stripe_checkout_session_id
stripe_charge_id
stripe_transfer_id
```

Reason:

- `stripe_payment_intent_id` is enough to create a pilot refund.
- `stripe_refund_id` is needed for audit/reconciliation and retry safety.
- Charge/transfer/session IDs are useful for future ledger/reconciliation, but not required for the pilot refund path.

No ledger, payout, delivery, or email changes in 8b.1.

---

## 6. 8b.2 — DB RPC Design

Add two RPCs:

```text
begin_online_refund(p_purchase_id UUID, p_reason TEXT)
finalize_online_refund(...)
```

No Stripe API call inside SQL.

### begin_online_refund

Responsibilities:

- `SECURITY DEFINER`
- safe `search_path = public, pg_temp`
- authenticated merchant only
- resolve merchant from `auth.uid()`
- merchant-scoped purchase lookup
- require `payment_source = 'ONLINE'`
- require `payment_method = 'card'`
- require `stripe_payment_intent_id IS NOT NULL`
- lock voucher `FOR UPDATE`
- reject if any redemption row exists for voucher and merchant
- require `balance_cents = original_amount_cents`
- set purchase status to `refund_pending`
- void voucher if not already voided
- audit:
  - `refund_initiated`
  - `voucher_voided` only if newly voided

### Re-entrant Recovery Behavior

We recommend **re-entrant `begin_online_refund`**, not a separate `resume_online_refund` RPC.

`begin_online_refund` should support:

```text
payment_confirmed — first refund attempt
refund_failed     — retry after prior Stripe failure
refund_pending    — resume/recover after crash before finalize
```

State-specific voucher expectations:

```text
payment_confirmed:
  voucher.status IN ('issued', 'delivered')
  then void voucher

refund_failed:
  voucher.status = 'voided'
  retry Stripe refund

refund_pending:
  voucher.status = 'voided'
  resume/recover Stripe refund/finalize
```

For V1, no new `refund_resume` event is required. Keep audit simple.

### finalize_online_refund

Responsibilities:

- authenticated merchant only
- merchant-scoped purchase lookup
- require `purchase.status = refund_pending`
- on success:
  - set `purchase.status = refunded`
  - set `refunded_at = now()`
  - store `stripe_refund_id`
  - audit `purchase_refunded`
- on failure:
  - set `purchase.status = refund_failed`
  - audit `refund_failed`
- never automatically unvoid voucher
- no ledger/payout/delivery/email side effects

---

## 7. 8b.3 — Server Action / Stripe Orchestration

The server action should orchestrate:

```text
begin_online_refund RPC
→ Stripe refund/recovery logic
→ finalize_online_refund RPC
```

### Required Stripe call behavior

```ts
stripe.refunds.create(
  {
    payment_intent: stripePaymentIntentId,
    reverse_transfer: true,
    metadata: {
      purchase_id: purchaseId,
      refund_type: 'online_stripe',
    },
  },
  {
    idempotencyKey: `refund:${purchaseId}`,
  },
);
```

Rules:

- Full refund only; omit `amount`.
- Use deterministic idempotency key: `refund:{purchase_id}`.
- No `stripeAccount` header/request option.
- No `refund_application_fee` while platform fee is `0`.
- Do not mark DB as `refunded` until Stripe success is known.
- If Stripe fails/throws, finalize DB as `refund_failed`.
- Do not log full voucher code, PII, secrets, card data, or full Stripe object payloads.

### Existing Refund Lookup Before Create

Opus identified a critical risk: Stripe idempotency keys are not a permanent guarantee. A delayed retry after the idempotency window could create a second refund if the prior refund succeeded but DB finalize failed.

Therefore retry/resume logic must:

1. If `stripe_refund_id` is already stored, retrieve/use it.
2. Else list existing Stripe refunds for the `payment_intent`.
3. If an existing refund is found, use that refund and finalize DB.
4. Only if no existing refund exists, call `stripe.refunds.create(...)`.

This closes the double-refund risk.

---

## 8. 8b.4 — Dashboard UI Rules

Only add UI after 8b.2 and 8b.3 are implemented and manually tested.

UI rules:

```text
ONLINE payment_confirmed → Refund
refund_pending           → status only, no duplicate button
refund_failed            → Retry Refund
refunded                 → status only
```

Offline 8a behavior must remain unchanged:

```text
OFFLINE pending           → Confirm / Reject
OFFLINE payment_confirmed → Refund / Void
OFFLINE refunded          → status only
```

Dashboard copy must clearly say:

- Stripe/card refund is processed through ParaUsted/Stripe.
- Voucher will be voided first to prevent redemption during refund.
- If refund fails, support can retry.
- Buyer self-service refund is not available in V1.

---

## 9. 8b.5 — Manual Test Matrix

Required tests before calling 8b complete:

- ONLINE/card `payment_confirmed` purchase with unredeemed full-balance voucher refunds end-to-end.
- Voucher becomes `voided` before or during refund process.
- Purchase becomes `refunded` only after Stripe success.
- `stripe_refund_id` stored.
- Any redemption row blocks refund before Stripe call.
- Double-click/double-submit does not create duplicate refund.
- Retry from `refund_failed` uses same deterministic path and existing-refund lookup.
- Recovery from `refund_pending` is possible.
- Voided voucher cannot be redeemed.
- Audit events exist:
  - `refund_initiated`
  - `voucher_voided` when newly voided
  - `purchase_refunded` on success
  - `refund_failed` on failure
- No ledger/payout/delivery/email side effects.
- No raw voucher code or PII in logs.

---

## 10. Future Care Items

### External Stripe Dashboard Refunds

Before broader launch, implement webhook reconciliation for external refunds. Pilot operational rule is not enough for production.

Potential future slice:

```text
8b.6 — Stripe external refund webhook reconciliation
```

### Ledger / Payout Accounting

Deferred for pilot. Revisit when platform fees, payouts, or accounting automation become active.

Future concerns:

- `refund_application_fee`
- ledger entries for refunds
- transfer reversal reconciliation
- charge/transfer/balance transaction IDs
- payout reversal or adjustment

### Feature Gating / SaaS Upsell

Separate SaaS feature-gating slice is still required before broader SaaS launch.

Premium / upsell features likely include:

- custom branded voucher prefix
- WhatsApp share
- email delivery
- Stripe/card payments
- merchant branding
- analytics

Default/free behavior remains:

```text
PU prefix
basic voucher page
direct/offline payments
limited active gift cards
```

Custom branded prefixes and WhatsApp share should be gated for Pro/pilot-enabled merchants later.

---

## 11. Final Decision

Current recommendation:

```text
GO WITH CHANGES for 8b.1 schema only.
Do not implement full Stripe refund yet.
```

Proceed next with:

```text
8b.1 schema migration only:
- add refund_pending
- add refund_failed
- add stripe_refund_id
```

Do not start RPC/server action/UI until this schema migration is reviewed, committed, pushed, deployed, and verified.

---

## 12. Current Open Decisions

Before 8b.2 RPC implementation:

1. Confirm exact `begin_online_refund` re-entrant behavior for `refund_pending`.
2. Define exact `finalize_online_refund` signature.
3. Define safe Stripe failure code payload shape.
4. Decide whether `refund_initiated` should be written again on `refund_failed → refund_pending` retry.
5. Decide how to identify an existing refund from `refunds.list({ payment_intent })` if multiple refunds exist in future partial-refund world. For V1 full-refund-only, first full refund for the payment intent should be sufficient.
6. Confirm operational rule: Stripe Dashboard refunds are prohibited during pilot unless manually reconciled immediately.
