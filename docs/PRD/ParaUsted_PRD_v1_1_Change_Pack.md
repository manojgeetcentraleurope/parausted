# ParaUsted PRD Change Pack — Spain-First Secure Gift Experience Platform

**Version:** 1.1 Change Pack  
**Date:** 2026-06-08  
**Status:** Proposed updates to PRD v1.0  
**Market priority:** Spain first → Europe next → Global later  
**Primary market:** Seville, Spain  
**Strategic position:** Secure, fast, modular, embeddable SaaS for personalized digital gift-card experiences  

---

## 1. Executive Summary — Updated Positioning

ParaUsted is not only a digital gift-card SaaS. ParaUsted is a **personalized digital gift experience platform** for local businesses in Spain.

The platform allows merchants to create, sell, confirm, issue, deliver, and redeem personalized gift cards across direct/offline and online payment methods. Gift cards are emotional, personalized, legally safer, and channel-flexible.

### Updated Core Value Proposition

- **For Merchants:** “Sell personalized gift experiences through your Instagram, website, WhatsApp, or QR link. Free direct-payment tracking, with Stripe automation when you are ready.”
- **For Buyers:** “Create a personal digital gift with name, message, design, and later image/audio/video — delivered by email, WhatsApp, or shareable link.”
- **For Recipients:** “Receive a beautiful personalized gift experience. No account. No app. Open, enjoy, redeem.”
- **For Tourists:** “Gift a Seville experience easily in English, pay by card, and send it instantly to friends or family.”

### Updated Differentiators

- **Spain-first legal and payment design** — Bizum direct, bank transfer, cash, and Stripe Connect.
- **Family-first personalization** — relationship, design, recipient, sender, personal message.
- **Rich-media-ready gift experience** — future support for images, audio greetings, video greetings, animations, and group gifting.
- **Secure voucher page as source of truth** — WhatsApp/email are delivery channels, not the canonical experience.
- **Direct payment confirmation as a core module** — merchant confirms Bizum/bank/cash before voucher issuance.
- **Stripe in V1** — included for demand, tourist mode, online automation, and team learning.
- **SEO-heavy B2C acquisition** — merchant pages now, discovery marketplace in V1.5.
- **Modular and embeddable SaaS** — designed for hosted pages now and merchant website/app embeds later.

---

## 2. Strategy Updates

### 2.1 Spain First, Europe Next, World Later

ParaUsted will prioritize Spain-only legal and payment safety for V1.

V1 defaults:

```text
Country: ES
Currency: EUR
Timezone: Europe/Madrid
Primary language: Spanish
Secondary language: English
Primary launch city: Seville
```

Europe and global expansion must be handled through future country packs, not hardcoded global assumptions.

Future model:

```text
countryConfig.es
countryConfig.fr
countryConfig.de
countryConfig.it
```

Each country pack should define:

```text
legal disclosure requirements
payment methods
refund/withdrawal rules
validity/expiry policy
tax/VAT notes
supported locales
consent copy
```

### 2.2 Stripe Remains in V1

Stripe Connect remains part of V1 because:

```text
- There is existing demand.
- Tourist mode needs card payments.
- Online payment automation is core learning.
- Stripe Connect keeps platform payment architecture legally safer than holding funds directly.
```

However, Stripe must be implemented as a **payment strategy**, not tightly coupled to purchase or voucher logic.

Core rule:

```text
Payment source changes confirmation path.
Voucher lifecycle remains the same.
```

### 2.3 Marketplace Moves to V1.5, SEO Starts in V1

Marketplace/discovery is V1.5, but SEO foundation starts immediately.

V1 SEO foundation:

```text
localized merchant public pages
localized metadata
clean slugs
Open Graph basics
fast SSR pages
Spanish/English fallback content
structured content for merchant gift cards
```

V1.5 marketplace/discovery:

```text
/tarjetas-regalo-sevilla
/tarjetas-regalo-sevilla/barberias
/tarjetas-regalo-sevilla/tours
/tarjetas-regalo-para-mama-sevilla
/tarjetas-regalo-para-papa-sevilla
city/category/relationship landing pages
```

---

## 3. Product Principle Updates

### Principle 1 — Legal Safety First

ParaUsted must always choose the safer legal path for Spain, even if it means extra consent, clearer disclosures, or slower rollout.

Rules:

```text
No pre-ticked consent checkboxes.
No voucher before payment confirmation.
No misleading refund promises.
No raw payment or legal assumptions in client code.
No hidden expiry/validity conditions.
No dark-pattern checkout.
```

