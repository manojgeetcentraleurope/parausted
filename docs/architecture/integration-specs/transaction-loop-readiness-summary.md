# Transaction Loop Readiness Summary

## Status

State: transaction loop implemented, hardened, documented, and verified for current V1 scope.

This document summarizes the current ParaUsted transaction loop readiness after the recent payment, voucher, delivery, redemption, voucher page, and pending-expiry hardening work.

The goal is to provide a compact handoff for continuing implementation in a new chat or sprint review without losing context.

## Summary

The core V1 transaction loop is now in a strong state:

```text
Buyer creates pending purchase
Payment is confirmed
Voucher is issued
Delivery event is queued
Voucher page is canonical source of truth
Voucher is redeemed by merchant
Expired pending purchases are not confirm-actionable
```

The recent work focused on security, legal safety, atomicity, DB permission boundaries, and PRD alignment.

## Current Latest Commit Chain

Latest known clean commit chain:

```text
5e4918d docs(payment): document pending purchase expiry handling
7efd864 docs(voucher): document voucher page source of truth
c02af65 fix(voucher): harden public voucher page access
584bb72 docs(redemption): document voucher redemption flow
da7c65c fix(payment): rollback manual voucher generation exhaustion
78eae26 docs(payment): document confirmation voucher issuance flow
5fc90ba fix(payment): restrict pending purchase cancellation rpc
bb3b7d8 fix(payment): enforce offline-only manual voucher issuance
c9ea242 docs(email): add production domain test evidence template
e9e47ce docs(email): add resend production domain setup runbook
```

Latest local status at handoff:

```text
git status --short --untracked-files=all
# no output
```

Repo was clean after the latest commit.

## PRD Alignment

The current implementation is aligned with the PRD v1.1 change pack principles:

```text
No voucher before payment confirmation
Direct payment confirmation is a core V1 module
Stripe confirmation is webhook-driven
Payment source changes confirmation path
Voucher lifecycle remains the same
Voucher page is the canonical source of truth
Delivery is a channel, not the source of truth
Full redemption only for V1
Spain-first legal safety
Privacy-conscious public pages
```

## Core Transaction Loop Coverage

### 1. Pending Purchase Creation

Current state:

```text
Public purchase flow creates pending purchases
Reference code is generated
Payment instructions are shown to buyer
expires_at is stored on purchases
```

V1 expectation:

```text
Buyer sees on-screen confirmation with reference code and payment instructions.
Buyer email confirmation remains V1.5 / fast-follow.
```

### 2. Direct/Offline Payment Confirmation

Manual/offline confirmation path is implemented and hardened.

Current DB boundary:

```text
public.confirm_purchase_and_issue_voucher(UUID)
```

Confirmed properties:

```text
authenticated merchant only
merchant ownership derived from auth.uid()
manual confirmation is OFFLINE-only
ONLINE/card purchases are rejected by this RPC
expired purchases are rejected
purchase confirmation and voucher issuance are atomic
voucher-code generation exhaustion raises exception to guarantee rollback
```

Important invariant:

```text
Manual confirmation either confirms purchase + issues voucher together,
or changes nothing.
```

### 3. Stripe Online/Card Confirmation

Stripe confirmation path exists separately.

Current DB boundary:

```text
public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT)
```

Confirmed architectural intent:

```text
service_role only
Stripe webhook route verifies payment state
ONLINE/card only
processed_webhooks provides idempotency
voucher issuance uses the same post-confirmation lifecycle
```

This supports the PRD rule:

```text
Stripe card / Apple Pay / Google Pay -> confirmed by Stripe webhook
Bizum / bank transfer / cash -> confirmed manually by merchant
```

### 4. Deprecated Confirm-Only RPC Disabled

The old confirm-only RPC was disabled for client roles:

```text
public.confirm_pending_purchase(UUID)
```

Verified permission state:

```text
confirm_pending_purchase:
  authenticated = false
  anon = false
  public = false
```

Reason:

```text
A purchase must not move to payment_confirmed without voucher issuance.
```

### 5. Manual Cancellation / Rejection

Cancellation remains available to authenticated merchants only.

Current DB boundary:

```text
public.cancel_pending_purchase(UUID, TEXT)
```

Verified permission state:

```text
cancel_pending_purchase:
  authenticated = true
  anon = false
  public = false
```

