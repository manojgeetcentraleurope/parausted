# Luke Tour Operator Gift Card Integration And Prefix Implementation Plan

## Status

State: planning document for review before implementation.  
Date: 2026-06-13  
Recommended path: `docs/architecture/integration-specs/luke-tour-operator-gift-card-integration-plan.md`  
Recommended commit after review: `docs(project): plan luke tour operator gift card integration`

This document captures the agreed product decisions, architecture direction, and implementation plan for integrating Luke's tour operator gift card experience into ParaUsted. It also includes a validation prompt to review the plan with Claude Opus 4.8 before implementation.

No code, SQL, Stripe configuration, WhatsApp provider change, or deployment change is included in this document.

## Executive Summary

Luke's tour operator integration should start with a ParaUsted-hosted gift card flow for V1 pilot, then evolve into an embeddable widget or popup in V1.5, and finally into a headless API for approved partners in V2.

The immediate product decision is to implement real branded gift card prefixes now, not display-only prefixes. Luke wants Gift Card wording and ST-GC branded prefixes for separate Private and Luxury gift cards.

Initial Luke gift card codes should be:

- `ST-GC-PRV-XXXX-XXXX` for Private Tour Gift Cards.
- `ST-GC-LUX-XXXX-XXXX` for Luxury Escape Gift Cards.

The prefix must be part of the real issued voucher code and must work consistently across:

- purchase preview or product display
- payment confirmation
- voucher issuance
- voucher page lookup
- voucher redemption
- audit/support workflows

## Confirmed Product Decisions

### Integration Model

Confirmed direction:

- V1 pilot: ParaUsted hosted page.
- V1.5: ParaUsted embeddable widget or popup, no iframe.
- V2: Headless API for approved partners.

Rationale:

- Hosted page is safest for V1 because ParaUsted controls payment, legal copy, voucher lifecycle, mobile UX, and SEO.
- Widget or popup is better than iframe for V1.5 because iframe can create mobile, browser wallet, CSP, analytics, and accessibility issues.
- Headless API should wait until partner authentication, rate limiting, public API contracts, and legal disclosure responsibilities are mature.

### Luke Naming

Confirmed:

- Use Gift Card wording.
- Do not use Gift Voucher wording for Luke V1.
- Use `ST-GC` prefix family.

Recommended prefix format:

- `ST-GC-PRV` for Private tours.
- `ST-GC-LUX` for Luxury escapes.

`PRV` is recommended over `PRIV` because shorter codes are easier for mobile entry, WhatsApp sharing, printed/PDF display, and merchant redemption.

### Luke Gift Card Products

Confirmed:

1. Private Tour Gift Card.
2. Luxury Escape Gift Card.

Private Tour Gift Card:

- Separate gift card product.
- Supports open/custom amount.
- Supports fixed presets.
- Prefix: `ST-GC-PRV`.
- Redeemable for private tour experiences, subject to merchant terms and availability.

Luxury Escape Gift Card:

- Separate gift card product.
- Redeemable against any luxury escape.
- Prefix: `ST-GC-LUX`.
- Suggested range from UI: EUR 100 to EUR 1000.
- Fixed presets may include EUR 100, EUR 250, EUR 500, EUR 1000.

### Payment Methods

Confirmed:

- Stripe/card if Luke's Stripe readiness gates pass.
- Bizum if configured.
- Bank transfer/IBAN if configured.
- Cash only if Luke accepts it operationally.

Product guidance:

- English tourist flow should be card-friendly when Stripe is ready.
- Spanish/local flow can remain direct-payment friendly.
- Buyer-facing copy must not promise Apple Pay, Google Pay, or automatic card availability unless configured and tested.

### Refund Support Model

Confirmed:

- Refunds are handled through ParaUsted support and/or merchant support.
- Buyer self-service refund is not a V1 goal.
- Refund action should be support-controlled or merchant-approved.

Recommended V1 refund rules:

- Refund only after support review.
- Refund only if Stripe/direct payment state is clear.
- If voucher exists and is unused, refund should void the voucher.
- If voucher is redeemed, refund should not be automated; it requires manual support review.
- Partial refund is deferred unless explicitly required later.

### Discounts

Confirmed:

- Discounts may come later.
- Discount vouchers are not part of Luke V1 prefix implementation.

Reason:

Paid gift cards and discount vouchers have different lifecycle, accounting, fraud, eligibility, and redemption rules. They should not be mixed into the V1 paid gift card implementation.

### Expiry

Confirmed:

- Luke gift cards expire.

Legal/product rule:

- Validity and expiry must be visible before purchase and on the voucher page.
- Avoid hidden conditions.
- Avoid aggressive or surprising expiry.
- Copy must remain conservative and Spain-first.

### WhatsApp Delivery

Confirmed:

- Luke needs WhatsApp delivery now.

Recommended V1 interpretation:

- V1 should support WhatsApp share/link handoff if automated WhatsApp Business API delivery is not ready.
- Do not promise automatic WhatsApp Business delivery unless provider integration, consent, operational monitoring, and delivery evidence exist.

Recommended wording:

- Delivery channel: WhatsApp share/link or buyer-selected preferred delivery method.
- Source of truth: ParaUsted voucher page.

## Gift Card, Gift Voucher, Discount Voucher Definitions

### Gift Card - Paid Stored Value

Example:

- Buyer pays EUR 500.
- Recipient receives EUR 500 gift card.
- Code: `ST-GC-LUX-K7M9-Q2XA`.

Lifecycle:

1. pending purchase
2. payment confirmed
3. voucher issued
4. voucher page opened
5. merchant redemption

Gift cards are ParaUsted V1 core.

### Gift Voucher - Service Entitlement

Example:

- Private walking tour for two people.
- One driving lesson.
- Luxury grooming package.

This is service/package-oriented rather than pure stored value. For V1, ParaUsted can represent this as a service-type gift card with clear merchant-authored title and description.

### Discount Voucher - Promotion Or Coupon

Example:

- 10% off any private tour.
- EUR 50 off a luxury escape.
- Free upgrade.

Discount vouchers should be V1.5 or later.

They require:

- campaign model
- eligibility rules
- max redemptions
- minimum spend
- combinability rules
- abuse/fraud controls
- expiry rules
- separate accounting expectations

## Prefix Architecture Decision

### Decision

Implement real configurable voucher code prefixes now.

Do not use display-only prefixes for Luke because the premium UI shows branded codes such as `GC-LUX-...`. If the actual voucher later shows `PU-...`, the product experience feels inconsistent and less trustworthy.

### Recommended Data Model

Add a field to `gift_cards`:

- `voucher_code_prefix text null`

Example values:

- `ST-GC-PRV`
- `ST-GC-LUX`

Default behavior:

- If `gift_cards.voucher_code_prefix` is null, use current default prefix `PU`.

Why gift-card-level prefix:

- Luke has multiple branded gift card types under the same merchant.
- Merchant-level prefix alone is insufficient because Private and Luxury need different prefixes.

### Prefix Validation Rules

Recommended rules:

- Optional field.
- Uppercase letters A-Z, digits 0-9, and hyphen only.
- Must start with an uppercase letter or digit.
- Must end with an uppercase letter or digit.
- No spaces.
- No double hyphen.
- Recommended length: 2 to 20 characters.
- Prefix must not include the random suffix.
- Prefix must not reduce randomness/security of the generated voucher code.

Recommended valid examples:

- `PU`
- `ST-GC-PRV`
- `ST-GC-LUX`
- `BAR-GC-CUT`
- `DS-GC-LESSON`

Invalid examples:

- `st-gc-lux`
- `ST GC LUX`
- `ST-GC-LUX-`
- `-ST-GC-LUX`
- `ST--GC`

