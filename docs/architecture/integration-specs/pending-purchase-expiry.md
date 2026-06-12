# Pending Purchase Expiry Handling

## Status

State: implemented for V1 minimum, automation deferred.

This document describes how ParaUsted handles pending purchase expiry in the current Spain-first V1 transaction flow.

The current implementation satisfies the V1 minimum requirement:

```text
Expired pending purchases must not be shown as confirm-actionable.
```

Pending purchase expiry automation, such as scheduled cancellation or cleanup, remains deferred to a later hardening slice.

## Scope

This document covers:

- pending purchase expiry purpose
- current dashboard behavior
- current confirmation guard behavior
- manual cancellation/rejection behavior
- V1 minimum requirement
- deferred cleanup/cron options
- PRD and sprint-plan alignment
- verification steps

This document does not cover:

- refund handling
- payment provider reversal
- Stripe webhook retry behavior
- voucher expiry policy
- legal final wording for gift-card validity
- automated customer notification
- merchant email/push notification
- pg_cron implementation

## Product Context

Pending purchases are created before payment is confirmed.

For direct/offline payment methods, the buyer pays outside ParaUsted using a method such as:

```text
Bizum direct
bank transfer
cash
```

The purchase remains pending until the merchant confirms payment in the Direct Payment Confirmation Center.

The buyer should not receive a voucher before payment confirmation.

## Core Rule

A pending purchase may expire before the merchant confirms payment.

Expired pending purchases must not be confirm-actionable from the merchant dashboard.

The system should prevent this at two levels:

```text
UI/actionability guard
DB/RPC confirmation guard
```

## Current V1 Behavior

Current implementation includes these protections:

```text
expires_at is stored on purchases
merchant dashboard calculates is_expired
expired rows show an expired indicator
confirm button is hidden for expired rows
manual confirmation RPC rejects expired purchases
```

This satisfies the V1 minimum requirement from the sprint notes.

## Dashboard Visibility

The merchant dashboard currently lists pending purchases and computes an expiry flag:

```text
is_expired = purchase.expires_at < now
```

Expired pending purchases are visually marked as expired.

The confirm action is not shown for expired rows.

This keeps expired pending purchases visible for operational awareness while preventing accidental confirmation.

## Confirm Action Behavior

The merchant confirmation action calls:

```text
public.confirm_purchase_and_issue_voucher(UUID)
```

The RPC validates that the purchase is not expired before changing money/voucher state.

If the purchase has expired, the RPC returns a safe error:

```text
expired
```

This protects against stale clients, race conditions, or direct RPC calls.

## Manual Cancellation / Rejection

Merchants may still reject/cancel pending purchases through:

```text
public.cancel_pending_purchase(UUID, TEXT)
```

The cancellation RPC is restricted to authenticated merchants.

Current verified permission boundary:

```text
cancel_pending_purchase:
  authenticated = true
  anon = false
  public = false
```

Manual cancellation remains useful for operational cleanup when a pending payment was never received, duplicated, or abandoned.

## Why Expired Purchases Are Not Auto-Cancelled Yet

Automatic expiry cleanup is intentionally deferred.

Reasons:

- V1 minimum is already satisfied by hiding/disabling confirmation for expired rows.
- Some merchants may need operational visibility into expired requests.
- Legal/payment wording around cancellation and expiry should remain conservative.
- Scheduled jobs add operational complexity and should be introduced when needed.

Current stance:

```text
Expired pending purchases are not confirmable.
Expired pending purchases may remain visible.
Merchants can manually reject/cancel them.
Automation is deferred.
```

## Deferred Automation Options

### Option 1: Dashboard Filtering Only

Expired pending purchases are filtered out from the actionable pending list.

Pros:

- simple
- no scheduled job
- low operational risk

Cons:

- old pending rows remain in the database
- merchants may lose visibility unless an expired filter/view exists

### Option 2: Manual Cleanup Action

Add a merchant or admin action to cancel expired pending purchases.

Pros:

- controlled
- auditable
- lower risk than scheduled automation

Cons:

- requires manual operation
- may be forgotten

### Option 3: Scheduled Cleanup Job

Use a scheduled job to cancel pending purchases past `expires_at`.

Possible implementation:

```text
pg_cron or scheduled server job
```

Pros:

- keeps pending queue clean
- reduces merchant operational burden

Cons:

- needs careful audit logging
- needs retry/error monitoring
- needs legal/product review for cancellation wording

## Recommended V1 Position

For V1 launch readiness, keep the current behavior:

```text
expired pending purchases remain visible but not confirm-actionable
manual reject/cancel remains available
DB confirmation guard blocks expired confirmation
cron cleanup is deferred
```

