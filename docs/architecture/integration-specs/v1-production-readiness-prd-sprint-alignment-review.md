# ParaUsted V1 Production Readiness - PRD And Sprint Alignment Review

## Status

State: planning/documentation review only.  
Baseline commit: `8fe8858 docs(project): summarize transaction loop readiness`.  
Reviewed inputs:

- `ParaUsted_PRD_v1_1_Change_Pack.md`
- `ParaUsted_Revised_MVP_Sprint_Plan_8_Weeks.md`
- Current transaction-loop readiness handoff/docs

Recommended path: `docs/architecture/integration-specs/v1-production-readiness-prd-sprint-alignment-review.md`  
Recommended commit: `docs(project): review v1 readiness against prd and sprint plan`

## Executive Summary

The current ParaUsted V1 transaction-loop hardening is aligned with the PRD v1.1 Change Pack and the Revised MVP Sprint Plan. No reason was found to reopen the completed money-state hardening work.

The main conclusion is:

- Core transaction loop: aligned and hardened.
- V1 production readiness: conditionally ready for controlled pilot after launch gates are addressed.
- Broad public launch: not recommended until Stripe mode, email rollout, legal/copy review, production environment, smoke tests, and operational ownership are completed.
- V1.5: should focus on communication, voucher experience polish, marketplace/discovery, SEO expansion, and operational cleanup.

## Alignment Decision

Current recommendation:

Proceed with the production readiness / known limitations document as the next documentation slice. Do not implement code unless a specific launch-blocking gap is discovered.

No blocking architecture gap was found in the completed transaction loop. The remaining risks are mostly production gates, operations, legal copy, UX polish, and evidence collection.

## PRD Alignment Review

### 1. Spain-First, Legal-Safety-First Positioning

PRD expectation:

- Spain first.
- Seville primary launch city.
- EUR, Europe/Madrid, Spanish primary, English secondary.
- Conservative legal wording and clear disclosure.

Current readiness alignment:

- Existing docs and implementation direction are Spain-first.
- Spanish/English localization is part of the current product architecture.
- Production readiness document correctly treats legal/copy review as a launch gate.

Assessment: aligned.

Recommended follow-up:

- Add legal/copy review evidence before broad public launch.
- Avoid aggressive expiry or refund wording until reviewed.

### 2. No Voucher Before Payment Confirmation

PRD expectation:

- No voucher before payment confirmation.
- Direct payments require merchant confirmation.
- Stripe payments require webhook confirmation.

Current readiness alignment:

- Manual confirmation is OFFLINE-only.
- Stripe confirmation is ONLINE/card-only.
- Deprecated confirm-only RPC is disabled.
- Voucher issuance is atomic with payment confirmation.
- Voucher-code generation exhaustion raises exception for rollback.

Assessment: strongly aligned.

Recommended follow-up:

- Keep DB/RPC boundaries as final authority.
- Do not allow client-only confirmation logic.

### 3. One Gift-Card Lifecycle Across Payment Methods

PRD expectation:

- Payment method changes only the confirmation path.
- Voucher lifecycle remains the same after confirmation.

Current readiness alignment:

- Manual and Stripe confirmation paths converge on voucher issuance.
- Delivery event queueing is centralized after voucher insert.
- Voucher page is the source of truth.
- Full redemption completes the V1 lifecycle.

Assessment: aligned.

Recommended follow-up:

- Keep payment strategies modular.
- Avoid duplicating voucher issuance logic in future payment flows.

### 4. Direct Payment Confirmation Center Is Core V1

PRD expectation:

- Pending payment requests.
- Confirm payment.
- Reject/cancel request.
- Audit every action.

Current readiness alignment:

- Merchant confirmation exists.
- Manual cancellation/rejection is authenticated-only.
- Expired pending purchases are not confirm-actionable.
- Transaction-loop docs capture audit and permission boundaries.

Assessment: aligned for V1 core.

Possible V1 polish gap:

- Search/filter UX, masking buyer email where appropriate, and confirmation-center polish should be verified against current UI before launch.

Recommended follow-up:

- Treat confirmation-center polish as Week 7/8 UX verification unless already done.

### 5. Stripe Remains In V1

PRD expectation:

- Stripe Connect remains in V1.
- Stripe webhook confirms online payments.
- Webhook must be signature verified and idempotent.
- PaymentIntent IDs must not be trusted from the client.

Current readiness alignment:

- Stripe path is separated as ONLINE/card-only.
- Stripe confirmation RPC is service-role only by design.
- Processed webhook idempotency exists.
- Stripe mode decision remains a production gate.

Assessment: architecture aligned; production gate still open.

Recommended follow-up:

- Create a Stripe test/live mode decision document.
- Capture webhook configuration and smoke-test evidence.

### 6. Voucher Page Is Source Of Truth

PRD expectation:

- Email, WhatsApp, and download are delivery channels.
- `/v/[code]` is the canonical voucher experience.
- Page should show safe voucher state and avoid unnecessary PII.

