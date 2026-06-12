# Voucher Redemption Flow

## Status

State: implemented and reviewed.

This document describes the ParaUsted voucher redemption flow for V1.

V1 supports **full remaining-balance redemption only**.

Partial redemption, QR scanning enhancements, and staff roles are deferred.

## Scope

This document covers:

- merchant dashboard redemption flow
- full voucher redemption RPC
- merchant ownership checks
- voucher status validation
- expiry validation
- atomic balance/status update
- redemption record creation
- audit event creation
- concurrency protection
- permission boundaries

This document does not cover:

- partial redemption
- exchange/transfer flow
- refund handling
- QR scanner UX
- staff accounts
- offline redemption without authentication
- customer-facing voucher page design
- WhatsApp or PDF delivery

## Core Business Flow

The intended V1 redemption flow is:

```text
Merchant opens dashboard
Merchant enters voucher code
System validates merchant ownership
System locks voucher row
System validates voucher is redeemable
System redeems full remaining balance
System writes redemption record
System writes audit event
Voucher status becomes redeemed
```

The redemption flow is part of the basic transaction lifecycle:

```text
buyer creates pending purchase
payment is confirmed
voucher is issued
voucher is delivered or opened
merchant redeems voucher
merchant completes service
```

## Relevant Application Files

```text
src/app/[locale]/dashboard/redemptions/actions.ts
src/app/[locale]/dashboard/redemptions/redemption-manager.tsx
```

The application calls:

```text
redeemVoucherFull(voucherCode, notes)
```

The server action calls the database RPC:

```text
public.redeem_voucher_full(TEXT, TEXT)
```

## Relevant Database Files

```text
supabase/migrations/20260605200913_create_redemptions.sql
supabase/migrations/20260609114236_create_redeem_voucher_rpc.sql
```

## V1 Redemption Rule

V1 supports full redemption only.

The RPC redeems the full remaining voucher balance:

```text
amount_cents = current balance_cents
balance_after = 0
voucher.status = redeemed
```

Partial redemption is intentionally deferred.

The database schema allows tracking `balance_before` and `balance_after`, which keeps future partial redemption possible without changing the historical redemption model.

## Redemption RPC

The current redemption RPC is:

```text
public.redeem_voucher_full(
  p_voucher_code TEXT,
  p_notes TEXT DEFAULT NULL
)
```

The RPC returns JSONB.

Expected success shape includes:

```text
success
redemption_id
voucher_code
amount_cents
balance_before
balance_after
status
```

Expected error values include:

```text
unauthorized
invalid_code
not_found
already_redeemed
expired
voided
exchanged
not_redeemable
already_processed
unknown
```

## Security Boundary

The redemption RPC is the final security boundary.

It must not trust merchant IDs from the client.

The RPC derives the merchant from the authenticated session:

```text
auth.uid()
-> merchants.auth_user_id
-> merchant_id
```

Then it loads the voucher only inside that merchant scope:

```text
voucher.code = normalized code
voucher.merchant_id = authenticated merchant id
```

This prevents one merchant from redeeming another merchant's voucher.

## Permission Boundary

Expected function permission model:

```text
redeem_voucher_full:
  authenticated = true
  anon = false
  public = false
```

Only authenticated merchants should be able to execute the redemption RPC.

Anonymous users must not be able to redeem vouchers.

## Voucher Code Normalization

The UI normalizes voucher input:

```text
trim
uppercase
```

The RPC also normalizes and validates the voucher code.

Expected voucher code format:

```text
PU-XXXX-XXXX-XXXX
```

The RPC rejects invalid formats with:

```text
invalid_code
```

## Voucher Row Locking

The RPC loads and locks the voucher row:

```sql
SELECT ...
FROM vouchers
WHERE code = v_code
  AND merchant_id = v_merchant_id
FOR UPDATE;
```

This is important for concurrency safety.

It prevents two redemption attempts from redeeming the same voucher balance at the same time.

## Redeemable Voucher States

The RPC allows redemption only for redeemable voucher states.

Currently accepted states:

```text
issued
delivered
partially_redeemed
```

For V1, the UI calls only full redemption.

The `partially_redeemed` state exists for future compatibility but partial redemption is not exposed in V1.

## Terminal / Non-Redeemable States

The RPC rejects terminal or non-redeemable states.

Examples:

```text
redeemed
expired
voided
exchanged
```

Expected behavior:

```text
redeemed or zero balance -> already_redeemed
expired or past expires_at -> expired
voided -> voided
exchanged -> exchanged
other unsupported state -> not_redeemable
```