### Generated Code Format

Recommended format:

- `{prefix}-{random4}-{random4}`

Examples:

- `ST-GC-PRV-K7M9-Q2XA`
- `ST-GC-LUX-Z8P4-N6RT`
- `PU-A7K9-Q2M4`

Random suffix must remain cryptographically random or DB-generated random from the existing voucher code generation strategy.

### System Areas Impacted

Real prefixes affect:

- gift card database schema
- gift card validation schema
- merchant dashboard gift card form
- purchase page display/preview if applicable
- manual voucher issuance RPC
- Stripe voucher issuance RPC
- voucher code generation helper/function
- public voucher page code validation
- `get_public_voucher_page` RPC validation
- redemption code normalization and validation
- docs that mention `PU-XXXX-XXXX-XXXX`
- manual validation checklist

## Implementation Plan

### Slice 0 - Pre-Implementation Validation With Opus 4.8

Goal:

- Review this plan before implementation.
- Identify risks, missing validation points, DB migration concerns, and route/RPC regressions.

Output expected:

- Go / No-Go / Go with changes.
- Risk list.
- Required implementation ordering.
- SQL/RPC safety notes.
- Tests/manual validation checklist.

### Slice 1 - Discovery Audit

Goal:

- Confirm all current hardcoded `PU` assumptions and voucher regex assumptions.

Inspect:

- voucher creation migrations/RPCs
- `confirm_purchase_and_issue_voucher`
- `confirm_stripe_purchase_and_issue_voucher`
- `get_public_voucher_page`
- `redeem_voucher_full`
- public voucher page regex
- redemption UI normalization
- gift card schema/form/server actions
- docs mentioning `PU-XXXX-XXXX-XXXX`

Output:

- exact files/functions requiring change
- SQL migration plan
- app code plan
- validation queries

No code changes in Slice 1.

### Slice 2 - Database Schema And RPC Migration

Goal:

- Add `gift_cards.voucher_code_prefix`.
- Update voucher generation RPCs to use gift-card prefix with fallback to `PU`.
- Update public voucher lookup validation to allow custom prefixes.
- Update redemption validation if needed.

Likely migration tasks:

1. Add nullable column:
   - `gift_cards.voucher_code_prefix text null`
2. Add CHECK constraint for prefix format, if safe.
3. Update manual confirmation RPC.
4. Update Stripe confirmation RPC.
5. Update public voucher page RPC validation.
6. Update redemption RPC validation, if current SQL rejects non-PU codes.
7. Preserve existing PU vouchers.

Atomicity requirements:

- Voucher generation exhaustion must still raise exception and roll back.
- One purchase still produces at most one voucher.
- Voucher code uniqueness remains enforced.
- No broad public table access should be introduced.
- SECURITY DEFINER functions must retain safe `search_path = public, pg_temp` where applicable.

### Slice 3 - Application Form And Validation

Goal:

- Allow merchant/admin to configure gift card prefix.

App changes:

- Update gift card Zod schema.
- Update dashboard gift card form.
- Add helper text explaining examples.
- Normalize to uppercase.
- Validate the same rules as DB.
- Preserve fallback if empty.

Suggested UI copy:

Spanish:

- Label: `Prefijo del código`
- Help: `Opcional. Ejemplo: ST-GC-LUX. Se usará para los códigos emitidos de esta tarjeta regalo.`

English:

- Label: `Code prefix`
- Help: `Optional. Example: ST-GC-LUX. Used for issued codes from this gift card.`

### Slice 4 - Public Voucher And Redemption App Validation

Goal:

- Ensure public voucher page and redemption UI accept new prefixed codes.

App changes:

- Update voucher code regex/helper.
- Accept `ST-GC-LUX-K7M9-Q2XA` style codes.
- Preserve existing `PU-A7K9-Q2M4` format.
- Normalize lowercase input to uppercase in redemption UI, if current behavior supports that.
- Do not log voucher codes on errors.