### Principle 2 — One Gift Card Lifecycle

Online and direct/offline purchases share the same post-confirmation gift-card lifecycle.

```text
Pending purchase
→ payment confirmed
→ voucher issued
→ delivered/downloaded
→ redeemed
```

Payment method determines only how payment confirmation happens.

```text
Stripe card / Apple Pay / Google Pay:
  confirmed by Stripe webhook

Bizum direct / bank transfer / cash:
  confirmed manually by merchant
```

### Principle 3 — Gift Card as Experience, Not Just Voucher

The product should be positioned as a personalized gift experience.

V1 personalization:

```text
relationship
design template
recipient name
sender name
personal message
```

Future rich personalization:

```text
image greeting
audio greeting
short video greeting
animation
group contributors
group message wall
```

### Principle 4 — Secure Voucher Page Is Source of Truth

Email, WhatsApp, and download are delivery channels. The voucher page is the canonical experience.

Canonical voucher experience:

```text
/v/[code]
```

The voucher page should eventually display:

```text
merchant branding
recipient name
sender name
relationship theme
personal message
image/audio/video assets
QR code
gift code
balance/status
validity/legal terms
merchant redemption instructions
```

### Principle 5 — Simple Modular SaaS

Build a simple SaaS with modular services and feature flags. Avoid premature enterprise complexity.

Architecture must follow:

```text
SOLID
DRY
KISS
YAGNI
low cyclomatic complexity
low cognitive complexity
Gang of Four patterns only where useful
```

---

## 4. Payment Architecture — Updated

### 4.1 Supported V1 Payment Methods

V1 supports both direct/offline and Stripe online payments.

```text
Direct/offline:
- Bizum direct
- Bank transfer
- Cash

Online:
- Card via Stripe Connect
- Apple Pay via Stripe
- Google Pay via Stripe
```

### 4.2 Payment Strategy Pattern

Payment methods should be implemented using a strategy-style model.

Recommended strategy responsibilities:

```text
isAvailable(merchant)
derivePaymentSource()
createPendingPurchaseInstructions()
confirmPayment()
requiresWebhook()
requiresMerchantConfirmation()
```

Suggested strategies:

```text
BizumDirectPaymentStrategy
BankTransferPaymentStrategy
CashPaymentStrategy
StripeCardPaymentStrategy
```

### 4.3 Direct Payment Confirmation Center — Core V1 Module

Direct payment confirmation is now a core feature, not a later admin convenience.

Merchant dashboard module:

```text
Pending payment requests
Search by reference code
Search by buyer email
View amount and method
Confirm payment
Reject/cancel request
Mark duplicate/suspicious
Audit every action
```

Direct payment lifecycle:

```text
Buyer creates pending purchase.
Buyer pays merchant by Bizum, bank transfer, or cash.
Buyer uses generated reference code.
Merchant verifies payment externally.
Merchant confirms payment in ParaUsted.
System issues voucher.
Recipient receives/downloads voucher.
```

### 4.4 Stripe Confirmation Path

Stripe online payment lifecycle:

```text
Buyer creates pending purchase.
Buyer completes Stripe checkout/payment.
Stripe webhook confirms payment.
System marks purchase as payment_confirmed.
System issues voucher.
Voucher delivery/download begins.
```

Rules:

```text
No voucher before Stripe webhook confirmation.
Webhook must be signature verified.
Webhook processing must be idempotent.
PaymentIntent IDs must not be trusted from client without server verification.
```

---

## 5. Refund, Withdrawal, and Goodwill Policy — Updated

### 5.1 Legal-Safe Wording

Avoid absolute claims like:

```text
No refund always.
Legally bulletproof.
```

Use safer wording:

```text
Personalized digital gift cards may be excluded from statutory withdrawal rights where legally permitted, provided the buyer receives clear pre-contractual information and gives explicit consent before purchase.
```

### 5.2 Goodwill Refund Model

ParaUsted should keep a goodwill-oriented refund policy while protecting platform and payment costs.

Suggested model:

```text
Before payment confirmation:
  Buyer can cancel freely.
  No voucher is issued.

After payment confirmation but before voucher issuance:
  Cancellation/refund may be possible if operationally safe.

After personalized voucher issuance/delivery:
  No automatic refund.
  Goodwill review with merchant.
  Exchange or transfer should be preferred where possible.

If merchant cannot provide service:
  Refund, transfer, or alternative resolution must be supported.
```

