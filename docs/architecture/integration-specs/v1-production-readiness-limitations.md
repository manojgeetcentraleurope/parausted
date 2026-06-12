# ParaUsted V1 Production Readiness, Known Limitations, And V1.5 Priorities

## Status

State: draft for planning and documentation only.  
Repo baseline: clean and synced through commit `8fe8858 docs(project): summarize transaction loop readiness`.  
Recommended file path: `docs/architecture/integration-specs/v1-production-readiness-limitations.md`.  
Recommended commit after review: `docs(project): document v1 production readiness limitations`.

This document captures the production readiness position after ParaUsted V1 transaction-loop hardening. It is intended to help the Architect, Product Owner, and Project Manager make a clear launch decision without reopening completed money-state work unless a real gap is discovered.

## Scope

This document covers:

- What is currently V1-ready.
- What remains production-gated.
- What must be verified before launch.
- Known V1 limitations.
- V1.5 priorities.
- V2+ deferred capabilities.
- Launch go/no-go checklist.
- Role-based guidance for Architect, Product Owner, and Project Manager.

This document does not implement code, SQL migrations, cron jobs, email rollout, Stripe live mode, refunds, partial redemption, WhatsApp delivery, PDF generation, or marketplace/discovery.

## Executive Readiness Summary

The ParaUsted V1 core transaction loop is in a strong launch-candidate state for controlled production readiness review:

1. Buyer creates a pending purchase.
2. Payment is confirmed through the correct path.
3. Voucher is issued atomically after payment confirmation.
4. Delivery event is queued centrally after voucher insertion.
5. Public voucher page is the canonical source of truth.
6. Merchant redemption is authenticated-only and full-balance only for V1.
7. Expired pending purchases are not confirm-actionable.

Recommended launch interpretation:

- V1 is suitable for a controlled pilot after production gates are explicitly signed off.
- V1 is not yet ready for broad public launch until Stripe mode, Resend rollout, legal copy, and operational cleanup policies are accepted.
- V1.5 should focus on buyer/merchant communication, voucher experience polish, marketplace/discovery, and operational automation.

## Current V1-Ready Areas

### Transaction Loop Core

Current V1-ready capabilities:

- Public purchase flow creates pending purchases.
- Pending purchases store `expires_at`.
- Manual confirmation is restricted to OFFLINE purchases.
- Stripe confirmation is restricted to ONLINE/card purchases.
- Deprecated confirm-only RPC is disabled for client roles.
- Manual cancellation is authenticated-only.
- Voucher issuance is atomic with payment confirmation.
- Voucher generation exhaustion raises an exception to guarantee rollback.
- One purchase can produce at most one voucher through database uniqueness.
- Voucher insert queues delivery events centrally.
- Public voucher page is the canonical source of truth.
- Public voucher page uses a safe RPC and does not expose direct anonymous voucher table access.
- Public voucher page excludes buyer/recipient contact PII and payment/provider internals.
- Redemption is authenticated merchant-only.
- Redemption is full remaining-balance only for V1.
- Expired pending purchases are visible for operational awareness but not confirm-actionable.

### Security And Data Boundary Readiness

Current V1-ready security boundaries:

- Merchant-facing payment confirmation derives merchant ownership from `auth.uid()`.
- Manual confirmation does not trust merchant IDs from the client.
- Cancellation is authenticated-only.
- Stripe confirmation is service-role only.
- Public voucher page access is narrowed through `get_public_voucher_page`.
- Anonymous users do not directly read from `public.vouchers`.
- Voucher page logs must not include voucher codes.
- Voucher pages are not indexed by search engines.

### Product Flow Readiness

Current V1-ready product principles:

- No voucher before payment confirmation.
- Payment source determines confirmation path.
- Delivery channel is not the source of truth.
- Secure voucher page is the source of truth.
- Full redemption only is accepted for V1.
- Direct payment confirmation remains a core V1 module.
- Marketplace/discovery remains outside current V1 production scope unless explicitly moved forward.

## Production-Gated Areas

The following areas must remain gated until explicit approval or implementation evidence exists.

### Stripe Test/Live Mode Decision

Current status: decision pending or must be documented before launch.

Required before launch:

- Decide whether launch uses Stripe test mode, restricted live mode, or full live mode.
- Document whether Apple Pay / Google Pay are included in the initial launch scope.
- Verify webhook signing secret configuration in the deployment environment.
- Verify service-role-only execution boundary for Stripe confirmation RPC.
- Verify idempotency behavior with `processed_webhooks`.
- Define operational response for failed webhook processing.

