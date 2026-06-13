# ParaUsted V1 Pilot Launch Gate Checklist

## Status

State: planning and launch-control checklist only.  
Baseline commit before this slice: latest clean `main` after `stripe-test-live-mode-decision.md`.  
Recommended file path: `docs/architecture/integration-specs/v1-pilot-launch-gate-checklist.md`.  
Recommended commit after review: `docs(project): add v1 pilot launch gate checklist`.

This document converts the current production-readiness work into a practical go/no-go checklist for the first ParaUsted V1 pilot merchants.

No code, SQL, Stripe Dashboard change, Resend change, or Supabase change is included in this slice.

## Purpose

The purpose of this checklist is to help the team decide whether ParaUsted V1 is ready for a controlled pilot launch with real merchants.

The checklist is designed for three roles:

- Architect: protect system boundaries, data safety, and transaction invariants.
- Product Owner: protect buyer, recipient, and merchant expectations.
- Project Manager: protect launch sequencing, evidence, ownership, and go/no-go discipline.

## Pilot Merchant Order

Recommended pilot order:

1. Tour operator.
2. Barber.
3. Driving class.

Rationale:

- Tour operator validates tourist mode, English flow, card-first payment behavior, mobile UX, and Seville experience positioning.
- Barber validates local direct/offline payment flow, Bizum/bank/cash behavior, merchant confirmation, and simple redemption.
- Driving class validates service gift cards, higher-trust operational wording, validity expectations, and refund/cancellation sensitivity after the simpler pilots are stable.

## Launch Decision Levels

### Green - Ready For Controlled Pilot

Use this when:

- Required gates are complete.
- Known limitations are documented.
- Merchant understands the pilot constraints.
- At least one end-to-end smoke test passed for the selected payment mode.
- No high-risk data exposure or money-state gap is known.

### Yellow - Pilot Allowed With Restrictions

Use this when:

- Core transaction loop is safe.
- Some non-critical gates are deferred with explicit owner and date.
- Buyer-facing copy does not promise deferred features.
- Pilot is limited to known internal/friendly users or one merchant.

### Red - Do Not Launch

Use this when:

- Voucher can be issued before payment confirmation.
- Stripe/manual payment boundaries are unclear or broken.
- Public voucher page exposes contact PII or payment internals.
- Merchant cannot redeem safely.
- Legal/payment copy makes unsafe promises.
- Production environment, webhook, or payment configuration is unknown.

## Global V1 Gates

### Gate 1 - Repository And Deployment Readiness

Required evidence:

- Repo is clean.
- `origin/main` is synced.
- Latest launch docs are committed.
- Production deployment target is known.
- Production environment variables are reviewed.
- DNS and HTTPS are verified if launching publicly.
- Health check or basic production page check passes if available.

Validation commands:

```powershell
git status --short --untracked-files=all
git log --oneline -10
```

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

### Gate 2 - Core Transaction Safety

Required evidence:

- Buyer can create pending purchase.
- No voucher is created at pending purchase time.
- Manual confirmation is OFFLINE-only.
- Stripe confirmation is ONLINE/card-only.
- Deprecated confirm-only RPC is disabled.
- Voucher issuance is atomic with payment confirmation.
- Voucher generation exhaustion raises exception for rollback.
- One purchase can produce at most one voucher.
- Delivery event is queued after voucher insertion.
- Expired pending purchases are not confirm-actionable.

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

### Gate 3 - Public Voucher Page Safety

Required evidence:

- Public voucher page uses `get_public_voucher_page` RPC.
- Anonymous users do not directly read `public.vouchers`.
- Public voucher RPC excludes buyer email.
- Public voucher RPC excludes buyer phone.
- Public voucher RPC excludes recipient email.
- Public voucher RPC excludes recipient phone.
- Public voucher RPC excludes Stripe/payment internals.
- Public voucher RPC excludes provider response payloads.
- Voucher page is noindex/nofollow.
- Voucher codes are not logged on query errors.

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

### Gate 4 - Redemption Safety

Required evidence:

- Redemption is authenticated merchant-only.
- Merchant ownership is derived from authenticated user.
- Wrong merchant cannot redeem another merchant's voucher.
- Redemption is full remaining-balance only for V1.
- Voucher row is locked during redemption.
- Voucher balance becomes zero.
- Voucher status becomes redeemed.
- Redemption record is created.
- Audit event is created.
- Second redemption attempt is safe.

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