### 5.3 Stripe Cost Recovery

For approved goodwill refunds, ParaUsted may recover unavoidable payment processing/platform costs if clearly disclosed before purchase and legally permitted.

Suggested policy wording:

```text
If a goodwill refund is approved after payment processing, any non-recoverable payment processing costs and a small administrative fee may be deducted where permitted by law and clearly disclosed before purchase.
```

Initial commercial target:

```text
Recover Stripe cost + optional small platform admin fee, for example around 1%, subject to legal review and clear disclosure.
```

---

## 6. Validity and Expiry — Updated Legal Safety

Spain gift-card expiry/validity needs careful legal review. Avoid aggressive expiry claims in public copy until reviewed.

Updated PRD wording:

```text
Validity and expiry policy is country-specific and must be legally reviewed.
For Spain MVP, ParaUsted should avoid aggressive expiry and must disclose all validity conditions clearly before purchase.
```

Implementation can retain `valid_days` for product configuration, but public legal copy must be conservative and transparent.

Rules:

```text
Do not hide expiry/validity terms.
Do not use short or surprising expiry periods.
Do not expire paid value without a legally reviewed policy.
Use reminders before any expiration or validity deadline.
```

---

## 7. Tourist Mode — New V1 Capability

Tourist mode is part of V1 for Seville, especially for tours, restaurants, flamenco experiences, and local activities.

Tourist mode requirements:

```text
English public pages
English purchase flow
Card/Apple Pay/Google Pay via Stripe
Email and download delivery priority
Clear meeting point/address
Timezone clarity
Mobile-first UX
No Bizum assumption for foreign buyers
SEO pages for Seville experiences
```

Tourist mode examples:

```text
Gift a Seville walking tour
Gift a flamenco experience
Gift tapas dinner
Gift a private guide experience
```

---

## 8. Rich-Media Personalization — Future Module

Rich-media gifting is a strategic differentiator but should be modular and feature-flagged.

### V1

```text
relationship
design template
recipient name
sender name
personal message
```

### V1.5

```text
beautiful voucher preview
basic PDF/download
email delivery
shareable voucher page
```

### V2

```text
image upload
audio greeting
short video greeting
animated card templates
media moderation
storage lifecycle
group contributors
```

### Future Table Concept

Do not implement now unless needed, but reserve the concept:

```text
personalization_assets
- id
- purchase_id
- merchant_id
- asset_type: image | audio | video | animation
- storage_path
- mime_type
- file_size_bytes
- duration_seconds
- status: pending_scan | approved | rejected | deleted
- created_at
```

Rich media risks that must be handled before implementation:

```text
GDPR consent
PII and personal media retention
file-size limits
malware scanning
content moderation
copyright/abuse reporting
storage cost controls
email deliverability
WhatsApp media constraints
```

---

## 9. Feature Flags — Updated Architecture Requirement

ParaUsted should be feature-flag driven but simple.

Suggested V1/V1.5 flags:

```text
directPaymentsEnabled
stripePaymentsEnabled
bizumDirectEnabled
bankTransferEnabled
cashEnabled
touristModeEnabled
englishContentEnabled
pdfVoucherEnabled
emailDeliveryEnabled
whatsappDeliveryEnabled
scheduledDeliveryEnabled
partialRedemptionEnabled
marketplaceDiscoveryEnabled
walletPassEnabled
richMediaPersonalizationEnabled
```

Flag levels:

```text
global
country
merchant
```

Keep implementation simple with typed configuration first. Do not introduce a complex external feature-flag platform for MVP.

---

## 10. Embeddable Platform Direction

ParaUsted should be designed as a fast hosted SaaS today and an embeddable platform later.

V1:

```text
Hosted merchant pages
Hosted purchase flow
Hosted voucher page
Shareable URLs
QR-friendly routes
```

Future:

```text
/embed/merchant/[slug]
/embed/gift-card/[id]
merchant website widgets
mobile app webviews
public API for approved merchants
```

Architectural requirement:

```text
Separate domain logic from page UI so hosted pages, embeds, and APIs can reuse the same services.
```

---

## 11. Security Positioning — Updated

ParaUsted should be projected as secure and fast, but every claim must map to real controls.

Security controls required:

```text
RLS for tenant isolation
no service_role in frontend
server-side amount derivation
server-side reference code generation
no voucher before payment confirmation
generic client errors
no PII in logs
rate limits on public purchase/voucher endpoints
audit events for business actions
Stripe webhook signature verification
webhook idempotency
crypto-random voucher codes
atomic redemption
immutable audit/ledger records where applicable
```

Public positioning:

```text
Secure by design.
Payment-safe.
Privacy-conscious.
GDPR/LOPDGDD aware.
No account required for buyers or recipients.
No voucher issued before payment confirmation.
```

---

## 12. Updated Roadmap

### V1 — Spain Secure Transaction MVP

```text
Merchant onboarding
Gift-card CRUD
Bilingual public merchant pages
SEO foundation
Public pending purchase flow
Direct payments: Bizum, bank transfer, cash
Stripe Connect: card, Apple Pay, Google Pay
Direct Payment Confirmation Center
Stripe webhook confirmation
Voucher issuance after payment confirmation only
Basic voucher page/code
Full redemption only
Audit events
Tourist mode for Seville
```

### V1.5 — Discovery and Delivery Polish

```text
Seville discovery marketplace
City/category/relationship SEO pages
Beautiful gift-card preview
Basic PDF voucher
Email delivery
Merchant confirmation center polish
Basic analytics
Expiry/validity reminders if legally approved
```

### V2 — Advanced Lifecycle and Personalization

```text
Partial redemption
Exchange/transfer
Scheduled delivery
Staff accounts
WhatsApp delivery
Rich media personalization: image/audio/video
Media moderation and scanning
Refund workflow automation
Wallet-pass investigation
```

### V3 — Scale and B2B

```text
Corporate bulk gifting
Group gifting
Multi-city marketplace
API access
Multi-location merchants
White-label lite
B2B gifting
```

---

## 13. Immediate Implementation Sequence

Recommended next engineering slices:

```text
1. Public pending purchase flow for direct payments
2. Direct Payment Confirmation Center
3. Voucher issuance service after payment confirmation
4. Basic voucher page/code
5. Stripe Connect payment path
6. Stripe webhook confirmation reusing same voucher issuance service
7. SEO foundation hardening
8. Tourist mode polish
```

Important sequencing rule:

```text
Do not build rich media, PDF, WhatsApp, partial redemption, or marketplace until the basic transaction loop is complete.
```

Basic transaction loop:

```text
merchant creates gift card
buyer creates pending purchase
payment is confirmed
voucher is issued
recipient redeems
merchant completes service
```

---

## 14. Locked Architecture Principles

Every implementation task must follow:

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

Recommended pattern usage:

```text
Payment methods: Strategy Pattern
Voucher creation: Factory Pattern
Delivery providers: Adapter Pattern
Refund/legal rules: Policy Objects
Purchase lifecycle: transition map first, State Pattern later only if needed
```

---

## 15. PRD Text Replacements

### Replace

```text
Legally bulletproof
```

### With

```text
Designed for legal safety through clear personalization, explicit consent, audit evidence, and Spain-first legal review.
```

---

### Replace

```text
No refund for personalized gift cards
```

### With

```text
Personalized digital gift cards may be excluded from statutory withdrawal rights where legally permitted and properly disclosed. ParaUsted may still support goodwill refunds, exchanges, or transfers in coordination with the merchant.
```

---

### Replace

```text
Voucher expires after 365 days
```

### With

```text
Validity and expiry are country-specific and must be clearly disclosed before purchase. Spain MVP will avoid aggressive expiry until legal review confirms the safest policy.
```

---

### Add

```text
Direct Payment Confirmation Center is a core V1 module. For Bizum, bank transfer, and cash, the merchant must confirm payment before voucher issuance.
```

---

### Add

```text
WhatsApp, email, and download are delivery channels. The secure voucher page is the canonical gift experience and source of truth.
```

---

### Add

```text
Rich-media personalization is a future modular feature. Images, audio, video, animation, and group gifting must be feature-flagged and introduced only after storage, moderation, GDPR, and delivery risks are addressed.
```

---

## 16. Final Updated Product Thesis

ParaUsted is a Spain-first, legally safe, secure, fast, modular SaaS platform for personalized digital gift experiences.

It starts with local merchants in Seville, supports direct payments and Stripe in V1, uses direct payment confirmation and webhook confirmation to issue vouchers safely, and grows into an SEO-driven discovery and rich-media gifting platform for Spain, then Europe, then global markets.

The core promise:

```text
El regalo perfecto, personalizado, seguro y fácil de enviar.
```