Recommended V1 stance:

- Use restricted live mode only after webhook, payment method, legal copy, and support workflow checks pass.
- Avoid marketing online/card payments as fully available until Stripe production evidence exists.

### Resend Real-Recipient Email Rollout

Current status: real-recipient sending remains gated.

Required before launch:

- Production domain setup completed.
- Domain verification evidence captured.
- Sender/from-address approved.
- Test evidence captured for safe recipient(s).
- Real-recipient enablement explicitly approved.
- Bounce/error handling expectations documented.
- Delivery worker monitoring expectations documented.

Recommended V1 stance:

- Keep voucher page as source of truth.
- Treat email as a delivery channel, not the canonical voucher state.
- Do not enable unrestricted real-recipient email until rollout gate is approved.

### Legal, Consent, And Spanish Copy Review

Current status: legal and Spanish-speaking copy review remains required before public launch.

Required before launch:

- Review purchase confirmation copy.
- Review direct payment instructions.
- Review voucher validity/expiry wording.
- Review refund/cancellation wording.
- Review privacy wording around recipient and buyer data.
- Review merchant-facing confirmation responsibility language.
- Confirm consent and communication wording for Spain-first launch.

Recommended V1 stance:

- Use conservative wording.
- Avoid absolute claims such as "no refunds ever", "legally guaranteed", or "expires without conditions".
- Make clear that offline payment verification is performed by the merchant.

### Pending Purchase Cleanup

Current status: V1 minimum is satisfied, automation deferred.

Required before broader launch:

- Decide whether expired pending purchases remain visible indefinitely.
- Decide whether manual bulk cleanup is needed.
- Decide whether scheduled cleanup is needed.
- Define audit event taxonomy for system-driven expiry/cancellation.
- Define support workflow for abandoned payment requests.

Recommended V1 stance:

- Keep current behavior for V1 pilot.
- Expired pending purchases must not be confirm-actionable.
- Manual reject/cancel remains sufficient for the first controlled launch.
- Revisit cleanup automation in Week 7 or V1.5 hardening.

### Processed Webhook Cleanup Policy

Current status: cleanup policy remains deferred.

Required before scale:

- Define retention period for processed webhook records.
- Decide whether cleanup is manual, scheduled, or not needed during V1.
- Ensure cleanup does not break idempotency for late retries or audit needs.
- Document operational monitoring expectations.

Recommended V1 stance:

- Do not implement cleanup until retention and idempotency rules are clear.
- Keep processed webhook records for launch unless table growth becomes operationally relevant.

## Known V1 Limitations

### Buyer Communication

Known limitations:

- Buyer email confirmation for pending purchases is not yet enabled as a production feature.
- Merchant notification for new pending purchases is not yet enabled.
- Buyer notification for expired pending purchases is not yet enabled.
- Voucher delivery depends on gated email rollout or manual access to voucher page.

V1 impact:

- The buyer may rely on on-screen confirmation and merchant communication.
- Merchants may need to manually monitor pending purchases.

V1.5 direction:

- Add buyer pending-purchase email confirmation.
- Add merchant new-purchase notification.
- Add expiration or reminder notification policy if legally/product-approved.

### Voucher Experience

Known limitations:

- Voucher page is functional but not yet a polished gift experience.
- Merchant logo/branding is deferred.
- QR code rendering is deferred.
- Basic PDF voucher is deferred.
- WhatsApp-specific sharing is deferred.
- Wallet pass investigation is deferred.

V1 impact:

- The canonical voucher page works as the secure source of truth.
- Gift experience may feel basic compared with a polished marketplace product.

V1.5 direction:

- Improve voucher page design.
- Add QR code for redemption flow.
- Add basic PDF voucher.
- Add merchant branding and conservative legal/validity copy.

### Redemption

Known limitations:

- Full redemption only.
- No partial redemption.
- No exchange/transfer.
- No staff accounts or delegated redemption users.
- No merchant-side QR scanning UX beyond current flow unless already implemented elsewhere.

V1 impact:

- Operationally simpler and safer for launch.
- Some merchants may expect partial redemption; this must be communicated clearly.

V1.5/V2 direction:

- Keep partial redemption out of V1 unless business demand is confirmed and audit/accounting rules are clear.
- Consider staff accounts only after merchant admin model is defined.

### Operational Automation

Known limitations:

- No scheduled pending purchase cleanup.
- No processed webhook cleanup policy.
- No automated refund workflow.
- No payout automation finalization in this document.
- No production incident runbook included in this slice.