### Gate 5 - Legal And Copy Safety

Required evidence:

- Terms page exists or pilot-specific legal wording is approved.
- Privacy page exists or pilot-specific privacy wording is approved.
- Refund/goodwill policy exists or pilot-specific wording is approved.
- Purchase consent checkbox is unchecked by default.
- Pre-purchase disclosure is visible before purchase/payment action.
- Validity/expiry copy is conservative.
- No absolute refund claims are used.
- No aggressive expiry claims are used.
- Offline payment responsibility is clear.
- Spanish copy has been reviewed.
- English tourist copy has been reviewed if tour operator pilot includes tourists.

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

### Gate 6 - Payment Readiness

Required evidence for direct/offline payments:

- Bizum instructions show only after successful pending purchase creation.
- Bank instructions show only after successful pending purchase creation.
- Cash instructions show only after successful pending purchase creation.
- Reference code is generated server-side.
- Merchant can confirm valid OFFLINE purchase.
- Merchant can reject/cancel pending purchase.
- Expired purchase cannot be confirmed.

Required evidence for Stripe payments if enabled:

- Stripe test/live mode decision exists.
- Stripe mode is explicit for the pilot.
- Stripe live mode is gated unless evidence is complete.
- Webhook endpoint is configured for selected environment.
- Webhook signature verification works.
- Webhook idempotency works.
- Duplicate webhook does not create duplicate voucher.
- Merchant Stripe onboarding state is known.
- Apple Pay / Google Pay are not promised unless configured and tested.

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

### Gate 7 - Email And Delivery Readiness

Required evidence:

- Voucher page remains the canonical source of truth.
- Email is treated as delivery channel only.
- Resend production rollout gate is approved if real-recipient email is enabled.
- Production domain evidence exists if real-recipient email is enabled.
- Delivery worker behavior is understood.
- Buyer-facing copy does not promise automatic email delivery unless it is enabled and tested.
- Delivery event is queued after voucher insertion.

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

### Gate 8 - Security And Operational Readiness

Required evidence:

- No service role key in frontend.
- No raw DB errors shown to users.
- No PII in logs for public purchase/voucher/redemption paths.
- Public text fields are validated and sanitized where appropriate.
- Rate limiting plan exists for public purchase creation.
- Rate limiting plan exists for public voucher lookup.
- Rate limiting plan exists for redemption.
- Rate limiting plan exists for auth routes.
- Rate limiting plan exists for webhooks.
- Security headers are configured or consciously deferred with owner.
- Processed webhook cleanup is documented or explicitly deferred.
- Pending purchase cleanup is documented or explicitly deferred.

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

### Gate 9 - E2E And Mobile Readiness

Required evidence:

- Spanish direct/offline purchase flow tested.
- English purchase flow tested.
- Merchant confirmation tested.
- Voucher page tested with valid code.
- Voucher page tested with invalid code.
- Redemption tested.
- Custom amount validation tested if custom amount gift cards are active.
- Inactive gift card is hidden and not purchasable.
- Missing merchant/card returns safe 404.
- iOS Safari manual test completed.
- Android Chrome manual test completed.

Decision:

- Status: TODO
- Owner: TODO
- Evidence link/notes: TODO
- Go/no-go notes: TODO

## Pilot 1 - Tour Operator Checklist

### Recommended Launch Position

Preferred launch mode:

- Restricted live Stripe if all Stripe gates pass.

Fallback launch mode:

- Direct/offline only if Stripe live gates are not ready.

### Tour Operator Must-Have Gates

Required evidence:

- Merchant profile exists and public page works.
- Merchant category/content supports tour or experience context.
- Spanish page works.
- English page works.
- English tourist copy is clear and not Bizum-first.
- Card/Stripe option is visible only if enabled and tested.
- Apple Pay / Google Pay are not promised unless configured and tested.
- Meeting point, address, or location guidance is clear if available.
- Timezone/Seville context is clear if relevant.
- Buyer can create purchase on mobile.
- Voucher page is usable on mobile.
- Merchant can redeem voucher.
- Refund/cancellation/service availability copy is conservative.

### Tour Operator Go/No-Go

- Status: TODO
- Owner: TODO
- Target date: TODO
- Decision: TODO
- Evidence link/notes: TODO
- Blockers: TODO

## Pilot 2 - Barber Checklist

### Recommended Launch Position

Preferred launch mode:

- Direct/offline first is acceptable.

Optional launch mode:

- Stripe after merchant onboarding and payment smoke test.

### Barber Must-Have Gates

Required evidence:

- Merchant profile exists and public page works.
- Gift card or service card exists.
- Bizum direct configured if merchant wants Bizum.
- Bank transfer configured if merchant wants bank transfer.
- Cash option is clear if enabled.
- Buyer sees payment instructions only after pending purchase creation.
- Merchant sees pending purchase.
- Merchant confirms payment after external verification.
- Voucher is issued exactly once.
- Voucher page works on buyer phone.
- Merchant can redeem full voucher.
- Full-redemption-only limitation is understood by merchant.

### Barber Go/No-Go

- Status: TODO
- Owner: TODO
- Target date: TODO
- Decision: TODO
- Evidence link/notes: TODO
- Blockers: TODO

## Barber Manual Validation Evidence

Date: 2026-06-13  
Tester: Manoj  
Merchant type: Barber  
Decision: GREEN - Ready for controlled pilot  
Status: PASS  

Validated areas:

- Spanish public merchant page passed.
- English public merchant page passed.
- Public merchant page showed a friendly localized barber category label.
- Public merchant page SEO basics passed.
- Spanish purchase page passed.
- English purchase page passed.
- Spanish local direct-payment flow passed.
- Bizum option appeared only when merchant Bizum phone was configured.
- Bank transfer option appeared only when merchant IBAN was configured.
- Cash option behavior was accepted for the controlled barber pilot.
- Card option appeared only when merchant Stripe readiness conditions were met.
- Apple Pay and Google Pay were not promised unless configured and tested.
- Legal disclosure and localized legal link passed.
- Consent checkbox remained unchecked by default.
- Personal message counter passed.
- Pending purchase creation passed.
- Reference code display passed.
- Payment instructions appeared only after pending purchase success.
- Bizum and bank details were not exposed before successful pending purchase creation.
- Merchant pending-purchase dashboard passed.
- Expired pending purchases were not confirm-actionable.
- Valid offline payment confirmation passed.
- Cancel/reject action was available where appropriate.
- Voucher issuance after confirmation passed.
- Public voucher page passed.
- Voucher amount/status visibility passed.
- Public voucher page did not expose contact PII.
- Voucher page noindex/nofollow behavior passed.
- Merchant redemption passed.
- Second redemption attempt behaved safely.
- Mobile checks passed for merchant page, purchase page, voucher page, and merchant dashboard purchase confirmation.
- No pilot-blocking gaps found.

Notes:

- Cash is currently always available as an offline option. This is accepted for the controlled barber pilot and can be revisited later if merchant-level cash enablement is needed.
- Stripe is optional for the barber pilot. The direct/offline payment path is sufficient for controlled launch.
- No code change is required from this validation.
## Pilot 3 - Driving Class Checklist

### Recommended Launch Position

Preferred launch mode:

- Direct/offline first or restricted Stripe after legal/service wording review.

### Driving Class Must-Have Gates

Required evidence:

- Merchant profile exists and public page works.
- Service gift card configuration is clear.
- Purchase copy explains what the gift covers.
- Validity/expiry wording is conservative.
- Scheduling expectations are clear.
- Cancellation/refund/goodwill wording is reviewed.
- Buyer understands voucher issuance happens after payment confirmation.
- Merchant understands confirmation responsibility.
- Merchant can redeem full voucher.
- Full-redemption-only limitation is understood.
- Higher-value purchase support workflow is understood.

### Driving Class Go/No-Go

- Status: TODO
- Owner: TODO
- Target date: TODO
- Decision: TODO
- Evidence link/notes: TODO
- Blockers: TODO

## Launch Evidence Log Template

Use this format for each completed test:

```text
Date:
Tester:
Merchant type:
Environment:
Payment mode:
Locale:
Device/browser:
Scenario:
Expected result:
Actual result:
Evidence link/screenshot:
Issues found:
Decision:
```

## Tour Operator Manual Validation Evidence

Date: 2026-06-13  
Tester: Manoj  
Merchant type: Tour operator  
Decision: GREEN - Ready for controlled pilot  
Status: PASS  

Validated areas:

