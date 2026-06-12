# Payment Confirmation, Voucher Issuance, And Delivery Queue Flow

## Status

State: implemented and hardened.

This document describes the confirmed ParaUsted flow from purchase confirmation to voucher issuance and delivery event queuing.

The flow is designed around these invariants:

- Manual merchant confirmation is only for `OFFLINE` purchases.
- Stripe webhook confirmation is only for `ONLINE` / `card` purchases.
- A purchase can produce at most one voucher.
- Voucher issuance is atomic with purchase confirmation.
- Delivery events are queued centrally after voucher insertion.
- Deprecated confirm-only purchase confirmation is no longer executable.
- Money-state RPCs are restricted by least privilege.

## Scope

This document covers:

- pending purchase confirmation
- offline/manual confirmation
- online/Stripe confirmation
- cancellation/rejection
- voucher issuance
- delivery event queuing
- audit events
- idempotency and duplicate prevention
- permission boundaries

This document does not cover:

- Stripe Connect onboarding details
- email provider production rollout
- real-recipient email enablement
- redemption flow internals
- refund handling
- payout handling

## Core Business Flow

The intended business flow is:

```text
Buyer creates pending purchase
Merchant/platform confirms payment
Voucher is issued
Voucher insert queues delivery event
Delivery worker sends voucher
Buyer receives voucher
```

The implementation intentionally separates payment confirmation paths:

```text
OFFLINE/manual payment -> merchant dashboard RPC
ONLINE/card payment    -> Stripe webhook RPC
```

Both confirmation paths converge at the same voucher table.

Both paths rely on the voucher insert trigger to queue delivery.

## Key Invariants

### One Purchase Produces At Most One Voucher

The `vouchers` table enforces this at database level:

```text
purchase_id UUID UNIQUE NOT NULL REFERENCES purchases(id)
```

This means even if application code or a concurrent request retries, the database prevents two vouchers for the same purchase.

### Voucher Codes Are Unique

The `vouchers` table also enforces unique voucher codes:

```text
code TEXT UNIQUE NOT NULL
```

The confirmation RPCs generate crypto-random voucher codes and retry on rare collisions.

### Delivery Is Queued Centrally

Delivery is not manually duplicated in each payment path.

Instead:

```text
INSERT INTO vouchers
  -> trigger trg_queue_delivery_event_for_voucher
  -> INSERT INTO delivery_events
```

The trigger uses a unique index on `(voucher_id, channel)` so the same voucher/channel delivery queue row cannot be created twice.

### Manual Confirmation Is Offline Only

The merchant-facing RPC:

```text
public.confirm_purchase_and_issue_voucher(UUID)
```

is restricted to authenticated merchants and enforces:

```text
payment_source = 'OFFLINE'
```

If the purchase is not offline, it returns:

```text
invalid_payment_source
```

This prevents manual confirmation of online/card purchases.

### Stripe Confirmation Is Online Card Only

The Stripe webhook RPC:

```text
public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT)
```

is service-role only and enforces:

```text
payment_source = 'ONLINE'
payment_method = 'card'
```

This prevents Stripe webhook logic from confirming offline/manual purchases.

### Deprecated Confirm-Only RPC Is Disabled

The older RPC:

```text
public.confirm_pending_purchase(UUID)
```

is no longer executable by:

```text
PUBLIC
anon
authenticated
```

This prevents a purchase from being moved to `payment_confirmed` without voucher issuance.

## Manual Offline Confirmation Flow

Manual confirmation starts in the merchant dashboard.

Relevant application files:

```text
src/app/[locale]/dashboard/purchases/actions.ts
src/app/[locale]/dashboard/purchases/purchase-manager.tsx
```

The dashboard action checks that the purchase is pending and offline before calling the RPC.

The database remains the final authority.

Manual confirmation uses:

```text
public.confirm_purchase_and_issue_voucher(UUID)
```

### Manual Confirmation RPC Responsibilities

The manual RPC is responsible for:

1. Reading `auth.uid()`.
2. Resolving the merchant from `merchants.auth_user_id`.
3. Loading the purchase in merchant scope.
4. Rejecting non-offline purchases.
5. Returning an existing voucher if one already exists.
6. Verifying the purchase is still `pending`.
7. Verifying the purchase is not expired.
8. Resolving voucher expiry from the gift card validity.
9. Updating the purchase with compare-and-swap semantics.
10. Generating a voucher code.
11. Inserting one voucher.
12. Writing `purchase_confirmed` audit event.
13. Writing `voucher_issued` audit event.
14. Returning the voucher code.

### Manual RPC Permission Boundary

Verified remote DB permission state:

```text
confirm_purchase_and_issue_voucher:
  authenticated = true
  anon = false
  public = false
```

This means only authenticated users can execute the merchant-facing confirmation RPC.

The RPC also derives merchant ownership from `auth.uid()` and does not trust merchant IDs from the client.

## Manual Cancellation / Rejection Flow

Merchant rejection/cancellation uses:

```text
public.cancel_pending_purchase(UUID, TEXT)
```

This RPC remains available to authenticated merchants only.

Verified remote DB permission state:

```text
cancel_pending_purchase:
  authenticated = true
  anon = false
  public = false
```

The purpose of this RPC is to cancel/reject a pending purchase without issuing a voucher.

It must not be executable by anonymous users.

## Deprecated Confirm-Only RPC

The old RPC:

```text
public.confirm_pending_purchase(UUID)
```

was created before atomic voucher issuance existed.

It is now deprecated because it can confirm a purchase without issuing a voucher.

Verified remote DB permission state:

```text
confirm_pending_purchase:
  authenticated = false
  anon = false
  public = false
```

Do not use this RPC in new code.

Do not re-grant access to it.

If future cleanup is desired, this function may be replaced with a deprecated error or removed in a controlled migration after confirming no dependencies remain.

## Stripe Online/Card Confirmation Flow

Stripe confirmation starts from:

```text
src/app/api/webhooks/stripe/route.ts
```

The route validates the Stripe webhook and only processes successful paid checkout sessions.

The route calls:

```text
public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT)
```

using the trusted server-side admin client.

### Stripe RPC Responsibilities

The Stripe RPC is responsible for:

1. Validating input.
2. Recording the Stripe event in `processed_webhooks`.
3. Suppressing duplicate Stripe webhook events.
4. Loading the purchase.
5. Enforcing `ONLINE` / `card`.
6. Returning an existing voucher if one already exists.
7. Verifying purchase status and expiry.
8. Resolving voucher expiry.
9. Updating purchase status with compare-and-swap semantics.
10. Generating and inserting the voucher.
11. Writing `purchase_confirmed` audit event with system/Stripe actor.
12. Writing `voucher_issued` audit event with system/Stripe actor.
13. Allowing Stripe retries for transient failures.

### Stripe RPC Permission Boundary

The Stripe RPC is service-role only.

Expected permission model:

```text
confirm_stripe_purchase_and_issue_voucher:
  service_role = true
  authenticated = false
  anon = false
  public = false
```

This prevents clients from directly invoking Stripe confirmation logic.

## Voucher Issuance

Both manual and Stripe confirmation paths insert into:

```text
public.vouchers
```

Important voucher table constraints:

```text
purchase_id UNIQUE
code UNIQUE
balance_cents <= original_amount_cents
status IN ('issued','delivered','partially_redeemed','redeemed','exchanged','expired','voided')
```

The initial voucher status is:

```text
issued
```

Voucher issuance should only happen after payment confirmation succeeds.

## Delivery Event Queue

Delivery event queueing is centralized in:

```text
public.queue_delivery_event_for_voucher()
```

Trigger:

```text
trg_queue_delivery_event_for_voucher
AFTER INSERT ON public.vouchers
```

The trigger inserts into:

```text
public.delivery_events
```

The delivery queue does not send email directly.

It only creates the queued delivery event that the worker later processes.

### Duplicate Delivery Prevention