## Expiry Validation

The RPC rejects expired vouchers.

A voucher is expired if:

```text
voucher.status = expired
```

or:

```text
voucher.expires_at < now()
```

This ensures expired value is not redeemed through the merchant dashboard.

Expiry policy remains legally sensitive and country-specific. Public copy must remain conservative until legal review.

## Atomic Redemption

The redemption operation is designed as one database transaction inside the RPC.

The critical sequence is:

```text
load and lock voucher
validate state
update voucher balance/status
insert redemption record
insert audit event
return result
```

If an unexpected database error occurs, PostgreSQL rolls back the transaction.

The client receives a safe generic error.

## Voucher Update

The RPC performs full redemption by updating the voucher:

```text
balance_cents = 0
status = redeemed
```

The update includes concurrency guards:

```text
voucher id matches
merchant id matches
balance_cents equals previously loaded balance
status is still redeemable
```

If the guarded update fails, the RPC returns:

```text
already_processed
```

This protects against duplicate redemption attempts.

## Redemption Record

Redemptions are recorded in:

```text
public.redemptions
```

Important columns:

```text
voucher_id
merchant_id
amount_cents
balance_before
balance_after
redeemed_by
notes
idempotency_key
redeemed_at
```

The redemption record is append-only.

The table has checks to prevent inconsistent balances:

```text
balance_after = balance_before - amount_cents
balance_before >= amount_cents
amount_cents > 0
```

## Append-Only Redemptions

The `redemptions` table is intended to be append-only.

Update and delete are revoked from authenticated and anonymous users.

This protects redemption history and auditability.

## Audit Event

The RPC writes an audit event after redemption.

Expected audit event:

```text
event_type = voucher_redeemed
actor_type = merchant
actor_id = authenticated user id
entity_type = redemption
entity_id = redemption id
```

Payload includes:

```text
voucher_id
voucher_code
amount_cents
balance_before
balance_after
```

This creates an auditable record of the redemption business action.

## UI Flow

The merchant dashboard redemption manager provides:

```text
voucher code input
optional notes input
localized error handling
localized success state
amount redeemed display
balance after display
```

On success, the UI clears:

```text
voucher code
notes
```

The success state shows:

```text
voucher code
amount redeemed
balance after
```

## Notes Handling

The RPC accepts optional notes.

Notes are trimmed and capped to a safe length.

Current behavior:

```text
empty notes -> null
notes max length -> 500 characters
```

Notes are stored on the redemption record.

Do not store sensitive customer data in redemption notes.

## Error Handling

The server action maps RPC errors to safe client-facing error keys.

The client UI has localized messages for known errors:

```text
unauthorized
invalid_code
not_found
already_redeemed
expired
voided
exchanged
not_redeemable
already_processed
unknown
```

The server action logs only generic RPC failure metadata.

Do not log voucher secrets, buyer PII, or raw voucher redemption errors in client-facing output.

## Idempotency And Duplicate Prevention

The redemption flow uses multiple protections:

```text
FOR UPDATE row lock
guarded voucher update
balance_cents comparison
status comparison
append-only redemption record
terminal status transition to redeemed
```

The redemptions table includes an `idempotency_key` column for future use.

Current UI/server action does not pass an explicit idempotency key.

For V1, duplicate prevention is handled primarily by row locking and guarded status/balance update.

Future improvement may add explicit idempotency keys for POS-style retries.

## Current Strengths

The current implementation satisfies these important V1 requirements:

- authenticated merchant redemption only
- merchant ownership enforced in DB
- voucher code format validation
- voucher row locking with `FOR UPDATE`
- full redemption only in UI
- full remaining balance redemption in RPC
- voucher balance becomes zero
- voucher status becomes `redeemed`
- redemption record is inserted
- audit event is inserted
- concurrency guard prevents double redemption
- redemptions table is append-only

## Known Deferred Items

The following are deferred and should not be implemented in B10 unless explicitly planned:

- partial redemption
- QR scanner UX
- staff accounts and staff-level permissions
- idempotency key from UI/client
- redemption reversal
- exchange/transfer
- refund workflow
- offline redemption mode
- printed receipt
- POS integration

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
  AND p.proname = 'redeem_voucher_full'
ORDER BY p.proname, arguments;
```

Expected result:

```text
redeem_voucher_full:
  authenticated = true
  anon = false
  public = false