- Spanish public merchant page passed.
- English public merchant page passed.
- Spanish purchase page passed.
- English purchase page passed.
- Legal disclosure and localized legal link passed.
- Consent checkbox remained unchecked by default.
- Payment method visibility passed.
- Pending purchase creation passed.
- Reference code display passed.
- Payment instructions appeared only after pending purchase success.
- Merchant pending-purchase dashboard passed.
- Valid offline payment confirmation passed.
- Voucher issuance after confirmation passed.
- Public voucher page passed.
- Voucher amount/status visibility passed.
- Public voucher page did not expose contact PII.
- Merchant redemption passed.
- Second redemption attempt behaved safely.
- Mobile checks passed for merchant, purchase, and voucher pages.
- No pilot-blocking gaps found.

Notes:

- Cash is currently always available as an offline option. This is accepted for the controlled tour operator pilot and can be revisited later if merchant-level cash enablement is needed.
- Stripe platform fee is intentionally waived for the controlled pilot and documented separately.
- No code change is required from this validation.
## Known Allowed Limitations For Controlled V1 Pilot

The following limitations are acceptable if clearly understood and not promised as completed:

- Marketplace/discovery not available.
- Partial redemption not available.
- WhatsApp delivery not available.
- Rich media personalization not available.
- PDF voucher not available unless separately implemented.
- Staff accounts not available.
- Refund automation not available.
- Scheduled delivery not available.
- Advanced analytics not available.
- Automated pending purchase cleanup not available.
- Processed webhook cleanup may be deferred if documented.

## Launch Blockers

The following should block launch:

- Voucher issued before payment confirmation.
- Manual confirmation can confirm ONLINE/card purchase.
- Stripe confirmation can confirm OFFLINE purchase.
- Deprecated confirm-only RPC is executable by client roles.
- Public voucher page exposes contact PII.
- Public voucher page directly exposes `public.vouchers` to anonymous users.
- Wrong merchant can redeem voucher.
- Expired pending purchase can be confirmed.
- Production Stripe mode is unclear while card payments are visible.
- Real-recipient email is promised but Resend rollout is not approved.
- Legal/copy makes unsafe absolute claims.
- Merchant does not understand pilot limitations.

## Architect Review Checklist

The Architect should confirm:

- Money-state transitions are DB/RPC enforced.
- UI is not the only guard for critical operations.
- Payment source boundaries are enforced.
- Public data boundary is safe.
- RLS and RPC permissions are still least privilege.
- Webhook idempotency is safe.
- Voucher uniqueness is enforced.
- Redemption is atomic and merchant-scoped.
- Deferred automation is documented.

Architect sign-off:

- Name: TODO
- Date: TODO
- Decision: TODO
- Notes: TODO

## Product Owner Review Checklist

The Product Owner should confirm:

- Buyer promise matches implemented behavior.
- Merchant promise matches implemented behavior.
- Recipient experience is acceptable for controlled pilot.
- V1 limitations are not hidden.
- V1.5 features are not promised in V1 copy.
- Tourist mode copy is clear for tour operator pilot.
- Full-redemption-only limitation is acceptable.
- Refund/validity copy is conservative.

PO sign-off:

- Name: TODO
- Date: TODO
- Decision: TODO
- Notes: TODO

## Project Manager Review Checklist

The Project Manager should confirm:

- Each launch gate has owner and evidence.
- Open risks have owner and due date.
- Pilot merchant knows scope and limitations.
- Support workflow exists for abandoned/failed purchases.
- Smoke test evidence is captured.
- Mobile checks are captured.
- Go/no-go decision is recorded.
- Rollback/disable plan exists for Stripe and email if needed.

PM sign-off:

- Name: TODO
- Date: TODO
- Decision: TODO
- Notes: TODO

## Recommended Next Steps

1. Commit this checklist document.
2. Fill TODO fields only when real evidence exists.
3. Use the checklist for the tour operator pilot first.
4. Do not start marketplace/discovery until pilot gate evidence is reviewed.
5. If a gap is found, create a focused implementation slice with minimal diff and validation commands.

## Acceptance Criteria

This document is complete when:

- Pilot order is documented.
- Global launch gates are documented.
- Tour operator checklist is documented.
- Barber checklist is documented.
- Driving class checklist is documented.
- Allowed V1 limitations are documented.
- Launch blockers are documented.
- Architect, PO, and PM sign-off sections exist.
- No code or SQL changes are included.

## Final Position

ParaUsted V1 should launch only as a controlled pilot with explicit gates and evidence. The product is strong enough to proceed toward pilot readiness, but launch should be disciplined: first tour operator, then barber, then driving class. The team should protect the completed transaction-loop hardening and focus now on real pilot evidence, copy safety, mobile checks, and merchant readiness.
