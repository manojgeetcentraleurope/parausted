# ParaUsted — Revised MVP Sprint Plan (8 Weeks)

**Version:** 1.1  
**Date:** 2026-06-08  
**Strategy:** Spain-first, legal-safety-first, SEO-heavy B2C, modular feature-flagged SaaS  
**V1 includes:** Direct payments + Stripe Connect + direct payment confirmation + voucher issuance after confirmation only  
**V1 excludes:** Marketplace discovery, rich media, WhatsApp API, partial redemption, advanced refunds, financial ledger automation, advanced analytics  

---

## Sprint Principles

Every sprint must protect these locked product and architecture principles:

```text
1. Spain-first legal safety.
2. No voucher before payment confirmation.
3. One gift-card lifecycle across direct and Stripe payments.
4. Direct Payment Confirmation Center is core V1.
5. Stripe remains V1 but implemented modularly.
6. Marketplace/discovery moves to V1.5, but SEO foundation starts in V1.
7. Gift card is a personalized digital gift experience.
8. WhatsApp/email/download are delivery channels; voucher page is source of truth.
9. Rich media is future modular feature, not MVP.
10. Simple SaaS, modular, feature-flagged, secure, fast, embeddable-ready.
```

Architecture rules:

```text
SOLID
DRY
KISS
YAGNI
Gang of Four only where useful
low cyclomatic complexity
low cognitive complexity
small functions
clear module boundaries
server/client boundary discipline
no raw DB errors
no PII logging
validation before mutation
manual checks before commit
```

Recommended patterns:

```text
Payment methods: Strategy Pattern
Voucher creation: Factory Pattern
Delivery providers: Adapter Pattern later
Refund/legal rules: Policy Objects later
Purchase lifecycle: transition map first, State Pattern later only if needed
```

---

# Week 1: Foundation, i18n, Database, and Security Baseline

## Day 1-2: Project Setup

- [ ] Create Next.js project: `npx create-next-app@latest parausted --typescript --tailwind --app --src-dir`
- [ ] Create Supabase project in EU Frankfurt region
- [ ] Configure Cloudflare DNS for `parausted.es`
- [ ] Set up GitHub repo + branch protection on `main`
- [ ] Create `.env.example` + `.env.local`
- [ ] Create `AGENTS.md` / `.github/copilot-instructions.md`
- [ ] Add coding rules: SOLID, DRY, KISS, YAGNI, low complexity, no raw DB errors, no PII logs
- [ ] Set up Husky + lint-staged if useful; do not block learning flow with noisy tooling
- [ ] Create CI workflow: `.github/workflows/ci.yml`
- [ ] Add validation commands to CI:

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

## Day 3: i18n and SEO Foundation

- [ ] Add locale-aware routing for `es` and `en`
- [ ] Spanish primary, English secondary
- [ ] `/` redirects to `/es`
- [ ] Add localized metadata helper
- [ ] Add SEO-safe slug conventions
- [ ] Use Next.js 16 `proxy.ts`, not deprecated `middleware.ts`
- [ ] Add Open Graph basics for public pages

## Day 4-5: Database Schema and RLS

- [ ] Run core Supabase migrations
- [ ] Include tables:
  - `merchants`
  - `gift_cards`
  - `purchases`
  - `vouchers`
  - `redemptions`
  - `delivery_events`
  - `ledger_accounts`
  - `ledger_entries`
  - `payouts`
  - `audit_events`
  - `security_events`
  - `processed_webhooks`
  - `fraud_flags`
- [ ] Add bilingual content columns:
  - `merchants.description_en`
  - `gift_cards.title_en`
  - `gift_cards.description_en`
- [ ] Create seed script with test data
- [ ] Verify RLS policies work
- [ ] Verify public read policies expose only safe public fields
- [ ] Verify public insert to `purchases` works only through validated app flow
- [ ] Run `supabase db reset` locally if local Supabase is used

## Milestone

```text
Project runs locally.
Database has core tables.
i18n and SEO foundation exist.
RLS baseline is validated.
CI passes.
```

---

# Week 2: Merchant Experience and Gift-Card CRUD

## Day 1-2: Authentication