Current readiness alignment:

- Public voucher page uses `get_public_voucher_page` RPC.
- Direct anonymous voucher table access is blocked.
- Contact PII and provider/payment internals are excluded.
- Voucher page is noindex/nofollow.

Assessment: strongly aligned.

Recommended follow-up:

- Improve UX in V1.5.
- Add QR/PDF only after the core pilot is stable.

### 7. Full Redemption Only For V1

PRD and sprint expectation:

- Merchant can fully redeem voucher.
- Partial redemption is deferred.

Current readiness alignment:

- `redeem_voucher_full` is authenticated merchant-only.
- Voucher row is locked.
- Balance is set to zero.
- Voucher status becomes redeemed.
- Audit event is written.

Assessment: aligned.

Recommended follow-up:

- Clearly communicate full-redemption-only limitation in merchant onboarding/help copy.

### 8. Tourist Mode For Seville

PRD expectation:

- Tourist mode is V1.
- English public pages and purchase flow.
- Card/Apple Pay/Google Pay via Stripe.
- Email/download priority.
- Clear location/timezone copy.
- Avoid Bizum assumption for foreign buyers.

Current readiness alignment:

- English localized routes and content foundation exist.
- Stripe remains in V1.
- Current production readiness document mentions tourist/discovery as a follow-up, but tourist mode may need clearer V1 launch verification.

Assessment: partially aligned; verify UI/copy before launch.

Recommended follow-up:

- Add a tourist-mode launch checklist item.
- Verify English purchase flow does not assume Bizum for tourist/card-first scenarios.
- Verify tour/experience merchants can show location or meeting point where available.

### 9. V1.5 Marketplace And SEO Expansion

PRD expectation:

- Marketplace/discovery moves to V1.5.
- SEO foundation starts in V1.
- V1.5 adds city/category/relationship landing pages.

Current readiness alignment:

- Public merchant pages and localized SEO foundation exist.
- Marketplace/discovery is correctly deferred.
- Production readiness document separates V1 and V1.5.

Assessment: aligned.

Recommended follow-up:

- Keep marketplace out of current production-readiness slice.
- Plan V1.5 SEO pages after pilot feedback.

## Sprint Plan Alignment Review

### Week 7: Legal Safety, Security Hardening, And Operational Readiness

Sprint expectation:

- Terms, privacy, refund/goodwill policy.
- Purchase consent unchecked by default.
- Pre-purchase disclosure visible before payment.
- Conservative validity/expiry copy.
- Rate limiting plan.
- Security headers.
- Zod validation on mutations/routes.
- Input sanitization.
- No PII in logs.
- Audit coverage.
- Processed webhook cleanup planned.
- UI/UX polish.

Current readiness assessment:

- Transaction-loop hardening covers many high-risk money-state boundaries.
- Pending purchase expiry minimum is documented.
- Processed webhook cleanup is identified as deferred/planned.
- Legal/copy review remains a launch gate.
- Rate limiting/security headers/input sanitization should be verified separately.

Potential gaps to verify before pilot:

1. Legal pages exist and are linked.
2. Purchase consent remains unchecked by default.
3. Pre-purchase disclosure is visible before pending purchase/payment creation.
4. Validity/expiry copy is conservative.
5. No PII in logs across purchase/voucher/redemption paths.
6. Rate limiting plan exists for public purchase, voucher lookup, redemption, auth, and webhooks.
7. Security headers are configured or consciously deferred.
8. Input sanitization is applied to public text fields.

### Week 8: Testing, Launch, And First Merchants

Sprint expectation:

- E2E direct payment flow.
- E2E Stripe flow.
- E2E custom amount validation.
- E2E Spanish and English flows.
- E2E tourist mode for tour merchant.
- Mobile testing.
- Production Supabase verification.
- Production environment variables.
- Stripe live/test decision.
- Stripe webhook endpoint configured.
- Vercel production deployment.
- DNS and HTTPS verified.
- Health check and smoke test.
- First pilot merchant onboarding.

Current readiness assessment:

- Core transaction loop is documented and hardened.
- Production readiness document correctly marks environment, Stripe mode, email rollout, smoke testing, and pilot operations as gates.

Potential gaps to verify before pilot:

1. Production environment variables are verified.
2. Stripe webhook endpoint is configured for selected mode.
3. Production deployment and DNS are verified.
4. Manual E2E smoke tests are captured.
5. Spanish and English flows are manually checked.
6. Tourist-mode flow is manually checked for at least one tour/experience merchant.
7. Mobile checks are done on iOS Safari and Android Chrome.
8. First pilot merchant onboarding script/checklist exists.

## Recommended Updates To The Production Readiness Document

Add or emphasize the following points in `v1-production-readiness-limitations.md` if not already included:

1. Tourist mode is V1, not V1.5.
   - Keep marketplace/discovery in V1.5.
   - But English tourist purchase flow and card-first behavior should be launch-verified in V1.