V1 impact:

- More manual operational oversight is required.
- Lower automation risk, but higher support burden.

V1.5 direction:

- Add cleanup policy documents first.
- Add automation only after audit, retry, and rollback expectations are clear.

### Discovery And Growth

Known limitations:

- Marketplace/discovery is deferred from current V1 production hardening.
- Seville tourist mode polish remains separate.
- SEO city/category/relationship pages are deferred.
- Analytics are basic or deferred.

V1 impact:

- V1 can validate merchant onboarding and transaction loop.
- Organic discovery and marketplace growth are limited until V1.5.

V1.5 direction:

- Add Seville discovery marketplace.
- Add city/category/relationship landing pages.
- Add basic analytics.

## Must-Verify Before Launch

### Repository And Build

- Working tree is clean.
- `origin/main` is synced.
- Latest production-readiness documentation is committed.
- TypeScript passes if application code changed.
- Lint passes if application code changed.
- No accidental full-file rewrites or formatting churn.

Suggested commands:

```powershell
git status --short --untracked-files=all
git log --oneline -12
git diff --stat
git diff --check
```

If code changed:

```powershell
npx tsc --noEmit
npm run lint
```

### Database Permission Boundaries

Verify:

- `confirm_purchase_and_issue_voucher` is authenticated-only.
- `confirm_purchase_and_issue_voucher` rejects non-OFFLINE purchases.
- `confirm_pending_purchase` is not executable by client roles.
- `cancel_pending_purchase` is authenticated-only.
- `confirm_stripe_purchase_and_issue_voucher` is service-role only.
- `redeem_voucher_full` is authenticated-only.
- `get_public_voucher_page` is executable by anon/authenticated and not by public.
- Anonymous users have no direct privileges on `public.vouchers`.

### Manual Payment Flow

Verify:

- Buyer can create pending purchase.
- Buyer sees reference code and direct payment instructions.
- Merchant sees pending purchase.
- Merchant cannot confirm expired purchase.
- Merchant can reject/cancel pending purchase.
- Merchant can confirm valid OFFLINE purchase.
- Voucher is issued exactly once.
- Voucher page is reachable by code.
- Delivery event is queued after voucher insert.

### Stripe Flow

Verify:

- Webhook signature validation is configured.
- Successful paid checkout session triggers Stripe confirmation RPC.
- Stripe RPC rejects OFFLINE purchases.
- Duplicate webhook event is idempotent.
- Voucher is issued exactly once.
- Transient errors allow Stripe retry where appropriate.

### Voucher Page

Verify:

- Invalid voucher-code format returns safe not-found behavior.
- Public page uses `get_public_voucher_page` and not direct table reads.
- Voucher page excludes contact PII and payment internals.
- Voucher page is localized in Spanish and English.
- Voucher pages are noindex/nofollow.
- Voucher codes are not logged on query errors.

### Redemption

Verify:

- Only authenticated merchant owner can redeem.
- Wrong merchant cannot redeem another merchant's voucher.
- Redeeming locks voucher row.
- Redeeming sets balance to zero.
- Redeeming sets status to redeemed.
- Audit event is written.
- Second redemption attempt fails safely or returns already-processed behavior.

### Legal And Copy

Verify:

- Spanish primary copy is reviewed.
- English secondary copy does not contradict Spanish copy.
- Validity/expiry wording is conservative.
- Offline payment responsibility is clear.
- Refund/cancellation language is reviewed.
- Privacy language around buyer/recipient data is acceptable.

## V1 Launch Recommendation

Recommended status: conditional go for controlled pilot only.

Go only if:

- Stripe mode decision is documented.
- Email rollout state is explicitly gated or approved.
- Legal/copy review is completed or launch copy is conservative enough for a limited pilot.
- Manual payment path has been smoke-tested end to end.
- Voucher page has been smoke-tested end to end.
- Redemption has been smoke-tested end to end.
- Operational owner knows how to handle abandoned/expired pending purchases.

No-go if:

- Production Stripe/webhook configuration is unknown.
- Real-recipient email is enabled without approval evidence.
- Legal/validity copy is unreviewed and public-facing claims are strong or absolute.
- Public voucher page exposes PII or direct anonymous voucher table access regresses.
- Manual confirmation can issue vouchers for ONLINE/card purchases.
- Stripe confirmation can issue vouchers for OFFLINE purchases.
- Expired pending purchases can still be confirmed.

## V1.5 Priorities

Recommended V1.5 order:

1. Buyer pending-purchase email confirmation.
2. Merchant notification for new pending purchases.
3. Production email rollout approval and monitoring.
4. Voucher page UX polish.
5. Conservative legal/validity copy improvement.
6. Basic PDF voucher.
7. QR code display and redemption support.
8. Pending purchase cleanup plan or manual cleanup action.
9. Processed webhook cleanup policy.
10. Seville discovery marketplace.
11. City/category/relationship SEO pages.
12. Basic analytics.

## V2+ Deferred Capabilities

Keep out of V1 and V1.5 unless explicitly reprioritized:

- Partial redemption.
- Exchange/transfer.
- Scheduled delivery.
- Staff accounts.
- WhatsApp delivery.
- Rich media personalization.
- Media moderation/scanning.
- Refund workflow automation.
- Wallet pass support.
- Bulk/corporate gifting.
- Advanced merchant analytics.

## Role-Based Teaching Notes

### Architect Lens

The Architect should protect invariants and boundaries.

Key questions:

- Is the database the final authority for money-state changes?
- Are payment paths separated by source and permission boundary?
- Can a purchase ever produce more than one voucher?
- Can public access leak PII or internal provider data?
- Are deferred automations documented instead of half-implemented?

Architect recommendation:

- Do not reopen completed transaction-loop flows unless evidence shows a gap.
- Focus next on operational readiness, cleanup policies, and production gates.
- Keep source-of-truth rules explicit: voucher page is truth, delivery is channel.

### Product Owner Lens

The Product Owner should protect customer value and expectation clarity.

Key questions:

- What can a buyer reliably do in V1?
- What can a merchant reliably do in V1?
- Which limitations must be visible in product copy or onboarding?
- Which V1.5 items improve trust and conversion fastest?
- What must not be promised yet?

PO recommendation:

- Position V1 as a safe direct-payment gift-card pilot.
- Avoid promising polished marketplace, partial redemption, WhatsApp, PDF, or advanced automation until those are built.
- Prioritize communication features in V1.5 because they reduce support friction and increase trust.

### Project Manager Lens

The Project Manager should protect sequencing, risk, and launch control.

Key questions:

- Which gates block launch?
- Who owns each gate?
- What evidence is needed before go-live?
- What is the rollback/support plan if a transaction fails?
- Are deferred items tracked without expanding current scope?

PM recommendation:

- Treat V1 production readiness as a gated launch checklist, not an open-ended feature sprint.
- Assign owners for Stripe, Resend, legal copy, smoke testing, and operations.
- Commit this document first, then choose one follow-up planning doc: Stripe mode decision or processed webhook cleanup plan.

## Suggested Owners And Evidence

| Area | Suggested owner | Evidence needed |
| --- | --- | --- |
| Stripe mode decision | Architect / PM | Decision doc, webhook config evidence, test event evidence |
| Resend rollout | Architect / PM | Domain verification, sender approval, test evidence, rollout approval |
| Legal/copy review | PO / PM | Reviewed Spanish and English copy, approved wording notes |
| Manual payment smoke test | PM / QA | Screenshots or checklist evidence for pending -> confirm -> voucher |
| Voucher page smoke test | PM / QA | Valid code, invalid code, no PII, noindex evidence |
| Redemption smoke test | PM / QA | Correct merchant redeem, wrong merchant blocked, audit evidence |
| Pending purchase cleanup | Architect / PO | Decision: defer, manual cleanup, or scheduled cleanup |
| Processed webhook cleanup | Architect | Retention and idempotency policy |

## Next Recommended Slice

Recommended next slice after this document:

1. Stripe test/live mode decision document, or
2. Processed webhook cleanup plan, or
3. Resend production rollout approval evidence update.

Recommended sequence:

1. Commit this production readiness document.
2. Attach PRD and Sprint plan for alignment review.
3. Update this document if PRD/Sprint reveal a launch-blocking gap.
4. Choose one focused follow-up planning slice.

## Acceptance Criteria

- Current V1-ready areas are documented.
- Production-gated areas are documented.
- Known V1 limitations are explicit and not hidden.
- V1.5 priorities are separated from V1 launch scope.
- V2+ items are deferred and out of current scope.
- Launch go/no-go criteria are clear.
- Architect, PO, and PM responsibilities are documented.
- No code or SQL changes are included in this slice.

## Final Position

ParaUsted V1 transaction-loop hardening is complete enough to move into production readiness review. The next risk is not core transaction atomicity; the next risk is launch discipline: Stripe mode, email rollout, legal copy, operational cleanup, and honest limitation management.
