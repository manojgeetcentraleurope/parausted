# Stripe Test/Live Mode Decision

## Status

State: planning/decision document only.  
Baseline commit: `efaf2e4 docs(project): document v1 production readiness`.  
Recommended file path: `docs/architecture/integration-specs/stripe-test-live-mode-decision.md`.  
Recommended commit after review: `docs(payment): document stripe test live mode decision`.

This document records the ParaUsted V1 decision for Stripe test mode, live mode, webhook readiness, Connect onboarding, wallet payments, and launch gating. It does not implement code, SQL, environment changes, Stripe Dashboard changes, or production rollout by itself.

## Decision Summary

ParaUsted should keep Stripe enabled as a V1 capability, but production live-card payments must be gated.

Recommended decision:

1. Development and validation continue in Stripe test mode or sandbox-style testing.
2. The first public pilot may use Stripe live mode only after all required gates in this document are closed.
3. If Stripe live gates are not closed, the pilot can still proceed with direct/offline payments only, and online/card payment options must remain hidden or disabled for buyers.
4. Because the first pilot merchant is a tour operator, Stripe live readiness should be treated as high priority, not optional polish.
5. Stripe must remain a payment strategy. It must not bypass the already-hardened voucher lifecycle.

Short version:

- V1 includes Stripe.
- Controlled pilot can launch with Stripe only if gates pass.
- No broad public Stripe launch until production evidence exists.
- No voucher is issued until Stripe webhook confirmation succeeds.

## Why This Decision Exists

ParaUsted already has strong transaction-loop boundaries:

- Manual confirmation is OFFLINE-only.
- Stripe confirmation is ONLINE/card-only.
- Voucher issuance is atomic with payment confirmation.
- Deprecated confirm-only RPC is disabled.
- One purchase can produce at most one voucher.
- Public voucher page is source of truth.

The remaining risk is not the core transaction model. The remaining Stripe risk is operational production readiness:

- Correct live API keys.
- Correct webhook signing secret.
- Correct production webhook endpoint.
- Correct Stripe Connect onboarding state.
- Correct wallet/domain configuration.
- Correct idempotent webhook behavior.
- Correct buyer-facing launch copy.
- Correct pilot merchant expectations.

## Product Context

The PRD keeps Stripe in V1 because:

- There is existing demand.
- Tourist mode needs card payments.
- Online payment automation is core learning.
- Stripe Connect keeps payment architecture safer than holding funds directly.

The first pilot order is:

1. Tour operator.
2. Barber.
3. Driving class.

This makes Stripe important for the first pilot because tour operator/tourist mode depends more strongly on online card payments than a local barber pilot would.

## Stripe Mode Definitions For ParaUsted

### Test Mode

Test mode is used for development, staging, and validation. It must not be represented to merchants or buyers as real payment processing.

Use test mode for:

- Local development.
- Preview/staging validation.
- Webhook handler validation.
- Connect onboarding simulation.
- Stripe retry/idempotency testing.
- Internal demo flows.
- E2E automation with test cards.

Test mode must not:

- Be used for real buyer payments.
- Be mixed with live purchase records in a way that confuses reporting.
- Be shown as available real card payment to pilot buyers.

### Live Mode

Live mode processes real buyer payments. It must be enabled only after gates are closed.

Use live mode for:

- Controlled production pilot with an approved merchant.
- Real tourist/card transactions.
- Live Apple Pay / Google Pay / card checkout if configured and available.

Live mode must not:

- Be enabled accidentally through missing or wrong environment variables.
- Issue vouchers from client-side payment state.
- Skip webhook signature verification.
- Skip idempotency checks.
- Be enabled for merchants without Stripe onboarding readiness.

## Selected V1 Launch Position

### Default Position

Default launch position:

- Direct/offline payments are the safest V1 fallback.
- Stripe is available only when production gates pass.
- Stripe payment UI should be hidden or disabled when the global flag, merchant onboarding state, or production environment is not ready.

### Tour Operator Pilot Position

For the first tour operator pilot:

- Stripe live readiness should be prepared before the pilot if the pilot is positioned for tourists.
- If Stripe is not ready, the pilot must be positioned as a direct/offline pilot only.
- English tourist copy must not promise card, Apple Pay, Google Pay, instant email delivery, or automatic online payment unless those gates are actually closed.

### Barber Pilot Position

For the barber pilot:

- Direct/offline payment can be enough for a first local pilot.
- Stripe can remain disabled until the merchant is onboarded and verified.
- Bizum/bank/cash flows are more important than card-first tourist flow.

### Driving Class Pilot Position

For the driving class pilot:

- Stripe may be useful for higher-value purchases, but legal/service wording may be more important.
- Validate refund, cancellation, service availability, and validity copy before expanding online payment claims.

## Required Launch Gates

### Gate 1 - Stripe Account And Environment Separation

Required evidence:

- Test and live API keys are separate.
- Production environment uses live keys only when live mode is approved.
- Preview/staging environment uses test keys.
- No Stripe secret key is exposed to the frontend.
- Publishable key is safe for frontend use and matches intended mode.
- Secret key is server-only.
- Webhook signing secret is stored server-side only.

Go/no-go:

- Go if keys are explicitly configured per environment.
- No-go if production may silently use test keys or staging may accidentally use live keys.

### Gate 2 - Webhook Endpoint And Signature Verification

Required evidence:

- Production webhook endpoint is configured in Stripe Dashboard for the selected mode.
- Endpoint URL points to the production deployment.
- Webhook signing secret matches the production endpoint.
- Webhook handler verifies Stripe signature before any side effect.
- Handler uses raw request body where required by the Stripe SDK.
- Handler returns safe generic errors.
- Handler does not expose Stripe internals to the buyer.

Go/no-go:

- Go if signature verification passes in the selected environment.
- No-go if webhook confirmation depends on unverified client data.

### Gate 3 - Webhook Idempotency And Retry Safety

Required evidence:

- `processed_webhooks` is used for Stripe event idempotency.
- Duplicate Stripe events do not create duplicate vouchers.
- `vouchers.purchase_id` uniqueness remains enforced.
- Transient database failures allow Stripe retry where appropriate.
- Permanent failures are handled safely.
- Webhook processing does not move purchase state without voucher issuance.

Go/no-go:

- Go if duplicate webhook test confirms one voucher only.
- No-go if retry behavior can issue multiple vouchers or leave confirmed purchase without voucher.

### Gate 4 - Stripe Connect Merchant Readiness

Required evidence:

- Merchant has a connected Stripe account if Stripe Connect is required for the flow.
- Merchant onboarding state is verified before showing online/card payment options.
- Merchant account has the necessary capability state for receiving payments/payouts according to the chosen integration.
- Platform fee behavior is documented if used.
- Merchant understands payout timing and Stripe responsibility boundaries.

Go/no-go:

- Go if the pilot merchant can accept payment through the intended Stripe path.
- No-go if merchant Stripe onboarding state is unknown or incomplete.

### Gate 5 - Online/Card Purchase Flow

Required evidence:

- Pending purchase is created before Stripe payment confirmation.
- Amount is derived server-side from the gift card and selected amount rules.
- Client cannot override amount, merchant, gift card, or purchase ownership.
- Payment metadata includes only safe references needed for reconciliation.
- Stripe webhook confirms only ONLINE/card purchases.
- Stripe webhook rejects OFFLINE purchases.
- Voucher is issued only after successful webhook confirmation.

Go/no-go:

- Go if online/card E2E produces exactly one voucher after webhook confirmation.
- No-go if voucher is issued at checkout creation or before webhook confirmation.

### Gate 6 - Wallet Payments: Apple Pay And Google Pay

Required evidence:

- Wallet payment methods are enabled only if supported by the chosen Stripe integration and merchant/account context.
- Apple Pay domain registration is completed for production domains if Apple Pay is offered on the web.
- HTTPS is active for the production domain.
- Wallet buttons are tested on supported devices/browsers.
- Buyer-facing copy does not promise Apple Pay or Google Pay unless actually visible and working.

Go/no-go:

- Go if wallet methods are tested successfully or clearly not promised.
- No-go if tourist copy advertises wallets that are not configured.

### Gate 7 - Buyer And Merchant Copy

Required evidence:

- English tourist copy clearly explains card payment if enabled.
- Spanish/local copy does not assume Stripe if offline payment is selected.
- Payment confirmation and voucher issuance timing is clear.
- Buyer is told voucher is issued after successful payment confirmation.
- Refund/cancellation wording is conservative and legally reviewed or approved for pilot.

Go/no-go:

- Go if copy matches actual enabled payment methods.
- No-go if copy promises instant delivery/card/wallet payment when gates are not closed.