- [ ] Supabase Auth: email/password signup + login
- [ ] Supabase Auth: magic link if feasible
- [ ] Supabase Auth: Google OAuth if feasible
- [ ] Password recovery flow if feasible
- [ ] Localized auth pages:
  - `/es/login`
  - `/en/login`
  - `/es/signup`
  - `/en/signup`
  - `/auth/callback`
- [ ] Protected dashboard routes:
  - `/es/dashboard`
  - `/en/dashboard`
- [ ] Dashboard must redirect unauthenticated users to localized login
- [ ] Generic auth errors only

## Day 3: Merchant Onboarding

- [ ] Merchant onboarding form:
  - business name
  - slug
  - category
  - Spanish/default description
  - optional English description
  - address
  - city
  - phone
  - website URL
  - brand color
  - Bizum phone
  - bank IBAN
- [ ] Do not accept `auth_user_id` from client
- [ ] Server action derives authenticated user from Supabase Auth
- [ ] Preserve form values after validation errors
- [ ] Validate slug clearly; do not silently convert full URLs into slugs

## Day 4-5: Gift-Card CRUD

- [ ] Gift card create/read/update/toggle active flow
- [ ] Auto-refresh list after create/update/toggle
- [ ] Three card types:
  - `fixed_value`
  - `custom_value`
  - `service`
- [ ] Spanish/default title required
- [ ] Optional English title
- [ ] Optional Spanish/default description
- [ ] Optional English description
- [ ] Amount rules:
  - fixed/service: `amount_cents`
  - custom: `min_amount_cents` and `max_amount_cents`
- [ ] Hard delete skipped for MVP because records may be referenced by purchases/vouchers/audit history

## Milestone

```text
Merchant can sign up, onboard, configure direct payment details, and manage bilingual gift cards.
```

---

# Week 3: Public Merchant Pages and Pending Purchase Flow

## Day 1: Public Merchant Page

- [ ] SSR public merchant pages:
  - `/es/m/[slug]`
  - `/en/m/[slug]`
- [ ] Active merchant only
- [ ] Active gift cards only
- [ ] Missing slug returns 404
- [ ] Bilingual fallback:

```ts
locale === 'en' && englishValue ? englishValue : spanishDefaultValue
```

- [ ] CTA links active gift cards to purchase page:

```text
/[locale]/m/[slug]/gift-cards/[giftCardId]
```

- [ ] No private merchant fields exposed publicly
- [ ] SEO metadata localized

## Day 2-4: Public Pending Purchase Flow for Direct Payments

- [ ] Add route:
  - `/es/m/[slug]/gift-cards/[giftCardId]`
  - `/en/m/[slug]/gift-cards/[giftCardId]`
- [ ] Fetch active merchant by slug
- [ ] Fetch active gift card by id + merchant_id
- [ ] Inactive/missing/wrong merchant gift card returns 404
- [ ] Show gift-card details with bilingual fallback
- [ ] Form fields:
  - buyer email required
  - buyer name optional
  - recipient name required
  - recipient email required
  - relationship required
  - design template required
  - sender name required
  - personal message required
  - consent checkbox required, unchecked by default
- [ ] Custom amount cards require buyer amount within min/max
- [ ] Fixed/service cards derive amount server-side from DB
- [ ] Supported direct payment methods:
  - Bizum direct when merchant Bizum phone exists
  - Bank transfer when merchant IBAN exists
  - Cash always available
- [ ] Do not show Bizum phone or IBAN before valid pending purchase creation
- [ ] Server action creates `purchases.status = pending`
- [ ] Server generates `reference_code`
- [ ] `payment_source = OFFLINE`
- [ ] `payment_method = bizum_direct | bank_transfer | cash`
- [ ] `delivery_method = email`
- [ ] `expires_at = now + 48 hours` or configured value
- [ ] No voucher created
- [ ] No delivery event created
- [ ] No ledger entry created
- [ ] Success state shows reference code and payment instructions

## Day 5: Manual Purchase Checks

- [ ] Spanish purchase flow works
- [ ] English purchase flow works
- [ ] Fixed/service purchase creates pending row
- [ ] Custom amount validation works
- [ ] Bizum instructions show only after success
- [ ] Bank instructions show only after success
- [ ] Cash instructions show only after success
- [ ] No voucher exists after pending purchase