This is sufficient for the V1 minimum while keeping operational complexity low.

## Recommended Week 7 Follow-Up

Add a Week 7 hardening item:

```text
Document and optionally implement pending purchase expiry cleanup.
```

Possible Week 7 deliverables:

```text
manual cleanup action
scheduled cleanup plan
processed webhook cleanup plan
expiry-related audit event definition
known limitations document update
```

## Audit Expectations

If automated or manual expiry cancellation is implemented later, it should write audit evidence.

Suggested event type:

```text
purchase_expired
```

or, if reusing cancellation semantics:

```text
purchase_cancelled
```

The audit payload should avoid unnecessary PII and may include:

```text
purchase_id
reference_code
expired_at
reason
actor_type
```

Actor types may include:

```text
merchant
system
admin
```

## PRD Alignment

This behavior supports the PRD principle:

```text
No voucher before payment confirmation.
```

It also supports the direct payment lifecycle:

```text
Buyer creates pending purchase.
Buyer pays merchant externally.
Merchant verifies payment externally.
Merchant confirms payment in ParaUsted.
System issues voucher.
```

If the purchase expires before confirmation, the system must not issue a voucher.

Current implementation enforces this through dashboard actionability and DB confirmation guards.

## Sprint Plan Alignment

Earlier sprint notes stated:

```text
Minimum for V1 launch: dashboard must not show expired pending purchases as actionable.
```

Current implementation satisfies this minimum:

```text
expired indicator exists
confirm button is hidden for expired pending purchases
manual confirmation RPC returns expired for expired purchases
```

The notes also stated cleanup automation can be deferred:

```text
Cron or manual job: cancel/expire pending purchases past expires_at can defer to Week 7.
```

This remains the recommended path.

## Verification Checklist

### Application Verification

Confirm the merchant pending purchase dashboard:

```text
shows expired indicator for expired pending purchases
hides or disables confirm action for expired pending purchases
still allows reject/cancel where appropriate
shows safe localized error if backend returns expired
```

Relevant files:

```text
src/app/[locale]/dashboard/purchases/actions.ts
src/app/[locale]/dashboard/purchases/purchase-manager.tsx
```

### Database Verification

Confirm the manual confirmation RPC still checks expiry.

```sql
SELECT
  p.proname AS function_name,
  position('expires_at' IN pg_get_functiondef(p.oid)) > 0 AS mentions_expires_at,
  position('expired' IN pg_get_functiondef(p.oid)) > 0 AS returns_expired_error,
  position('payment_source' IN pg_get_functiondef(p.oid)) > 0 AS mentions_payment_source,
  position('OFFLINE' IN pg_get_functiondef(p.oid)) > 0 AS has_offline_guard
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'confirm_purchase_and_issue_voucher';
```

Expected:

```text
mentions_expires_at = true
returns_expired_error = true
mentions_payment_source = true
has_offline_guard = true
```

### Permission Verification

Confirm pending purchase cancellation remains authenticated-only:

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
    'cancel_pending_purchase'
  )
ORDER BY p.proname, arguments;
```

Expected:

```text
confirm_purchase_and_issue_voucher:
  authenticated = true
  anon = false
  public = false

cancel_pending_purchase:
  authenticated = true
  anon = false
  public = false
```

## Operational Rules

Do not issue vouchers for expired pending purchases.

Do not show expired pending purchases as confirm-actionable.

Do not rely only on UI checks; keep DB/RPC expiry validation.

Do not auto-cancel pending purchases without audit strategy.

Do not introduce pg_cron until operational monitoring and rollback expectations are clear.

Do not hide legal/validity conditions from public copy.

## Acceptance Criteria

- [ ] Pending purchases have `expires_at`.
- [ ] Merchant dashboard identifies expired pending purchases.
- [ ] Expired pending purchases are not confirm-actionable.
- [ ] Manual confirmation RPC rejects expired pending purchases.
- [ ] Manual cancellation remains authenticated-only.
- [ ] No voucher is issued for expired pending purchases.
- [ ] Automated cleanup remains documented as deferred.
- [ ] Week 7 follow-up exists for cleanup/automation review.

## Known Deferred Items

- scheduled cleanup job
- manual bulk cleanup action
- expired pending purchase analytics
- merchant notification of expired requests
- buyer notification for expired requests
- audit event taxonomy for automated expiry
- processed webhook cleanup policy

## Non-Goals

- No cron implementation in this slice.
- No refund automation.
- No buyer email notification.
- No merchant notification.
- No Stripe webhook change.
- No voucher expiry policy change.
- No public legal-copy finalization.