The delivery queue has a unique index:

```text
delivery_events(voucher_id, channel)
WHERE voucher_id IS NOT NULL
```

The insert uses conflict handling:

```text
ON CONFLICT (voucher_id, channel) WHERE voucher_id IS NOT NULL DO NOTHING
```

This prevents duplicate initial delivery events for the same voucher/channel.

## Audit Events

Manual confirmation writes audit events with:

```text
actor_type = merchant
actor_id = authenticated user id
```

Stripe confirmation writes audit events with:

```text
actor_type = system
actor_id = stripe_webhook
```

Required audit events:

```text
purchase_confirmed
voucher_issued
```

The `voucher_issued` event should be linked to the voucher entity where possible.

## Idempotency Strategy

### Manual Confirmation

Manual confirmation idempotency is based on:

- merchant-scoped purchase lookup
- existing voucher check
- `purchase_id UNIQUE` on vouchers
- compare-and-swap update on purchase status
- voucher insert conflict handling

If a voucher already exists, the RPC returns it instead of issuing another voucher.

### Stripe Confirmation

Stripe confirmation idempotency is based on:

- `processed_webhooks`
- Stripe event ID
- existing voucher check
- `purchase_id UNIQUE` on vouchers
- compare-and-swap update on purchase status

Permanent Stripe errors can mark the webhook as processed.

Transient errors should roll back so Stripe can retry.

## Security Boundaries

### Manual Merchant Boundary

Manual merchant confirmation must satisfy all of the following:

```text
caller is authenticated
caller maps to a merchant profile
purchase belongs to that merchant
purchase is pending
purchase is OFFLINE
purchase is not expired
```

### Stripe Boundary

Stripe confirmation must satisfy all of the following:

```text
request has valid Stripe signature
event is supported
payment status is paid
purchase exists
purchase is pending
purchase is ONLINE/card
function is invoked through service_role only
```

### Cancellation Boundary

Cancellation must satisfy:

```text
caller is authenticated
caller maps to a merchant profile
purchase belongs to that merchant
purchase is pending
```

Cancellation must not issue a voucher.

## Verification Queries

### Function Permission Verification

```sql
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'confirm_purchase_and_issue_voucher',
    'confirm_pending_purchase',
    'cancel_pending_purchase'
  )
ORDER BY p.proname, arguments;
```

Expected result:

```text
cancel_pending_purchase:
  authenticated = true
  anon = false
  public = false

confirm_pending_purchase:
  authenticated = false
  anon = false
  public = false

confirm_purchase_and_issue_voucher:
  authenticated = true
  anon = false
  public = false
```

### Manual RPC Offline Guard Verification

```sql
SELECT
  p.proname AS function_name,
  position('payment_source' IN pg_get_functiondef(p.oid)) > 0 AS mentions_payment_source,
  position('invalid_payment_source' IN pg_get_functiondef(p.oid)) > 0 AS has_invalid_payment_source_error,
  position('OFFLINE' IN pg_get_functiondef(p.oid)) > 0 AS has_offline_guard,
  position('confirm_pending_purchase' IN pg_get_functiondef(p.oid)) > 0 AS unexpected_legacy_reference
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'confirm_purchase_and_issue_voucher';
```

Expected result:

```text
mentions_payment_source = true
has_invalid_payment_source_error = true
has_offline_guard = true
unexpected_legacy_reference = false
```

### Voucher Uniqueness Verification

```sql
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.vouchers'::regclass
  AND contype IN ('u', 'p', 'f', 'c')
ORDER BY conname;
```

Expected evidence should include:

```text
purchase_id unique
code unique
purchase_id references purchases(id)
```

### Delivery Event Duplicate Prevention Verification

```sql
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'delivery_events'
  AND indexname = 'idx_delivery_events_unique_voucher_channel';
```

Expected evidence:

```text
unique index on voucher_id, channel
where voucher_id is not null
```

## Operational Rules

Do not manually update purchase status in application code.

Do not issue vouchers directly from UI code.