## Milestone

```text
Buyer can create a legally safer pending purchase request for direct payments.
No voucher is issued before merchant confirmation.
```

---

# Week 4: Direct Payment Confirmation and Voucher Issuance

## Day 1-2: Direct Payment Confirmation Center

- [ ] Merchant dashboard section: pending direct payment requests
- [ ] List pending purchases for authenticated merchant only
- [ ] Show safe fields:
  - reference code
  - amount
  - payment method
  - buyer email masked where appropriate
  - recipient name
  - created time
  - expiry time
- [ ] Search/filter by reference code
- [ ] Confirm payment action
- [ ] Reject/cancel payment action
- [ ] Server validates merchant ownership
- [ ] Do not trust purchase id without tenant check
- [ ] No raw DB errors
- [ ] Audit event for confirm/cancel

## Day 3-4: Voucher Issuance Service

- [ ] Create voucher issuance service/factory
- [ ] Voucher generated only after purchase moves to `payment_confirmed`
- [ ] Generate crypto-random voucher code
- [ ] Create voucher with:
  - `purchase_id`
  - `merchant_id`
  - code
  - QR data
  - original amount
  - balance amount
  - status `issued`
  - expiry/validity according to configured policy
- [ ] Ensure idempotency: confirming same purchase twice must not create duplicate voucher
- [ ] Confirm direct payment should:
  - update purchase to `payment_confirmed`
  - set `confirmed_at`
  - issue voucher once
  - add audit event

## Day 5: Basic Voucher Page

- [ ] Add public voucher page:
  - `/es/v/[code]`
  - `/en/v/[code]`
- [ ] Show secure voucher experience:
  - merchant name
  - recipient name
  - sender name
  - message
  - amount/balance
  - code
  - QR data placeholder if QR image not ready
  - status
- [ ] Voucher page is source of truth
- [ ] Do not expose unnecessary PII
- [ ] No redemption yet if not ready

## Milestone

```text
Direct payment can be confirmed by merchant.
Voucher is issued only after confirmation.
Basic voucher page exists.
```

---

# Week 5: Stripe Connect V1 Payment Path

## Day 1-2: Stripe Connect Merchant Setup

- [ ] Add feature flag: `stripePaymentsEnabled`
- [ ] Stripe Connect Express onboarding flow
- [ ] Merchant connects Stripe from dashboard settings
- [ ] Store `stripe_account_id`
- [ ] Store `stripe_onboarded`
- [ ] Handle onboarding completion callback
- [ ] Generic errors to client
- [ ] No Stripe secret in frontend

## Day 3-4: Stripe Online Purchase Path

- [ ] Add Stripe/card payment option only when:
  - global Stripe flag enabled
  - merchant Stripe onboarded
  - gift card active
- [ ] Payment method strategy for Stripe
- [ ] Create pending purchase before payment
- [ ] Create Stripe PaymentIntent or Checkout Session server-side
- [ ] Include application/platform fee according to V1 business rule
- [ ] Use Stripe metadata safely:
  - purchase_id
  - merchant_id
  - gift_card_id
- [ ] Do not trust client amount
- [ ] Card/Apple Pay/Google Pay are online methods
- [ ] `payment_source = ONLINE`
- [ ] Voucher not issued at PaymentIntent creation time

## Day 5: Stripe Webhook Confirmation

- [ ] Webhook endpoint for Stripe
- [ ] Verify Stripe webhook signature
- [ ] Idempotency via `processed_webhooks`
- [ ] On successful payment:
  - verify payment belongs to expected purchase
  - mark purchase `payment_confirmed`
  - set `confirmed_at`
  - issue voucher using same voucher issuance service
  - add audit event
- [ ] No duplicate vouchers on webhook retry
- [ ] No raw Stripe errors to client

## Milestone

```text
Stripe path confirms online payments through webhook and reuses the same voucher issuance service as direct payments.
```

---

# Week 6: Redemption, SEO Foundation Hardening, and Tourist Mode

## Day 1-2: Full Redemption Only

