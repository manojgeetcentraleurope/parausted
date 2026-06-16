# Seville Tours × ParaUsted Hosted Gift Flow Handoff

**Project:** ParaUsted  
**Integration:** Seville Tours Co. hosted gift-card flow  
**Date:** 2026-06-15  
**Status:** DONE — clean, pushed, and manually validated  
**Recommended path:** `docs/architecture/integrations/seville-tours-parausted-hosted-gift-flow-handoff.md`

---

## 1. Executive Summary

This slice completed the first cross-application hosted gift-card integration between the Seville Tours frontend and ParaUsted.

The final integration model is:

```text
Seville Tours frontend
  → merchant-owned acquisition, gift-mode explanation, and branded entry point
  → links buyers to ParaUsted hosted merchant page

ParaUsted
  → hosted merchant page
  → hosted purchase flow
  → payment confirmation
  → voucher issuance
  → voucher page
  → refund, redemption, audit, and tracking source of truth

WhatsApp
  → post-purchase planning/support only
  → not the gift-card purchase path
```

The key decision was to route **all three Seville Tours gift modes** through ParaUsted:

1. Fixed gift amount / standard gift cards
2. Flexible / varied gift value cards
3. Luxury / private gift cards

This preserves the real Seville Tours business model while ensuring ParaUsted retains platform transaction tracking, platform-cut potential, voucher lifecycle control, refund visibility, redemption state, and audit evidence.

---

## 2. Final Product Decision

### Locked decision

All Seville Tours gift-card purchase modes start in ParaUsted.

```text
Fixed gift cards      → ParaUsted
Flexible gift cards   → ParaUsted
Luxury/private gifts  → ParaUsted
```

WhatsApp remains valid for:

```text
post-purchase planning
luxury/private itinerary coordination
merchant support
customer questions
```

WhatsApp is no longer used as the primary pre-purchase gift-card request or payment path.

### Why this decision matters

If luxury or flexible gifts go directly to WhatsApp before purchase, ParaUsted loses:

- platform-cut opportunity
- purchase tracking
- voucher issuance evidence
- refund state
- redemption state
- audit trail
- fraud/reconciliation visibility
- future analytics

Routing all three modes through ParaUsted keeps the SaaS platform economically and operationally central while still allowing Seville Tours Co. to deliver a personal, premium customer experience.

---

## 3. Seville Tours Frontend Changes

### Repository outcome

Latest pushed Seville Tours commit:

```text
4c350bc feat(gift): route gift card modes to ParaUsted
```

### Files changed

The Seville Tours frontend gift-card section was reshaped so that it remains merchant-branded but no longer behaves like a separate voucher checkout or manual voucher request system.

Changed areas included:

```text
src/components/home/GiftVoucherConfigurator.tsx
src/lib/i18n/locales/ar.ts
src/lib/i18n/locales/en.ts
src/lib/i18n/locales/es.ts
src/lib/i18n/locales/fr.ts
src/lib/i18n/types.ts
src/lib/parausted/merchant-url.ts
```

### Final Seville Tours behavior

The gift-card section still displays the three business modes:

```text
Fixed gift amount
Flexible gift value
Luxury/private gift
```

Each mode links to the ParaUsted hosted merchant page:

```text
/{locale}/m/seville-tours-co
```

The link is generated from:

```text
NEXT_PUBLIC_PARAUSTED_BASE_URL
```

with fallback:

```text
https://parausted.es
```

### Locale mapping

Because ParaUsted V1 currently supports Spanish and English, Seville Tours routes unsupported frontend locales to English on ParaUsted.

```text
es → es
en → en
fr → en
ar → en
```

### Data passed across apps

No buyer data or transaction state is passed from Seville Tours to ParaUsted.

Seville Tours does **not** pass:

```text
amount
recipient name
personal message
delivery method
merchant_id
gift_card_id
voucher code
payment status
refund status
PII
```

This preserves ParaUsted as the source of truth for the transaction and voucher lifecycle.

---

## 4. ParaUsted Data Changes

### Repository outcome

Latest pushed ParaUsted commit:

```text
a9065d3 feat(gift-card): add Seville Tours luxury gift card
```

Working tree after validation:

```text
git status --short --untracked-files=all
# no output
```

### Merchant state

The existing merchant was rebranded and canonicalized:

```text
merchant_id: 44b8bc03-f869-4715-9905-5d0e3e5ec93d
name: Seville Tours Co.
slug: seville-tours-co
status: active
city: Sevilla
country: ES
timezone: Europe/Madrid
```

### Public URLs

The hosted merchant page is now expected at:

```text
/es/m/seville-tours-co
/en/m/seville-tours-co
```

### Active gift cards

ParaUsted now exposes three active Seville Tours Co. gift cards:

```text
ST-GC-FIX
  card_type: fixed_value
  amount: €50
  sort_order: 10

ST-GC-FLX
  card_type: custom_value
  range: €35–€500
  sort_order: 20

ST-GC-LUX
  card_type: custom_value
  range: €100–€1000
  sort_order: 30
```

### Historical gift-card handling

Old test gift cards were **not rewritten** because they already had purchase and voucher history.

Old historical cards were deactivated instead:

```text
fix value      → inactive, purchase/voucher history preserved
custom value   → inactive, purchase/voucher history preserved
Custome        → inactive, purchase/voucher history preserved
```

This preserves audit/history integrity and avoids changing the meaning of existing purchases or vouchers.

---

## 5. Prefix Decision

### Final prefix lineup