Do not queue delivery events directly from manual or Stripe confirmation paths.

Do not re-enable `confirm_pending_purchase(UUID)` for authenticated or anonymous users.

Do not allow manual RPC confirmation of online/card purchases.

Do not allow Stripe webhook RPC confirmation of offline purchases.

Do not enable real-recipient email delivery unless the email rollout gate is approved.

## Failure Handling

### Manual Confirmation Failure

If manual confirmation returns an error:

```text
unauthorized
not_found
invalid_payment_source
already_processed
expired
unknown
```

The dashboard should show a safe localized error.

No voucher should be issued unless the RPC returns success with a voucher code.

### Stripe Confirmation Failure

If Stripe confirmation returns a permanent error, Stripe retries may be suppressed depending on the failure type.

If Stripe confirmation raises a transient database error, the route should return an error and Stripe should retry.

### Delivery Queue Failure

Voucher issuance should not directly depend on provider email delivery.

The delivery event remains a separate operational step.

Delivery worker retries and delivery status visibility are handled by the delivery worker design.

## Acceptance Criteria

- [ ] Manual confirmation RPC is authenticated-only.
- [ ] Manual confirmation RPC enforces `payment_source = 'OFFLINE'`.
- [ ] Deprecated `confirm_pending_purchase(UUID)` is not executable by authenticated, anon, or public.
- [ ] Cancellation RPC is authenticated-only.
- [ ] Stripe confirmation RPC remains service-role only.
- [ ] Stripe confirmation RPC enforces online/card payment.
- [ ] Voucher table enforces one voucher per purchase.
- [ ] Voucher table enforces unique voucher codes.
- [ ] Voucher insert queues delivery event centrally.
- [ ] Delivery event duplicate prevention exists for voucher/channel.
- [ ] Audit events are created for purchase confirmation and voucher issuance.
- [ ] No real-recipient email rollout is implied by this flow.

## Current Verified State

As of 2026-06-12, remote DB verification confirmed:

```text
cancel_pending_purchase:
  authenticated = true
  anon = false
  public = false

confirm_pending_purchase:
  authenticated = false
  anon = false
  public = false

confirm_purchase_and_issue_voucher:
  authenticated = true
  anon = false
  public = false
```

Remote DB verification also confirmed:

```text
confirm_purchase_and_issue_voucher:
  mentions_payment_source = true
  has_invalid_payment_source_error = true
  has_offline_guard = true
  unexpected_legacy_reference = false
```

## Related Files

Application:

```text
src/app/[locale]/dashboard/purchases/actions.ts
src/app/[locale]/dashboard/purchases/purchase-manager.tsx
src/app/api/webhooks/stripe/route.ts
```

Database migrations:

```text
supabase/migrations/20260605200725_create_vouchers.sql
supabase/migrations/20260609080938_create_purchase_confirmation_rpcs.sql
supabase/migrations/20260609110426_harden_confirm_purchase_and_issue_voucher_rpc_v2.sql
supabase/migrations/20260610000001_create_confirm_stripe_purchase_rpc.sql
supabase/migrations/20260610124500_harden_stripe_webhook_rpc_transaction.sql
supabase/migrations/20260610165000_queue_delivery_event_on_voucher_insert.sql
supabase/migrations/20260612100000_harden_manual_confirmation_offline_only.sql
supabase/migrations/20260612103000_restrict_cancel_pending_purchase_anon.sql
```

Related delivery/email docs:

```text
docs/architecture/ADR/007-delivery-provider-abstraction.md
docs/architecture/integration-specs/delivery-worker.md
docs/architecture/integration-specs/resend-production-rollout-gate.md
docs/architecture/integration-specs/resend-production-domain-setup-runbook.md
docs/architecture/integration-specs/resend-production-domain-test-evidence.md
```

## Non-Goals

- No UI redesign.
- No Stripe Connect onboarding changes.
- No payout automation.
- No refund implementation.
- No email provider production enablement.
- No real-recipient email approval.
- No voucher redemption changes.
- No cron/scheduler changes.