- [ ] Merchant redemption page: enter voucher code
- [ ] Validate:
  - code exists
  - voucher belongs to merchant
  - status allows redemption
  - balance > 0
  - not voided/cancelled
- [ ] MVP supports full redemption only
- [ ] Partial redemption deferred to V2
- [ ] Use safe transaction/locking approach where possible
- [ ] Create redemption record
- [ ] Update voucher status to `redeemed`
- [ ] Add audit event
- [ ] Generic error messages

## Day 3: SEO Foundation Hardening

- [ ] Localized metadata on merchant pages
- [ ] Localized metadata on purchase pages
- [ ] Localized metadata on voucher page where safe
- [ ] OG tags for WhatsApp/Instagram sharing
- [ ] Clean page titles:
  - Spanish primary
  - English fallback
- [ ] No marketplace directory yet
- [ ] Prepare route naming for future V1.5 discovery

## Day 4: Tourist Mode for Seville

- [ ] Add tourist-mode copy for English purchase flow
- [ ] Prioritize card/email/download for tourism businesses where Stripe is available
- [ ] Merchant category `tour` gets tourist-friendly messaging
- [ ] Show clear merchant location / meeting point where available
- [ ] Avoid Bizum assumption in English tourist flow
- [ ] Keep Spanish local flow direct-payment friendly

## Day 5: Basic Dashboard Activity

- [ ] Show recent purchases
- [ ] Show pending confirmations
- [ ] Show issued vouchers
- [ ] Show redeemed vouchers
- [ ] Keep analytics simple
- [ ] Advanced revenue/payout analytics deferred

## Milestone

```text
A complete V1 transaction loop exists: create gift card → buyer purchase → payment confirmation → voucher issuance → full redemption.
```

---

# Week 7: Legal Safety, Security Hardening, and Operational Readiness

## Day 1-2: Legal Pages and Consent

- [ ] Terms of Service page:
  - `/es/terminos`
  - `/en/terms`
- [ ] Privacy Policy page:
  - `/es/privacidad`
  - `/en/privacy`
- [ ] Refund/goodwill policy page:
  - legal-safe wording
  - no absolute “no refund always” claims
  - clear Stripe cost/admin fee wording if used
- [ ] Cookie banner if non-essential cookies are introduced
- [ ] Purchase consent checkbox:
  - unchecked by default
  - personalization acknowledgment
  - digital delivery after payment confirmation
- [ ] Pre-purchase disclosure visible before payment
- [ ] Validity/expiry copy legally conservative for Spain

## Day 3: Security Hardening

- [ ] Rate limiting plan for:
  - public purchase creation
  - voucher lookup
  - redemption
  - auth
  - webhooks
- [ ] Add practical MVP rate limits where feasible
- [ ] Security headers:
  - CSP
  - HSTS
  - X-Content-Type-Options
  - X-Frame-Options / frame policy based on future embed needs
  - Referrer-Policy
- [ ] Zod validation on all mutation actions/routes
- [ ] Input sanitization for public text fields
- [ ] No PII in logs
- [ ] Generic errors to client

## Day 4: Audit and Data Safety

- [ ] Audit event insertion on key state changes:
  - purchase created
  - payment confirmed
  - purchase cancelled/rejected
  - voucher issued
  - voucher redeemed
  - Stripe webhook processed
- [ ] Security events for suspicious public attempts where feasible
- [ ] PII cleanup job can be planned but not required for launch if policy is documented
- [ ] Processed webhook cleanup planned
- [ ] Voucher expiry/reminder jobs deferred until legal policy is fully reviewed

## Day 5: UI/UX Polish Batch

- [ ] Mobile responsiveness:
  - public merchant page
  - purchase page
  - voucher page
  - dashboard
- [ ] Empty states
- [ ] Loading states
- [ ] Friendly error states
- [ ] Spanish copy review
- [ ] English tourist copy review
- [ ] Basic accessibility checks

## Milestone

```text
Legal-safe V1 flow, security baseline, audit coverage, and mobile-ready UI are ready for pilot merchants.
```

---

# Week 8: Testing, Launch, and First Merchants

## Day 1-2: E2E Testing