Purpose:

```text
Reject/cancel pending payment requests without issuing vouchers.
```

### 6. Voucher Issuance

Voucher issuance is tied to confirmed payment.

Important DB constraints:

```text
vouchers.purchase_id UNIQUE
vouchers.code UNIQUE
balance_cents <= original_amount_cents
```

Important invariant:

```text
A purchase can produce at most one voucher.
```

### 7. Delivery Queue

Delivery event creation is centralized after voucher insertion.

Current mechanism:

```text
INSERT INTO vouchers
-> trigger trg_queue_delivery_event_for_voucher
-> INSERT INTO delivery_events
```

Duplicate prevention:

```text
unique index on delivery_events(voucher_id, channel)
ON CONFLICT DO NOTHING
```

Delivery providers:

```text
dry-run provider exists
Resend provider exists
production real-recipient sending remains gated
```

### 8. Voucher Page Source Of Truth

The canonical voucher page exists:

```text
/[locale]/v/[code]
```

Implemented route:

```text
src/app/[locale]/v/[code]/page.tsx
```

B11.2 hardened public data access.

Current model:

```text
Public page -> get_public_voucher_page(code) SECURITY DEFINER RPC
Direct anon access to vouchers table -> blocked
```

Verified DB state:

```text
public_read_by_code policy removed
merchant_manage voucher policy remains
anon has no direct vouchers table privileges
get_public_voucher_page is SECURITY DEFINER
search_path = public, pg_temp
anon can execute get_public_voucher_page
authenticated can execute get_public_voucher_page
public cannot execute get_public_voucher_page
```

Safe public fields returned:

```text
code
original_amount_cents
balance_cents
status
expires_at
recipient_name
sender_name
personal_message
merchant_name
delivery_channel
delivery_status
```

Fields intentionally excluded:

```text
buyer_email
buyer_phone
recipient_email
recipient_phone
stripe/payment internals
provider_response
audit payloads
internal IDs
```

### 9. Voucher Redemption

V1 redemption is full remaining-balance only.

Current DB boundary:

```text
public.redeem_voucher_full(TEXT, TEXT)
```

Verified properties:

```text
SECURITY DEFINER
search_path = public, pg_temp
authenticated merchant only
merchant ownership derived from auth.uid()
voucher row locked with FOR UPDATE
voucher balance set to zero
voucher status set to redeemed
redemption record inserted
audit event voucher_redeemed inserted
anon cannot execute
public cannot execute
```

PRD alignment:

```text
Full redemption only in V1.
Partial redemption remains deferred.
```

### 10. Pending Purchase Expiry

V1 minimum is satisfied.

Current behavior:

```text
expires_at exists on purchases
merchant dashboard calculates is_expired
expired rows show expired indicator
confirm button is hidden for expired rows
manual confirmation RPC rejects expired purchases
manual reject/cancel remains available
cron cleanup deferred
```

Sprint note satisfied:

```text
Dashboard must not show expired pending purchases as actionable.
```

## Verified DB Permission Boundaries

### Payment RPCs

```text
confirm_purchase_and_issue_voucher:
  authenticated = true
  anon = false
  public = false

confirm_pending_purchase:
  authenticated = false
  anon = false
  public = false

cancel_pending_purchase:
  authenticated = true
  anon = false
  public = false
```

### Redemption RPC

```text
redeem_voucher_full:
  authenticated = true
  anon = false
  public = false
```

### Public Voucher RPC

```text
get_public_voucher_page:
  anon = true
  authenticated = true
  public = false
  SECURITY DEFINER = true
  search_path = public, pg_temp
```

## Current Documentation Set

Core lifecycle docs now include:

```text
docs/architecture/integration-specs/payment-confirmation-voucher-issuance.md
docs/architecture/integration-specs/voucher-redemption-flow.md
docs/architecture/integration-specs/voucher-page-source-of-truth.md
docs/architecture/integration-specs/pending-purchase-expiry.md
docs/architecture/integration-specs/delivery-worker.md
docs/architecture/integration-specs/resend-production-rollout-gate.md
docs/architecture/integration-specs/resend-production-domain-setup-runbook.md
docs/architecture/integration-specs/resend-production-domain-test-evidence.md
```

## Security And Legal Safety Improvements Completed

Completed hardening includes:

```text
manual confirmation is OFFLINE-only at DB boundary
Stripe confirmation remains ONLINE/card-only
confirm-only legacy RPC disabled
cancel pending purchase restricted to authenticated merchants
manual voucher generation exhaustion now raises exception for rollback
public voucher page no longer directly reads vouchers table
public voucher page uses PII-safe SECURITY DEFINER RPC
voucher code removed from voucher page error logs
redemption RPC verified as authenticated-only
redemption source verified for FOR UPDATE and audit event
expired pending purchases not confirm-actionable
```

## Production-Gated Areas

The following capabilities exist but remain gated or deferred:

```text
real-recipient Resend email sending
production Resend domain rollout
Stripe live mode decision
pending purchase automated cleanup
buyer pending-purchase email confirmation
merchant notification for new pending purchases
processed webhook cleanup plan
legal/consent Spanish reviewer sign-off
```

## Known Deferred Items

### Week 7 / Security Hardening

```text
pending purchase cleanup automation or manual cleanup action
processed_webhook cleanup plan
expiry-related audit event taxonomy
```

### Week 8 / Production Readiness

```text
legal/consent copy review with Spanish-speaking reviewer
Stripe test/live mode decision documented
known V1 limitations and V1.5 priorities document
production email rollout approval evidence
```

### V1.5

```text
buyer email confirmation for pending purchase
merchant notification of new pending purchases
beautiful voucher preview
basic PDF voucher
email delivery production rollout
Seville discovery marketplace
city/category/relationship SEO pages
basic analytics
```

### V2+

```text
partial redemption
exchange/transfer
scheduled delivery
staff accounts
WhatsApp delivery
rich media personalization
media moderation/scanning
refund workflow automation
wallet pass investigation
```

## Recommended Next Engineering Slices

Recommended next work should avoid reopening completed money-state flows unless a real issue appears.

Suggested next slices:

```text
1. Production readiness limitations and V1/V1.5 known gaps document
2. Stripe live/test mode decision document
3. Processed webhook cleanup plan document
4. Pending purchase cleanup plan or manual cleanup action
5. Voucher page UX polish with conservative legal/validity copy
6. Merchant notification planning for pending purchases
7. Tourist mode polish review
```

## Recommended Next Chat

This conversation has covered many high-risk lifecycle changes.

Recommended next step:

```text
Start a new chat for the next implementation slice.
```

Suggested new chat context:

```text
We have completed ParaUsted V1 transaction loop hardening through commit 5e4918d.
Core docs now cover payment confirmation/voucher issuance, voucher redemption, voucher page source of truth, and pending purchase expiry.
Public voucher access is hardened through get_public_voucher_page RPC.
Manual confirmation is OFFLINE-only and atomic.
Stripe confirmation is ONLINE/card-only.
Redemption is authenticated merchant-only and full redemption only.
Real-recipient email rollout remains gated.
Next recommended slice: production readiness limitations and V1/V1.5 known gaps, or processed webhook cleanup plan.
```

## Validation Commands For Handoff

Use these before starting the next slice:

```powershell
git status --short --untracked-files=all
git log --oneline -12
```

Expected:

```text
working tree clean
HEAD at latest pushed commit
```

## Acceptance Criteria For Current Transaction Loop Readiness

- [ ] Manual offline confirmation is DB-enforced.
- [ ] Stripe online/card confirmation is separate and webhook-driven.
- [ ] Voucher issuance happens only after payment confirmation.
- [ ] A purchase can produce at most one voucher.
- [ ] Delivery event is queued after voucher insertion.
- [ ] Voucher page is canonical source of truth.
- [ ] Public voucher page uses safe RPC, not direct table access.
- [ ] Public voucher page excludes contact PII and payment internals.
- [ ] Redemption is authenticated merchant-only.
- [ ] Redemption is full remaining-balance only for V1.
- [ ] Expired pending purchases are not confirm-actionable.
- [ ] Real-recipient email delivery remains gated.
- [ ] Deferred items are documented and not mixed into current scope.

## Final Readiness Statement

The ParaUsted V1 transaction loop is now ready for the next production-readiness and UX-polish phase.

The critical money-state and voucher-state boundaries have been hardened and documented.

The next focus should be operational readiness, legal copy review, Stripe mode decisions, cleanup policies, and V1/V1.5 limitation documentation.