### Slice 5 - Luke Data Setup

Goal:

- Configure Luke gift cards.

Luke setup:

Private Tour Gift Card:

- title: `Private Tour Gift Card`
- prefix: `ST-GC-PRV`
- type: custom/open amount plus fixed presets if supported
- direct payments: Bizum/bank/cash according to Luke configuration
- Stripe: only if connected and live/test gates pass
- validity: configured and visible

Luxury Escape Gift Card:

- title: `Luxury Escape Gift Card`
- prefix: `ST-GC-LUX`
- type: custom/open amount or fixed presets
- suggested presets: EUR 100, EUR 250, EUR 500, EUR 1000
- redeemable against any luxury escape
- validity: configured and visible

### Slice 6 - Manual/E2E Validation

Required checks:

1. Existing `PU-...` voucher still opens.
2. Existing `PU-...` voucher can still be redeemed if valid.
3. New private gift card issues `ST-GC-PRV-...` code.
4. New luxury gift card issues `ST-GC-LUX-...` code.
5. Public voucher page opens for both new prefixes.
6. Redemption works for both new prefixes.
7. Wrong merchant cannot redeem.
8. Duplicate redemption is safe.
9. Stripe confirmation path issues prefixed code.
10. Manual direct payment confirmation path issues prefixed code.
11. Voucher code uniqueness remains enforced.
12. Invalid prefix format is rejected in admin form and/or DB.
13. Public voucher lookup does not expose PII.
14. No voucher codes are logged in public page errors.
15. Mobile voucher page displays longer prefixed codes without layout breakage.

### Slice 7 - Documentation Update

Update docs:

- payment confirmation / voucher issuance doc
- voucher page source of truth doc
- voucher redemption flow doc
- pilot launch gate checklist if needed
- Luke integration plan after implementation evidence

## Stripe Charge Model Decision  
Date: 2026-06-13  
### Current Model  
ParaUsted currently uses Stripe Connect destination charges:  
- Charge is created on the platform account.  
- Funds are transferred to the connected merchant account via transfer_data.destination.  
- Platform bears Stripe processing fees.  
- Platform is closer to merchant of record.  
- Refund is initiated by the platform.  
  
### Opus 4.8 Recommendation  
Opus recommends switching to Stripe Connect direct charges:  
- Charge is created on the connected merchant account.  
- Platform fee is collected via application_fee_amount.  
- Merchant bears Stripe processing fees.  
- Merchant is clearly the merchant of record.  
- Cleaner taxation for ParaUsted: only commission income on ParaUsted books.  
- Lower IVA exposure for ParaUsted.  
- Chargeback liability sits with the connected account.  
  
### Decision  
Keep destination charges for V1 pilot. Do not switch charge model during the prefix sprint.  
Reason:  
- Switching charge model changes how Checkout Sessions are created.  
- Switching changes webhook event handling and signature verification.  
- Switching changes refund flow completely.  
- Switching requires re-testing all payment paths and re-verifying all hardening.  
- The prefix sprint must not touch payment architecture.  
  
### Post-Pilot Evaluation  
When platform fee activation is planned, evaluate:  
- Stay with destination charges plus application_fee_amount.  
- Or switch to direct charges plus application_fee_amount.  
Both models support application_fee_amount. The difference is merchant-of-record position and tax exposure.  
Direct charges are preferred long-term for:  
- Cleaner ParaUsted taxation (only commission income).  
- Lower IVA exposure.  
- Merchant bears processing fees.  
- Merchant is clearly merchant of record.  
- Chargeback liability on connected account.  
Destination charges are acceptable short-term because:  
- Already implemented and hardened.  
- Pilot fee is 0% so tax exposure is minimal.  
- Switching mid-pilot adds unnecessary risk.  
  