- [ ] E2E: Merchant signup → onboarding → create card
- [ ] E2E: Direct payment purchase → merchant confirms → voucher issued → redeem
- [ ] E2E: Bank transfer path with reference code
- [ ] E2E: Cash path with reference code
- [ ] E2E: Stripe path → webhook confirmation → voucher issued → redeem
- [ ] E2E: Custom amount validation
- [ ] E2E: Inactive gift cards hidden and not purchasable
- [ ] E2E: Missing merchant/card returns 404
- [ ] E2E: Spanish and English flows
- [ ] E2E: Tourist mode for tour merchant
- [ ] Manual mobile testing:
  - iOS Safari
  - Android Chrome

## Day 3: Production Readiness

- [ ] Verify production Supabase project in EU Frankfurt
- [ ] Verify production environment variables
- [ ] Stripe live/test mode decision documented
- [ ] Stripe webhook endpoint configured
- [ ] Vercel production deployment
- [ ] DNS: `parausted.es` → Vercel production
- [ ] HTTPS verified
- [ ] Sentry configured if available
- [ ] Uptime check configured if available
- [ ] Health check endpoint returns 200
- [ ] Production smoke test with test merchant

## Day 4: Pilot Merchant Onboarding

- [ ] Onboard first Seville merchant manually
- [ ] Create first gift card together
- [ ] Configure Bizum/bank/cash settings
- [ ] If ready, configure Stripe Connect
- [ ] Add public page link to Instagram bio / website / WhatsApp status
- [ ] Run one controlled purchase test
- [ ] Confirm payment and issue voucher
- [ ] Redeem test voucher

## Day 5: Launch Review and Next Sprint Planning

- [ ] Review pilot merchant feedback
- [ ] Review buyer friction
- [ ] Review legal copy concerns
- [ ] Review failed validation/error logs
- [ ] Prioritize next sprint:
  - marketplace/discovery V1.5
  - PDF/email delivery polish
  - merchant confirmation UX polish
  - Stripe edge cases
  - SEO landing pages
- [ ] Celebrate first successful gift card lifecycle

## Milestone

```text
LAUNCHED with at least one pilot merchant.
The core V1 gift-card lifecycle works safely end-to-end.
```

---

# Deferred from V1 to V1.5/V2

These are valuable but intentionally deferred to protect MVP delivery:

```text
Marketplace discovery directory
City/category/relationship landing pages at scale
WhatsApp Business API delivery
Rich-media personalization: images/audio/video
Group gifting
Partial redemption
Exchange/transfer
Advanced refund automation
Ledger/payout automation
Scheduled delivery
PDF luxury templates
Wallet passes
Staff accounts
Advanced analytics
Automated expiry/reminder cron jobs until legal policy is confirmed
```

---

# Updated V1 Definition of Done

V1 is done when:

```text
1. Merchant can onboard.
2. Merchant can create and manage bilingual gift cards.
3. Public merchant page works in Spanish and English.
4. Buyer can create pending purchase for direct payment.
5. Merchant can confirm direct payment.
6. Stripe online path can confirm payment through webhook.
7. Voucher is issued only after payment confirmation.
8. Recipient can open voucher page.
9. Merchant can fully redeem voucher.
10. Audit events exist for core state changes.
11. Legal consent and policy pages exist.
12. TypeScript, lint, and build pass.
13. Manual E2E checks pass.
14. First pilot merchant can use the product safely.
```

---

# Recommended Commit Slice Order

Use small validated commits:

```text
1. feat(i18n): add locale-aware routing and SEO foundation
2. feat(auth): add localized auth and dashboard shell
3. feat(merchant): add onboarding and profile management
4. feat(gift-card): add bilingual gift card CRUD
5. feat(public): add localized merchant gift card page
6. feat(purchase): add public pending purchase flow
7. feat(payment): add direct payment confirmation center
8. feat(voucher): issue vouchers after payment confirmation
9. feat(voucher): add public voucher page
10. feat(payment): add Stripe Connect onboarding
11. feat(payment): add Stripe confirmation path
12. feat(redemption): add full voucher redemption
13. feat(seo): harden localized SEO foundation
14. feat(legal): add Spain-safe policy and consent pages
15. chore(security): add MVP security hardening
```