### Gate 8 - Production Smoke Test

Required evidence:

- One successful live low-value card payment test if live mode is approved.
- Webhook event is received and verified.
- Purchase becomes payment-confirmed through Stripe path.
- Voucher is issued exactly once.
- Delivery event is queued.
- Voucher page opens with safe public fields.
- Merchant can redeem voucher.
- Audit events are present.

Go/no-go:

- Go if full live smoke test passes for pilot merchant.
- No-go if production smoke test has not been completed.

## Recommended Environment Policy

### Local Development

Use:

- Stripe test secret key.
- Stripe test publishable key.
- Local webhook forwarding through Stripe tooling if needed.
- Test connected accounts.
- Test cards and test payment methods.

Do not use:

- Live keys.
- Real buyer emails beyond approved test addresses.
- Real production merchant IDs unless explicitly part of a controlled test.

### Preview/Staging

Use:

- Stripe test keys.
- Test webhook endpoint or test-mode event destination.
- Test connected account.
- Safe internal recipient emails only.

Do not use:

- Live keys.
- Real buyer payment cards.
- Public marketing claims that imply production payment readiness.

### Production Before Live Approval

Use:

- Direct/offline payments only.
- Stripe UI hidden or disabled.
- Production environment prepared but not active for live payment if gates are open.

Do not use:

- Live Stripe payments.
- Wallet claims.
- Automated email/payment promises not yet approved.

### Production After Live Approval

Use:

- Live Stripe secret key server-side.
- Live Stripe publishable key client-side.
- Live webhook signing secret server-side.
- Production webhook endpoint.
- Approved pilot merchant connected account.
- Restricted pilot rollout first.

Do not use:

- Test keys in production online payment flow.
- Unapproved merchants for Stripe live payment.
- Unverified webhook events.

## Feature Flag Policy

Stripe visibility must require all relevant conditions:

- Global `stripePaymentsEnabled` is true.
- Environment allows Stripe for this deployment.
- Merchant has Stripe onboarding complete.
- Gift card is active.
- Payment source is ONLINE/card.
- Stripe mode decision allows buyer-facing card flow.

Recommended behavior:

- If any condition fails, hide online/card payment option.
- Do not show disabled card option with confusing copy unless needed for merchant education.
- For English tourist flow, prefer card-first only when Stripe is truly available.
- For Spanish local flow, direct/offline methods remain acceptable and should not be made second-class.

## Webhook Event Scope

For V1, subscribe only to events needed for payment confirmation and operational safety.

Recommended V1 event focus:

- Successful Checkout Session or PaymentIntent completion event used by the implemented integration.
- Payment failure event only if needed for buyer/merchant status visibility.
- Connect account update events only if onboarding state is actively synchronized.

Avoid:

- Listening to all events without need.
- Adding subscription/billing events unrelated to V1 gift-card purchase flow.
- Treating every Stripe event as a business transaction event.

## Data And Logging Rules

Do not log:

- Full Stripe payloads in production logs.
- Buyer card details.
- Payment method details beyond safe identifiers.
- Webhook signing secrets.
- Secret keys.
- Voucher codes in error logs.
- Contact PII in public route errors.

Safe logging examples:

- Stripe event ID.
- Event type.
- Purchase ID if internal logs are access-controlled.
- Safe error category.
- Processing result.

Unsafe logging examples:

- Raw webhook body.
- Secret key.
- Webhook secret.
- Full customer/contact payload.
- Full provider response.

## Test Evidence Checklist

Before enabling live Stripe for the tour operator pilot, capture evidence for:

1. Test-mode online purchase creates pending purchase.
2. Test-mode webhook confirms purchase.
3. Test-mode voucher is issued exactly once.
4. Duplicate webhook delivery does not create duplicate voucher.
5. Stripe RPC rejects OFFLINE purchase.
6. Manual RPC rejects ONLINE/card purchase.
7. Wrong or missing webhook signature is rejected.
8. Expired purchase cannot be confirmed by Stripe path.
9. Public voucher page opens without PII.
10. Merchant redemption succeeds once.
11. Second redemption attempt is safe.
12. English tourist flow copy matches enabled payment methods.
13. Mobile checkout works on at least one iOS and one Android path if wallets/card are promised.
14. Production low-value live smoke test passes before real buyer use.

## Launch Mode Recommendation By Pilot

### Tour Operator

Recommended payment position:

- Preferred: live Stripe enabled after gates pass.
- Fallback: direct/offline only if Stripe gates remain open.

Reason:

- Tourist mode is V1.
- Tourists need card-first purchase more than local Bizum-first flows.
- English purchase flow and instant online payment are part of the strongest product story.

### Barber

Recommended payment position:

- Direct/offline first is acceptable.
- Stripe can be added after merchant onboarding and basic live test.

Reason:

- Local buyers can use Bizum/bank/cash.
- The core direct-payment confirmation center is easier to validate here.

### Driving Class

Recommended payment position:

- Direct/offline first or restricted Stripe after legal/service copy review.

Reason:

- Higher trust/service expectations require careful refund, scheduling, and validity wording.

## Go/No-Go Matrix

### Go For Direct/Offline Pilot Only

Allowed when:

- Direct/offline flow is working.
- Stripe gates are still open.
- Online/card payment UI is hidden or disabled.
- Buyer copy does not promise card/wallet payment.
- Merchant understands manual confirmation.

### Go For Restricted Live Stripe Pilot

Allowed when:

- All Stripe gates pass.
- One live low-value smoke test passes.
- Pilot merchant is approved.
- Support/rollback workflow is understood.
- Buyer-facing copy matches enabled payment methods.

### No-Go For Stripe Live

No-go if any of the following is true:

- Webhook signing secret is missing or wrong.
- Webhook endpoint is not configured for production.
- Webhook signature verification is not working.
- Duplicate webhook can issue duplicate vouchers.
- Manual confirmation can confirm ONLINE/card purchases.
- Stripe confirmation can confirm OFFLINE purchases.
- Merchant Stripe onboarding state is unknown.
- Wallets are advertised but not configured/tested.
- Production smoke test is not completed.

## Operational Response Plan

### If Stripe Payment Succeeds But Voucher Is Not Issued

Immediate action:

- Do not manually edit purchase/voucher tables directly.
- Inspect webhook event processing status.
- Check `processed_webhooks` state.
- Check purchase status and voucher existence.
- If the webhook failed transiently, allow retry where safe.
- If permanent failure occurred, use a controlled admin/DB runbook only after root cause is understood.

Follow-up:

- Add audit note.
- Document incident.
- Decide whether buyer/merchant communication is needed.

### If Duplicate Webhook Arrives

Expected behavior:

- Event is recognized as already processed or voucher uniqueness prevents duplicate issuance.
- Handler returns safe success where appropriate.
- No second voucher is issued.

### If Stripe Live Must Be Disabled

Immediate action:

- Disable `stripePaymentsEnabled` or equivalent production flag.
- Hide online/card payment option.
- Keep direct/offline flow available if safe.
- Update buyer-facing copy if needed.
- Communicate with pilot merchant.

## Acceptance Criteria

This decision document is accepted when:

- Stripe mode decision is explicit.
- Test/live environment separation is documented.
- Webhook signature and idempotency gates are documented.
- Connect merchant readiness gates are documented.
- Apple Pay / Google Pay gating is documented.
- Tour operator pilot implications are documented.
- Direct/offline fallback is documented.
- Go/no-go rules are clear.
- No code or SQL change is included in this slice.

## Final Decision

ParaUsted V1 keeps Stripe as a required strategic capability, but live Stripe must be treated as a gated production feature.

For the first tour operator pilot, the target should be restricted live Stripe if all gates pass. If gates do not pass, launch the pilot as direct/offline only and do not promise card, Apple Pay, Google Pay, or instant online payment.

The next recommended follow-up after this document is a production smoke-test evidence template for Stripe, or a focused implementation/configuration check if this decision reveals a real environment gap.

## Source Notes

The decision is informed by Stripe guidance that Connect integrations should be tested before going live, including account creation, identity verification, and payouts. Stripe documentation also describes webhook endpoints as HTTPS endpoints that receive event objects, should be tested locally, secured, and should return successful status codes quickly before complex processing. Stripe's Payment Element documentation recommends Checkout Sessions for most integrations and notes that Apple Pay / Google Pay display depends on wallet/device conditions. Stripe's Apple Pay documentation states that Apple Pay on the web can be accepted with Checkout or Elements and that web domains showing Apple Pay buttons must be registered.

References:

- https://docs.stripe.com/connect/testing
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/payments/payment-element
- https://docs.stripe.com/apple-pay?platform=web