### Configurable Fee Column  
Opus suggests adding merchants.platform_fee_bps (default 0 for pilot, 300-500 later). This is a good idea but should be a separate slice when fee activation is planned. Do not implement during the prefix sprint.  
  
### Action Items  
- Do not change Stripe charge model in the prefix sprint.  
- Do not add platform_fee_bps column in the prefix sprint.  
- Document this tradeoff in the integration plan.  
- Revisit when platform fee activation is scheduled.  

## Refund Plan For Luke

Refund should be handled after prefix implementation or as a separate focused slice.

Recommended V1 refund model:

- support-controlled refund
- no buyer self-service refund
- only for unredeemed vouchers by default
- void voucher after successful refund
- redeemed vouchers require manual support review
- write audit events
- no application fee refund for pilot because Stripe platform fee is waived

Refund implementation requires separate audit of:

- stored Stripe checkout session ID
- stored Stripe payment intent ID
- stored charge ID if available
- connected account ID
- transfer reversal requirements
- purchase/voucher statuses
- audit event taxonomy
- support/admin UI entry point

## WhatsApp Plan For Luke

Luke needs WhatsApp now.

Recommended V1 interpretation:

- support WhatsApp share/link handoff now
- voucher page remains source of truth
- WhatsApp is delivery/share channel, not canonical state
- no WhatsApp Business API automation unless delivery provider, consent, logging, and monitoring are implemented

Possible V1 behavior:

- buyer chooses WhatsApp as preferred channel
- after voucher issuance, user can share voucher link via WhatsApp button
- message includes safe voucher URL and merchant/gift card summary

Future:

- WhatsApp Business API provider integration
- delivery event channel `whatsapp`
- delivery status tracking
- consent and opt-in validation
- retry and provider response handling

## Discounts And Itinerary Scope Plan

Discounts are deferred.

Future discount model should be separate from paid gift cards:

- discount code
- campaign
- percent or fixed amount
- eligibility rules
- min spend
- max redemptions
- combinability rules
- valid from/to
- fraud controls

Specific itinerary/service scope is V1.5 or later.

For V1, represent scope in merchant-authored title/description:

- `Redeemable against any luxury escape.`
- `Scheduling and itinerary are arranged directly with Seville Tours.`

Future structured fields:

- `redeemable_scope`
- `eligible_service_id`
- `eligible_category`
- `combinable_with_discounts`

## Applicability To Barber And Driving Class

The prefix model should be generic.

Barber examples:

- `BAR-GC-CUT`
- `BAR-GC-BRD`
- `BAR-GC-LUX`

Driving examples:

- `DS-GC-LESSON`
- `DS-GC-PACK`
- `DS-GC-THEORY`

Driving class must keep scheduling and eligibility wording conservative.

## Risks

### Risk 1 - Prefix Regex Breaks Existing Codes

Mitigation:

- Preserve existing `PU-...` format.
- Add validation tests/manual checks for old and new codes.

### Risk 2 - SQL RPC Divergence

Mitigation:

- Update both manual and Stripe confirmation RPCs together.
- Use shared SQL helper function if practical.
- Validate remote function source after migration.

### Risk 3 - Public Voucher Lookup Too Broad

Mitigation:

- Accept flexible prefix format but keep full code format strict.
- Do not restore direct anonymous vouchers table access.
- Keep safe RPC return fields.

### Risk 4 - Longer Code Breaks Mobile UI

Mitigation:

- Use `break-all` or responsive wrapping.
- Manually test iPhone SE and common mobile widths.

### Risk 5 - Prefix Collision Or Guessability

Mitigation:

- Prefix is branding only.
- Random suffix must remain sufficiently random.
- `vouchers.code` unique constraint remains final protection.

### Risk 6 - Merchant Misconfiguration

Mitigation:

- Validate prefix in admin form.
- Show examples.
- Normalize to uppercase.
- Keep empty prefix fallback to `PU`.

## Acceptance Criteria

Implementation is accepted when:

- Gift cards support optional real voucher code prefix.
- Existing gift cards without prefix continue to issue `PU-...` codes.
- Luke Private issues `ST-GC-PRV-...` codes.
- Luke Luxury issues `ST-GC-LUX-...` codes.
- Manual confirmation path works with custom prefixes.
- Stripe confirmation path works with custom prefixes.
- Public voucher page accepts custom prefixes.
- Redemption accepts custom prefixes.
- Existing `PU` codes still work.
- Voucher code uniqueness remains enforced.
- Public voucher page remains PII-safe.
- Voucher page remains noindex/nofollow.
- No voucher is issued before payment confirmation.
- TypeScript, lint, SQL checks, and manual E2E pass.

## Opus 4.8 Validation Prompt

Use this prompt in a new Claude Opus 4.8 chat before implementation:

```text
We are planning ParaUsted Luke tour operator real gift card prefix implementation.

Model guidance:
- Use Claude Opus 4.8 for architectural review.
- Do not generate full file contents.
- Do not implement code.
- Review the plan for risks, missing steps, SQL/RPC concerns, and launch blockers.
- Output should be concise but rigorous.

Context:
- ParaUsted is a Spain-first, SEO-heavy, mobile-first, legal-safe gift card SaaS.
- V1 pilot uses ParaUsted hosted page.
- V1.5 will add embeddable widget/popup without iframe.
- V2 will add headless API for approved partners.
- Tour operator, barber, and driving class pilots are GREEN.
- Stripe platform fee is waived for controlled pilot.
- Refunds are support-controlled for V1.
- WhatsApp is needed now as share/link handoff unless automated provider is explicitly implemented.
- Caching is considered for future SEO/performance but not implemented prematurely.

Luke decisions:
- Wording: Gift Card.
- Prefix family: ST-GC.
- Private gift card prefix: ST-GC-PRV.
- Luxury gift card prefix: ST-GC-LUX.
- Private and Luxury are separate gift cards.
- Private supports open amount plus fixed presets.
- Luxury is redeemable against any luxury escape.
- Payments include Stripe plus configured direct methods such as Bizum, IBAN/bank transfer, and cash.
- Gift cards expire.
- Discounts may come later.

Proposed implementation:
1. Add optional gift_cards.voucher_code_prefix.
2. Validate prefix format: uppercase A-Z, digits, hyphen; no spaces; no leading/trailing hyphen; no double hyphen; length 2-20.
3. Default to PU when no prefix exists.
4. Generate voucher codes as {prefix}-{random4}-{random4}.
5. Update manual confirmation RPC and Stripe confirmation RPC.
6. Update public voucher page code validation and get_public_voucher_page RPC.
7. Update redemption validation.
8. Update gift card admin schema/form/server action.
9. Preserve existing PU vouchers.
10. Validate old PU and new ST-GC codes end-to-end.

Please review:
- Is this architecture sound?
- What SQL/RPC risks exist?
- Should prefix be on gift_cards or merchants?
- Is {prefix}-{random4}-{random4} enough entropy?
- Any public voucher lookup risks?
- Any redemption risks?
- Any SEO/mobile/legal impacts?
- Should WhatsApp/refund be implemented before or after prefix?
- What should be implementation order?
- What must be manually validated before committing/pushing?

Return:
- GO / GO WITH CHANGES / NO-GO
- top risks
- recommended changes to plan
- exact implementation order
- acceptance criteria
```

## Final Recommendation

Proceed with real prefixes now, but only after Opus 4.8 validates the plan.

Recommended implementation order:

1. Opus 4.8 review.
2. Read-only repo discovery audit.
3. SQL/RPC migration design.
4. Application schema/form changes.
5. Voucher page/redemption validation changes.
6. Luke data setup.
7. Manual E2E validation for manual and Stripe paths.
8. Documentation update.

Do not combine prefix implementation with refund automation, discount vouchers, headless API, or caching.