```text
ST-GC-FIX  → fixed gift card
ST-GC-FLX  → flexible gift card
ST-GC-LUX  → luxury/private gift card
```

### Why `ST-GC-LUX` was reused

The old inactive historical test card already had:

```text
voucher_code_prefix = ST-GC-LUX
```

A schema review confirmed `voucher_code_prefix` has a format check constraint but no unique constraint or unique index. Therefore, using `ST-GC-LUX` for the new active luxury card is safe.

Voucher uniqueness is enforced on the generated voucher code, not on the gift-card prefix. Voucher lookup/redemption is based on voucher code and purchase lifecycle, not by resolving a gift card from prefix text.

### Copy encoding check

The SQL editor/chat display showed `&amp;`, but a database position check confirmed that the stored value contains a real ampersand `&`, not the literal HTML entity `&amp;`.

No correction migration was required.

---

## 6. Architecture Boundary

### Correct V1 architecture

```text
Seville Tours frontend
  → public marketing page
  → gift-mode explanation
  → outbound hosted link only

ParaUsted
  → merchant page
  → gift-card selection
  → purchase creation
  → payment confirmation
  → voucher issuance
  → voucher page
  → refund handling
  → redemption
  → audit/fraud tracking
```

### Explicitly avoided

The integration does **not** include:

```text
embedded checkout
iframe widget
headless API integration
Seville Tours calling Supabase
Seville Tours calling Stripe
Seville Tours creating vouchers
Seville Tours confirming payments
passing selected amount via URL
passing buyer/recipient data via URL
passing gift_card_id or merchant_id via URL
```

### Why hosted-link integration is correct for V1

The hosted-link model is the simplest safe integration boundary:

```text
Seville Tours knows only ParaUsted public merchant URL.
ParaUsted owns all transactional state.
```

This gives a merchant-owned buyer experience while keeping ParaUsted operationally authoritative.

---

## 7. Legal and Copy Position

### Buyer-facing ownership

The buyer experience should feel like:

```text
I am buying a Seville Tours Co. gift card.
```

not:

```text
I am buying a generic ParaUsted product.
```

ParaUsted may remain infrastructure behind the scenes or appear as a light “powered by” layer later if desired.

### Legal/commercial role split

```text
Seville Tours Co.
  → owns tour delivery, itinerary planning, scheduling, service fulfillment, merchant-specific goodwill decisions

ParaUsted
  → owns hosted software workflow, purchase record, payment confirmation path, voucher issuance, voucher page, refund tooling, redemption state, audit evidence
```

### Removed or avoided risky copy

The Seville Tours gift-card entry no longer uses risky purchase/legal language such as:

```text
No expiry
Non-refundable
Not redeemable for cash
Cannot be combined with discounts
Carlos confirms voucher and payment manually
request-only gift vouchers
```

Final copy direction:

```text
Gift-card purchases are completed securely on ParaUsted, where voucher terms, validity, refund handling, and redemption details are shown before purchase. Luxury and private gift details are coordinated with Seville Tours Co. after purchase.
```

---

## 8. Manual Validation Evidence

Manual validation checklist passed.

Validated outcomes:

- Seville Tours repo pushed and clean.
- ParaUsted repo pushed and clean.
- Seville Tours gift modes route to ParaUsted.
- ParaUsted merchant slug is `seville-tours-co`.
- ParaUsted merchant is active and branded as Seville Tours Co.
- Three active cards exist: fixed, flexible, luxury/private.
- Old historical test cards are inactive.
- Existing historical purchases/vouchers were not rewritten.
- No correction migration needed for ampersand display.
- Working tree clean after commit/push.

---

## 9. Deferred Future Work

Do not add these in the current V1 slice.

### V1.5 candidates

```text
direct product deep links from Seville Tours modes to specific ParaUsted gift-card pages
more merchant-branded / white-label hosted page polish
email delivery polish
PDF voucher polish
SEO landing pages for Seville gift experiences
```

### V2 candidates

```text
embeddable widget
headless/API integration
partial redemption
multi-trip automated balance tracking
scheduled delivery
rich media personalization
advanced merchant analytics
WhatsApp Business API delivery
```

### Important deferred limitation

Flexible and luxury gift cards can represent flexible value and premium/private planning, but V1 still uses the current redemption model. Do not promise automated multi-trip balance tracking until partial redemption exists.

---

## 10. Architect / PO / PM Learning Note

### Architect

The key architectural win is that Seville Tours did not become a second checkout or voucher system. The integration uses a single public hosted merchant URL while ParaUsted remains the source of truth for all transactional state.

Historical data was protected by deactivating old test gift cards instead of rewriting rows that already had purchases and vouchers. The new luxury/private card was added additively.

### Product Owner

The final product model supports the real Seville Tours business needs:

```text
fixed gift amount
flexible gift value
luxury/private gift
```

All purchase paths are consistent and secure through ParaUsted, while Seville Tours still owns the customer-facing service relationship and post-purchase planning.

### Project Manager

This slice completed a real cross-app launch dependency without expanding into widget/API work. Both repositories were pushed and clean, and manual validation passed.

The next work should remain launch-readiness focused: public flow evidence, production URL/env verification, and pilot purchase/redemption smoke testing.

---

## 11. Final Status

```text
Status: DONE
Repos: CLEAN
Commits: PUSHED
Manual validation: PASSED
Architecture decision: LOCKED
```

Final locked decision:

```text
Seville Tours = acquisition and merchant-owned gift explanation
ParaUsted = hosted transaction and voucher lifecycle source of truth
WhatsApp = post-purchase planning/support only
```