```

### Function Source Verification

```sql
SELECT
  p.proname AS function_name,
  position('SECURITY DEFINER' IN pg_get_functiondef(p.oid)) > 0 AS has_security_definer,
  position('SET search_path = public, pg_temp' IN pg_get_functiondef(p.oid)) > 0 AS has_safe_search_path,
  position('auth.uid()' IN pg_get_functiondef(p.oid)) > 0 AS uses_auth_uid,
  position('FOR UPDATE' IN pg_get_functiondef(p.oid)) > 0 AS locks_voucher_row,
  position('balance_cents = 0' IN pg_get_functiondef(p.oid)) > 0 AS full_redemption_sets_zero_balance,
  position('voucher_redeemed' IN pg_get_functiondef(p.oid)) > 0 AS writes_redemption_audit
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'redeem_voucher_full';
```

Expected result:

```text
has_security_definer = true
has_safe_search_path = true
uses_auth_uid = true
locks_voucher_row = true
full_redemption_sets_zero_balance = true
writes_redemption_audit = true
```

### Redemption Table Constraint Verification

```sql
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.redemptions'::regclass
  AND contype IN ('u', 'p', 'f', 'c')
ORDER BY conname;
```

Expected evidence should include:

```text
amount_cents > 0
balance_before >= amount_cents
balance_after = balance_before - amount_cents
voucher_id references vouchers(id)
merchant_id references merchants(id)
idempotency_key unique
```

### Recent Redemption Events

```sql
SELECT
  r.id,
  r.voucher_id,
  r.merchant_id,
  r.amount_cents,
  r.balance_before,
  r.balance_after,
  r.redeemed_at
FROM redemptions r
ORDER BY r.redeemed_at DESC
LIMIT 25;
```

### Recent Redemption Audit Events

```sql
SELECT
  id,
  merchant_id,
  event_type,
  actor_type,
  actor_id,
  entity_type,
  entity_id,
  payload,
  created_at
FROM audit_events
WHERE event_type = 'voucher_redeemed'
ORDER BY created_at DESC
LIMIT 25;
```

## Operational Rules

Do not update voucher balances directly from UI code.

Do not insert redemption rows directly from UI code.

Do not bypass `redeem_voucher_full`.

Do not enable partial redemption in UI without a separate PRD decision and DB review.

Do not allow anonymous voucher redemption.

Do not allow one merchant to redeem another merchant's voucher.

Do not delete redemption rows.

Do not update redemption rows after creation.

Do not log buyer PII or raw voucher redemption errors.

## Acceptance Criteria

- [ ] Redemption RPC is authenticated-only.
- [ ] Redemption RPC derives merchant from `auth.uid()`.
- [ ] Redemption RPC never trusts merchant ID from the client.
- [ ] Voucher lookup is merchant-scoped.
- [ ] Voucher code format is validated.
- [ ] Voucher row is locked with `FOR UPDATE`.
- [ ] V1 redemption is full remaining-balance only.
- [ ] Voucher balance is set to zero on redemption.
- [ ] Voucher status is set to `redeemed` on redemption.
- [ ] Redemption record is inserted.
- [ ] Redemption audit event is inserted.
- [ ] Duplicate redemption is prevented by row lock and guarded update.
- [ ] Expired, voided, exchanged, and already redeemed vouchers are rejected.
- [ ] Redemptions table remains append-only.
- [ ] Partial redemption remains deferred.

## PRD Alignment

This flow supports the PRD V1 basic transaction loop:

```text
merchant creates gift card
buyer creates pending purchase
payment is confirmed
voucher is issued
recipient redeems
merchant completes service
```

It also follows the PRD V1 rule:

```text
Full redemption only
```

Future V2 features such as partial redemption, exchange, transfer, staff accounts, and richer lifecycle operations remain deferred.

## Related Files

Application:

```text
src/app/[locale]/dashboard/redemptions/actions.ts
src/app/[locale]/dashboard/redemptions/redemption-manager.tsx
```

Database migrations:

```text
supabase/migrations/20260605200913_create_redemptions.sql
supabase/migrations/20260609114236_create_redeem_voucher_rpc.sql
```

Related lifecycle documentation:

```text
docs/architecture/integration-specs/payment-confirmation-voucher-issuance.md
docs/architecture/integration-specs/delivery-worker.md
docs/architecture/integration-specs/resend-production-rollout-gate.md
```

## Non-Goals

- No partial redemption.
- No refund flow.
- No exchange/transfer flow.
- No staff role implementation.
- No QR scanner implementation.
- No POS integration.
- No redemption reversal.
- No customer-facing voucher page redesign.