2. Week 7 security hardening checks should be explicit.
   - Rate limiting plan.
   - Security headers.
   - Input sanitization.
   - No PII logs.
   - Generic errors.

3. Legal pages are a V1 Definition of Done item.
   - Terms.
   - Privacy.
   - Refund/goodwill policy.
   - Conservative validity/expiry copy.

4. Week 8 production deployment checks should be explicit.
   - Production Supabase.
   - Vercel deployment.
   - DNS/HTTPS.
   - Env vars.
   - Health check.
   - Production smoke test.

5. First pilot merchant readiness should be explicit.
   - Merchant onboarding.
   - Gift card creation.
   - Direct payment settings.
   - Controlled purchase.
   - Confirm payment.
   - Issue voucher.
   - Redeem voucher.

## Updated Launch Gate Summary

### Gate A - Transaction Safety

Status: mostly complete.

Required evidence:

- Manual confirmation OFFLINE-only.
- Stripe confirmation ONLINE/card-only.
- Deprecated confirm-only RPC disabled.
- Voucher issuance atomic with payment confirmation.
- Voucher exhaustion raises exception for rollback.
- Redemption authenticated merchant-only.
- Expired pending purchases not confirm-actionable.

### Gate B - Public Data Safety

Status: mostly complete.

Required evidence:

- Public voucher page uses safe RPC.
- Anonymous direct voucher table access blocked.
- Contact PII excluded.
- Provider/payment internals excluded.
- Voucher codes not logged.
- Voucher page noindex/nofollow.

### Gate C - Legal And Copy

Status: open.

Required evidence:

- Terms page.
- Privacy page.
- Refund/goodwill policy page.
- Conservative expiry/validity copy.
- Purchase consent unchecked by default.
- Pre-purchase disclosure visible.
- Spanish copy review.
- English tourist copy review.

### Gate D - Stripe Production Readiness

Status: open.

Required evidence:

- Test/live mode decision.
- Webhook endpoint configured.
- Webhook signing secret configured.
- Stripe Connect merchant flow verified if included in pilot.
- Online/card smoke test completed.
- Duplicate webhook/idempotency behavior verified.

### Gate E - Email/Delivery Readiness

Status: gated.

Required evidence:

- Resend production domain verified if real-recipient email is enabled.
- Real-recipient rollout approval captured.
- Delivery worker monitoring/operation understood.
- If not enabled, launch copy must not promise automatic email delivery beyond what is actually enabled.

### Gate F - Operational Readiness

Status: open.

Required evidence:

- Pending purchase expiry handling understood.
- Manual cancellation workflow understood.
- Processed webhook cleanup plan documented or explicitly deferred.
- Support workflow for failed/abandoned purchases documented.
- First pilot merchant runbook/checklist exists.

### Gate G - E2E And Mobile Testing

Status: open.

Required evidence:

- Direct payment E2E.
- Stripe E2E if Stripe enabled for pilot.
- Custom amount E2E.
- Spanish flow E2E.
- English flow E2E.
- Tourist mode E2E.
- iOS Safari manual test.
- Android Chrome manual test.

## Architect, PO, PM Guidance

### Architect Guidance

Protect the completed transaction-loop invariants. Do not reopen B9-B13 unless evidence shows a defect.

Architect focus now:

- Production environment correctness.
- Rate limits and security headers.
- No PII logging.
- Stripe webhook production evidence.
- Processed webhook cleanup policy.
- Operational rollback/support boundaries.

### Product Owner Guidance

Protect the buyer, recipient, and merchant promise.

PO focus now:

- Make V1 limitations explicit.
- Do not promise V1.5 features in V1 launch copy.
- Verify tourist-mode experience if tourists are part of pilot positioning.
- Prioritize buyer/merchant notifications and voucher UX polish for V1.5.

### Project Manager Guidance

Protect launch discipline.

PM focus now:

- Convert open gates into owners and due dates.
- Capture evidence for each gate.
- Keep V1 launch as controlled pilot until gates are closed.
- Do not let V1.5 growth work distract from Week 7/8 readiness.

## Final Recommendation

The PRD and Sprint Plan confirm that the current next slice is correct:

Production readiness / known V1 limitations / V1.5 priorities document.

One adjustment is recommended: explicitly treat Tourist Mode verification as a V1 launch gate, while keeping marketplace/discovery as V1.5.

Recommended next sequence:

1. Commit `v1-production-readiness-limitations.md` if not committed yet.
2. Add this PRD/Sprint alignment review document.
3. Update the readiness document only if you want the tourist-mode and Week 7/8 gate details merged into it.
4. Next focused planning slice: Stripe test/live mode decision document.

Recommended pilot merchant order:
1. Tour operator - validates tourist mode, English flow, Stripe/card-first purchase, Seville experience positioning.
2. Barber - validates local direct-payment flow, Bizum/bank/cash, merchant confirmation, simple redemption.
3. Driving class - validates service gift cards and higher-trust operational wording after core pilot confidence.