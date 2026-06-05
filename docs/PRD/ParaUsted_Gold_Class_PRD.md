# 🎁 ParaUsted — Gold Class Product Requirements Document (PRD)

**Version:** 1.0
**Date:** June 2026
**Status:** Approved — All Pillars Locked
**Domain:** parausted.es
**Market:** Seville, Spain (MVP) → Spain → LATAM → Global
**Tagline:** *"El regalo perfecto, para quien tú quieras"*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Problem Statement](#2-vision--problem-statement)
3. [Personas & Pain Points](#3-personas--pain-points)
4. [Product Principles](#4-product-principles)
5. [Business Model & Pricing](#5-business-model--pricing)
6. [Feature Specification](#6-feature-specification)
7. [Family Gift Card Collection](#7-family-gift-card-collection)
8. [UX Flows](#8-ux-flows)
9. [Payment Architecture](#9-payment-architecture)
10. [Refund & Payout Model](#10-refund--payout-model)
11. [Technical Architecture](#11-technical-architecture)
12. [Database Schema & Data Model](#12-database-schema--data-model)
13. [State Machines & Event System](#13-state-machines--event-system)
14. [Security & Threat Model](#14-security--threat-model)
15. [Rate Limiting Matrix](#15-rate-limiting-matrix)
16. [GDPR & Legal Compliance (LOPDGDD)](#16-gdpr--legal-compliance-lopdgdd)
17. [Logging, Audit & Monitoring](#17-logging-audit--monitoring)
18. [Infrastructure & Deployment](#18-infrastructure--deployment)
19. [Go-To-Market Strategy (Seville)](#19-go-to-market-strategy-seville)
20. [Success Metrics & KPIs](#20-success-metrics--kpis)
21. [Risks & Mitigations](#21-risks--mitigations)
22. [Roadmap (V1 → V2 → V3 → B2B)](#22-roadmap)
- [Appendix A: Edge Cases Master List](#appendix-a-edge-cases-master-list)
- [Appendix B: Production Security Checklist](#appendix-b-production-security-checklist)
- [Appendix C: Cost Projections](#appendix-c-cost-projections)

---

## 1. Executive Summary

ParaUsted is a self-serve digital gift card SaaS platform for local businesses in Spain. It enables any merchant — barbers, restaurants, tour operators, gyms, language schools — to create, sell, deliver, and track personalized digital gift cards without technical knowledge, website, or upfront cost.

The platform uses a **"vertical wedge into horizontal platform"** strategy: start with barbers in Seville, expand to all local business types, then scale to corporate/B2B gifting across Spain and LATAM.

### Core Value Proposition

- **For Merchants:** "Turn your social media followers into gift card buyers. Free to start. No website needed."
- **For Buyers:** "Gift a local experience to someone you love. Personalized, beautiful, delivered instantly."
- **For Recipients:** "Receive a thoughtful gift. No app download. No account. Just enjoy."

### Key Differentiators

- **Family-first personalization** (Para Mamá, Para Papá, etc.) — emotional UX, not transactional
- **Offline-first adoption** — merchants use the platform FREE with cash/Bizum/bank transfer
- **Spain-native** — GDPR/LOPDGDD compliant, Spanish UX, Bizum-friendly, EU data residency
- **Legally bulletproof** — 5-layer personalization as EU withdrawal right shield, proper consent flows
- **"Para Usted" = "For You"** (formal Spanish) — brand IS the product message, works for both B2C and B2B

---

## 2. Vision & Problem Statement

### The Problem

Local businesses in Seville (and across Spain) have strong social media presence — TikTok, Instagram — but zero tools to convert followers into revenue. When someone sees a great haircut on Instagram and wants to gift it to a friend, there is no easy way to do so. The business loses a sale. The customer loses an opportunity.

### Market Gap

| Existing Player | Gap |
|---|---|
| Click&Gift (Spain) | Corporate/B2B only — not for a barber |
| Edenred Regalo | Enterprise employee rewards — too complex |
| Por Muchos Más | Generic cart UX, limited provinces, early stage |
| GiftFly (US) | US-focused, no GDPR, no Spanish, no Bizum |
| Square Gift Cards | Requires Square POS, US-centric |
| VoucherCart | No Spain localization |

**Nobody owns the "simple gift card platform for ANY local business in Spain" space.**

### Market Size

| Market | Size | Growth |
|---|---|---|
| Spain Gift Card Market (2026) | €4.65 Billion | 5.8% CAGR → €5.83B by 2030 |
| Spain Rewards & Incentives | €14.7 Billion (2022) | 8.1% CAGR → €27.1B by 2030 |
| Global Corporate Gifting | $285 Billion (2026) | → $413B by 2035 |

---

## 3. Personas & Pain Points

### 3.1 Merchant Personas

| Persona | Pain | Gift Card Value | Extra Loop (V2) |
|---|---|---|---|
| 🪒 Barber (MVP) | No website, strong TikTok/Insta, followers can't convert | "Gift a haircut" via Instagram bio link | Time-slot discounting for quiet hours |
| 🍽️ Restaurant | No way to bring young customers back | "Gift a meal" + loyalty | Loyalty loop: spend €30, get €5 card |
| 🗺️ Tour Operator | Someone loves a tour but can't gift it | "Gift this experience" | Discounted card for next booking |
| 🏫 Language/Driving School | Hard to convert trial interest | "Gift a course pack" | Referral: gift a trial class |
| 🏋️ Gym | Seasonal drop-off, empty off-peak hours | "Gift a month" or off-peak pass | Time-slot + loyalty |

### 3.2 Three Actors in Every Transaction

| Actor | Internal Name | Auth Required? | Description |
|---|---|---|---|
| Business Owner | Merchant | ✅ Yes — full account | Creates gift cards, manages dashboard, receives payouts |
| Gift Buyer | Customer | ❌ No — anonymous | Purchases gift card, provides email for receipt only |
| Gift Receiver | Recipient | ❌ No — anonymous | Receives gift card, redeems at merchant. Possession = access. |
| Platform Admin | Admin | ✅ Yes — MFA required | Manages platform, disputes, payouts, security |
| Business Staff | Staff (V2) | ✅ Yes — invited | Can redeem vouchers and view dashboard only |

---

## 4. Product Principles

### Principle 1 — Adoption First

Merchants should be able to use ParaUsted without changing how they currently receive money. Cash, Bizum, bank transfer, and card should all work. Offline tracking is FREE.

### Principle 2 — One Gift Card Lifecycle

Online and offline gift cards behave identically after creation. Redemption logic never cares whether Stripe processed payment, cash was collected, or Bizum was received. **A valid gift card is a valid gift card.**

### Principle 3 — Minimal Friction

No recipient account required. No app download required. No login required for redemption. Possession of the gift card link/code is enough.

### Principle 4 — Personalization as Product

Every gift card is personalized (recipient name, sender name, message, design template, relationship type). This creates emotional value AND legal protection (EU personalization exemption from withdrawal right).

### Principle 5 — Design for Tomorrow, Build for Today

Architecture supports multi-tenancy, B2B, multi-city, and international expansion. But MVP ships with the minimum to serve 10 barbers in Seville.

---

## 5. Business Model & Pricing

### 5.1 Revenue Model

| Payment Method | Money Flow | Commission | Voucher Generated |
|---|---|---|---|
| 💳 Card (Stripe) | Customer → Stripe → Merchant | 5% platform fee | Auto (webhook) |
| 🍎 Apple Pay (Stripe) | Customer → Stripe → Merchant | 5% platform fee | Auto (webhook) |
| 🔵 Google Pay (Stripe) | Customer → Stripe → Merchant | 5% platform fee | Auto (webhook) |
| 📱 Bizum (direct) | Customer → Merchant directly | **FREE** | After merchant confirms |
| 🏦 Bank Transfer (direct) | Customer → Merchant directly | **FREE** | After merchant confirms |
| 💵 Cash | Customer → Merchant in person | **FREE** | After merchant confirms |

**Strategy:** Give offline tracking for FREE → merchant sees value → merchant enables online payments → platform earns 5% on online sales. This is the freemium model applied to payment channels, not features.

### 5.2 Unit Economics (Per €35 Gift Card — Online)

| Line Item | Amount |
|---|---|
| Customer pays | €35.00 |
| Stripe processing fee (~1.4% + €0.25) | -€0.74 |
| Platform commission (5%) | €1.75 |
| Merchant receivable | €32.51 |
| **Platform net revenue** | **€1.75** |

### 5.3 Payout Model (Online Only)

| Payout | Timing | Amount | Purpose |
|---|---|---|---|
| 85% release | 72 hours after purchase | 85% of merchant receivable | Merchant gets most money fast |
| 15% reserve | 14 days after purchase | 15% of merchant receivable | Covers potential refund window |

Direct payments (Bizum/cash/bank): No payout logic. Merchant already has the money. Platform only tracks the gift card lifecycle.

---

## 6. Feature Specification

### 6.1 MVP Features (Phase 0-1)

| Feature | Source | Description |
|---|---|---|
| Merchant onboarding | ParaUsted | Email/Password + Magic Link + Google OAuth + Password Recovery |
| Gift card creation | Both | Fixed value, custom value, and service-based card types |
| Family card collection | ParaUsted | Mamá, Papá, Hija, Hijo, Abuelos, Pareja, Familia, Amigo |
| 5-layer personalization | ParaUsted | Relationship + design + recipient name + sender name + message (all required) |
| Online payment (Stripe) | ParaUsted | Card + Apple Pay + Google Pay via Stripe Connect |
| Offline payment tracking | LokalGift | Cash/Bizum/Bank — FREE, no commission, merchant confirms |
| PDF voucher | LokalGift | Luxury printable templates with QR code for each family card type |
| Delivery: WhatsApp | Both | Backend-only via Meta Business API with audit trail |
| Delivery: Email | Both | Via Resend with branded templates |
| Delivery: Download yourself | LokalGift | PDF + shareable link — buyer sends manually, no messaging cost |
| Scheduled delivery | LokalGift | Buy today, deliver on specific date (birthday, Mother's Day) |
| QR code redemption | Both | Merchant scans or enters code. Atomic, row-locked. |
| Partial redemption | ParaUsted | Track remaining balance across multiple uses |
| Exchange to other service | ParaUsted | Swap voucher to different service at same merchant |
| Transfer to another person | ParaUsted | Change recipient — no money moves |
| Refund policy | ParaUsted | 24h full, 14d minus 15%, exchange/transfer always |
| Merchant dashboard | Both | Sales, redemptions, payouts, gift card management |
| Immutable audit trail | Both | Every action logged, no deletes |
| Rate limiting (all endpoints) | LokalGift+ | Per IP, per user, per merchant, per voucher |
| Webhook replay protection | LokalGift | event_id dedup, idempotent handlers |
| Reference code | ParaUsted | Auto-generated PU-XXXX for Bizum/bank payment matching |
| Expiry reminders | ParaUsted | Email/WhatsApp at 90 and 30 days before expiry |
| PII auto-cleanup | ParaUsted | Buyer/recipient PII deleted 30 days after expiry/redemption |

### 6.2 V2 Features

| Feature | Description |
|---|---|
| Upgrade difference payment | Gift card balance €50, service €65 → recipient pays €15 difference |
| Multiple cards combined | Apply 2+ gift cards to one purchase |
| Merchant staff accounts | Invite-based Magic Link, can redeem + view dashboard only |
| Trust tier payouts | Faster unredeemed payouts for proven merchants (20+ sales) |
| Buyer "Mis Regalos" history | Lightweight Magic Link account — see all gifts sent/received |
| Time-slot discounting | Sell discounted gift cards for off-peak hours |
| Loyalty cards | Return-visit incentive cards |
| Auto-reminders to recipients | "Your gift is waiting!" — Day 1, 3, 7 |
| Advanced analytics dashboard | Revenue trends, popular cards, buyer demographics |

### 6.3 V3 Features

| Feature | Description |
|---|---|
| Corporate bulk gifting | CSV upload, multiple recipients, bulk generation/delivery |
| City discovery marketplace | "Tarjetas regalo en Sevilla" — SEO-driven discovery page |
| SSO/SAML for enterprise | Corporate client auth integration |
| API access | Public API for POS integration, custom workflows |
| Multi-location merchant | Voucher valid at any location of the same business |
| White-label (lite) | Remove "Powered by ParaUsted" for Pro/Business plans |
| LATAM expansion | Same language, same product, new markets |

---

## 7. Family Gift Card Collection

The Family Gift Card Collection is ParaUsted's core differentiator. Each card is emotionally designed for a specific family relationship, making the purchase experience feel like gifting — not e-commerce.

### Card Types

| Card | Spanish Label | Design Theme | Key Occasions |
|---|---|---|---|
| 👩 Mamá | "Para Mamá" | Flowers, warm colors, hearts | Mother's Day, Birthday, Christmas |
| 👨 Papá | "Para Papá" | Bold, classic, hobbies | Father's Day, Birthday, Christmas |
| 👧 Hija | "Para mi Hija" | Playful, colorful, stars | Birthday, Graduation |
| 👦 Hijo | "Para mi Hijo" | Adventure, sports, cool | Birthday, Achievement |
| 👴 Abuelo | "Para el Abuelo" | Warm, vintage, family | Grandparents' Day, Birthday |
| 👵 Abuela | "Para la Abuela" | Flowers, soft, cozy | Grandparents' Day, Birthday |
| 💑 Pareja | "Para mi Amor" | Romantic, elegant | Valentine's, Anniversary |
| 👨‍👩‍👧‍👦 Familia | "Para toda la Familia" | Group, fun, celebration | Christmas, New Year |
| 🤝 Amigo/a | "Para mi Amigo/a" | Fun, vibrant, casual | Birthday, Thank You |

### 7.1 Personalization Layers (Legal Shield)

Every family gift card has 5 layers of personalization. Each layer independently qualifies for the EU personalized goods exemption (Directive 2011/83, Art. 16). Combined, they make the withdrawal right exemption bulletproof.

| # | Layer | Example | Reusable by Another Buyer? |
|---|---|---|---|
| 1 | Relationship type | "Para Mamá" | ❌ No — specific to buyer's intent |
| 2 | Design template | Flowers/Spring theme | ❌ No — buyer chose it |
| 3 | Recipient name | "María" | ❌ No — unique to this person |
| 4 | Sender name | "Ana" | ❌ No — identifies the buyer |
| 5 | Personal message | "Gracias por ser la mejor..." | ❌ No — unique text by buyer |

### 7.2 Seville Calendar — Demand Spikes

| Month | Event | Target Card | Expected Demand |
|---|---|---|---|
| Feb 14 | San Valentín | 💑 Pareja | 🔥🔥🔥 |
| Mar 19 | Día del Padre (Spain) | 👨 Papá | 🔥🔥🔥 |
| May (1st Sun) | Día de la Madre | 👩 Mamá | 🔥🔥🔥🔥 |
| Jun | Graduations | 👧👦 Hija/Hijo | 🔥🔥 |
| Oct 1 | Día de los Abuelos (Spain) | 👴👵 Abuelo/Abuela | 🔥🔥 |
| Dec | Navidad / Reyes | 👨‍👩‍👧‍👦 ALL types | 🔥🔥🔥🔥🔥 |
| Any | Birthdays | ALL types | 🔥 (constant) |

**Launch Strategy:** Launch 2 weeks before Día de la Madre. Built-in urgency + demand.

---

## 8. UX Flows

### 8.1 Buyer Purchase Flow

1. Buyer visits merchant gift card page (e.g., `parausted.es/barbercarlos`)
2. Selects family relationship type (Mamá, Papá, Hija, etc.)
3. Chooses design template from themed collection
4. Selects gift card type: specific service OR custom amount
5. Enters personalization: recipient name (required), sender name (required), personal message (required, pre-filled but editable)
6. Previews the complete personalized gift card
7. Chooses delivery method: WhatsApp, Email, or Download & Send Yourself
8. Optionally schedules delivery for a future date
9. Selects payment: Card/Apple Pay/Google Pay (online) OR Bizum/Bank/Cash (direct)
10. Accepts consent checkbox: immediate delivery + personalization acknowledgment
11. Completes payment
12. **Online:** auto-confirmed via webhook → voucher generated → delivered
13. **Direct:** "Awaiting merchant confirmation" → merchant verifies → confirms → voucher generated → delivered

### 8.2 Merchant Onboarding Flow

1. Merchant signs up: Email/Password OR Magic Link OR Google OAuth
2. Sets up business profile: name, slug (URL), category, logo, brand color, address
3. Creates first gift card type(s): title, description, price, validity period
4. Optionally connects Stripe (Express onboarding): DNI + NIF/CIF + IBAN (~5 min)
5. Configures direct payment info: Bizum phone number, bank IBAN
6. Shares gift card page link on social media (Instagram bio, TikTok, WhatsApp status)
7. Receives first purchase notification → confirms payment (direct) or auto-confirmed (online)
8. Redeems voucher when recipient visits → clicks "Redeem" on dashboard

### 8.3 Redemption Flow

1. Recipient visits merchant with gift card (link, QR, PDF, or code)
2. Merchant opens dashboard → "Redeem Voucher"
3. Enters voucher code OR scans QR code
4. System validates: code valid? balance sufficient? not expired? correct merchant?
5. Merchant enters redemption amount (full or partial)
6. System executes atomic redemption (row lock + transaction)
7. Voucher balance updated. Status changes to `redeemed` or `partially_redeemed`
8. Merchant provides the service. Done.

### 8.4 Delivery Options

| Option | How It Works | Messaging Cost |
|---|---|---|
| 📱 WhatsApp | Backend sends via Meta Business API | ~€0.04/msg |
| 📧 Email | Backend sends via Resend | ~€0.001/msg |
| 📄 Download & Send Yourself | Buyer gets PDF + shareable link, sends personally | FREE |

### 8.5 PDF Voucher Strategy

PDF is NOT a replacement for digital redemption — it's an additional gifting experience.

**Use cases:**
- **Birthday:** Print voucher, place inside envelope
- **Wedding:** Physical handover as a gift
- **Christmas:** Print, wrap, put under tree
- **Corporate:** Physical presentation during meetings

**PDF contains:** Gift value, experience, recipient name, sender name, personal message, QR code, gift code, expiry date, merchant name + address. Luxury templates per family card type.

---

## 9. Payment Architecture

### 9.1 Payment Processor: Stripe Connect

Stripe Connect (Express accounts) handles all online payments. This eliminates all regulatory burden — Stripe is the licensed Payment Service Provider (PSP). ParaUsted never holds merchant funds.

**Money flow:** Customer → Stripe → Merchant. Platform commission (5%) collected as Stripe `application_fee`.

**Why Stripe Connect (Not MONEI for MVP):**

| Factor | Stripe Connect | MONEI |
|---|---|---|
| Marketplace support | Purpose-built (split payments, KYC, payouts) | Not a marketplace tool |
| KYC/AML compliance | Stripe handles everything | YOU must handle (regulatory risk) |
| PSD2 compliance | Stripe is licensed PSP — you're just a platform | You become a payment facilitator (need license) |
| Bizum | Not natively supported (MVP trade-off) | Native support |
| **Decision** | **SELECTED for MVP (legal safety)** | Consider for V2 Bizum integration |

### 9.2 Bizum: The Elegant Workaround

Bizum (28M+ users in Spain, ~36% payment market share) is handled via **direct payment** — customers pay merchants directly via Bizum. ParaUsted only TRACKS the transaction.

**Legally safe:** No money flows through ParaUsted. The platform is a SaaS tracking tool, not a payment intermediary.

**UX:** Customer sees merchant's Bizum number + auto-generated reference code (PU-7F3K). Sends Bizum directly. Clicks "I've sent the payment." Merchant verifies and confirms on dashboard.

### 9.3 Offline Payment Model

Offline gift cards (cash, Bizum direct, bank transfer) are **FREE to track**. No commission. No payout logic. ParaUsted only records the gift card, value, recipient, and redemption history.

### 9.4 Reference Code System

Every purchase generates a unique reference code (e.g., `PU-7F3K`). For direct payments, the buyer includes this in their Bizum concept field or bank transfer reference. The merchant matches it on the dashboard to confirm the correct payment.

### 9.5 T&C Payment Disclaimer

> "ParaUsted facilitates the creation and tracking of digital gift cards. For direct payment methods (Bizum, bank transfer, cash), ParaUsted does not process, hold, or intermediate any funds. Payment is made directly between the buyer and the merchant. ParaUsted is not responsible for payment disputes, non-receipt, incorrect amounts, or transfer failures for direct payments. For card payments, processing is handled by Stripe Payments Europe, Ltd., a licensed payment institution."

---

## 10. Refund & Payout Model

### 10.1 Refund Policy

| Scenario | Policy | Processing Fee Split |
|---|---|---|
| 0-24 hours, unredeemed | ✅ Full refund | 50% Merchant + 50% Platform (~€0.37 each) |
| 24h-14 days, unredeemed | ✅ Refund minus 15% fee | Customer bears 15%. Processing fee: 50/50 |
| Any time, redeemed or not | 🔄 Exchange to another service at same merchant | No refund — balance transfers |
| Any time, unredeemed | 🔄 Transfer to another person | No refund — recipient changes |
| After redemption (full) | ❌ No refund | Service performed |
| After 14 days, unredeemed | ❌ No refund. Voucher valid 12+ months. | N/A |

### 10.2 Legal Basis

EU Directive 2011/83 grants buyers a 14-day withdrawal right. However, Article 16 provides exceptions:

1. **Personalized goods:** 5-layer personalization makes each gift card unique to the buyer's specifications
2. **Digital content consent:** Explicit checkbox acknowledging immediate delivery and loss of withdrawal right

ParaUsted qualifies under BOTH exceptions. Nevertheless, a goodwill refund policy (24h full, 14d minus 15%) is maintained to build trust.

### 10.3 Payout Schedule (Online Only)

| Payout | Timing | Trigger |
|---|---|---|
| 85% release | 72 hours after purchase | Daily cron job at 06:00 UTC |
| 15% reserve | 14 days after purchase | Daily cron job at 06:00 UTC |

---

## 11. Technical Architecture

### 11.1 Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| Frontend | Next.js (App Router) on Vercel | SSR for SEO + social previews (WhatsApp OG tags) |
| Backend / API | Next.js API Routes + Supabase Edge Functions | Single codebase. Serverless. EU region. |
| Database | Supabase Postgres (Frankfurt, EU) | RLS for multi-tenancy. Auth + Storage + pg_cron included. |
| Auth | Supabase Auth | Email/Password + Magic Link + Google OAuth. Free. |
| Payments | Stripe Connect (Express) | Licensed PSP. KYC handled. No regulatory burden. |
| File Storage | Supabase Storage | PDF vouchers, merchant logos. EU region. |
| Email | Resend | Modern API. 3K free/month. |
| WhatsApp | Meta Business API | Official API. 1K free conversations/month. |
| CDN + DNS + DDoS | Cloudflare (free) | 330+ edge locations. DDoS protection. |
| Monitoring | Sentry (errors) + Vercel Analytics | Free tiers cover MVP. |
| Analytics | PostHog | Free 1M events/month. EU hosting. |
| Cron Jobs | Supabase pg_cron | Payouts, expiry, PII cleanup, delivery scheduling. |
| CI/CD | Vercel auto-deploy + GitHub Actions | Preview per PR. TypeScript + lint + test on push. |

### 11.2 Multi-Tenancy Model

**Model C: Shared database, shared schema, `merchant_id` column on every table.**

Row Level Security (RLS) enforces data isolation at the database level. Even if application code has a bug, the database prevents cross-tenant data leakage.

**Scaling strategy:** Design for tier-based sharding from Day 1 (connection resolver function), but build shared DB only. When a mega-tenant appears (V3), route them to a dedicated DB instance.

### 11.3 Architecture Principles

- **SOLID, DRY, KISS, YAGNI** — no premature optimization
- **Fail-closed on payment errors:** no voucher unless payment confirmed
- **Immutable financial records:** `ledger_entries` and `audit_events` have no UPDATE/DELETE
- **Backend-only for sensitive operations:** WhatsApp, payment processing, admin actions
- **Generic error messages to client,** detailed errors in server logs only
- **Every DB call through a connection resolver** (future sharding ready)
- **Payment source is metadata, not logic** — redemption flow is identical regardless of how the gift card was paid for

---

## 12. Database Schema & Data Model

### 12.1 Table Overview

| # | Table | Purpose | Est. Rows (1000 merchants) |
|---|---|---|---|
| 1 | `merchants` | Tenant master — business profile, branding, payment config | 1,000 |
| 2 | `gift_cards` | What the merchant offers — card types, prices, validity | ~5,000 |
| 3 | `purchases` | Transaction record — buyer, recipient, personalization, payment | ~20,000/month |
| 4 | `vouchers` | The actual gift card — code, QR, balance, status, expiry | ~20,000/month |
| 5 | `redemptions` | Usage tracking — amount, balance change, who redeemed | ~15,000/month |
| 6 | `delivery_events` | Delivery audit — channel, provider_message_id, status | ~25,000/month |
| 7 | `ledger_accounts` | Financial accounts — per merchant + platform accounts | ~3,000 |
| 8 | `ledger_entries` | Double-entry ledger — every cent tracked, IMMUTABLE | ~60,000/month |
| 9 | `payouts` | Merchant payment records — amount, status, schedule | ~4,000/month |
| 10 | `audit_events` | Complete history — every business action, IMMUTABLE | ~100,000/month |
| 11 | `processed_webhooks` | Idempotency — webhook event_id dedup | ~6,000/month (auto-cleaned) |
| 12 | `security_events` | Security log — failed logins, rate limits, fraud flags | Variable |

### 12.2 Key Schema Decisions

- Every table with `merchant_id` has RLS policy: merchant can only see their own data
- Voucher codes: cryptographically random, 12+ characters, non-sequential (e.g., `PU-A7F3-K9P2-X8Q1`)
- Amounts stored in **cents (INTEGER)** — never floating point for money
- Ledger is double-entry: every money movement creates debit + credit entries that sum to zero
- `REVOKE UPDATE, DELETE` on `ledger_entries`, `audit_events`, and `security_events` — append-only
- `purchases` table stores full personalization data (relationship, design, message) for legal evidence
- `buyer_email` and `recipient_email` auto-deleted 30 days after voucher expiry/redemption (GDPR)
- CHECK constraints prevent negative redemptions and invalid balance states

### 12.3 merchants

```sql
CREATE TABLE merchants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id        UUID UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    category            TEXT NOT NULL,  -- 'barber','restaurant','tour','gym','school','other'
    description         TEXT,
    logo_url            TEXT,
    cover_image_url     TEXT,
    brand_color         TEXT DEFAULT '#000000',
    phone               TEXT,
    email               TEXT NOT NULL,
    website_url         TEXT,
    address             TEXT,
    city                TEXT NOT NULL DEFAULT 'Sevilla',
    country             TEXT NOT NULL DEFAULT 'ES',
    timezone            TEXT NOT NULL DEFAULT 'Europe/Madrid',
    stripe_account_id   TEXT,
    stripe_onboarded    BOOLEAN DEFAULT FALSE,
    bizum_phone         TEXT,
    bank_iban           TEXT,
    plan_tier           TEXT NOT NULL DEFAULT 'free',
    status              TEXT NOT NULL DEFAULT 'active',
    onboarded_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 12.4 gift_cards

```sql
CREATE TABLE gift_cards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    card_type           TEXT NOT NULL,  -- 'fixed_value','custom_value','service'
    title               TEXT NOT NULL,
    description         TEXT,
    amount_cents        INTEGER,
    min_amount_cents    INTEGER,
    max_amount_cents    INTEGER,
    valid_days          INTEGER NOT NULL DEFAULT 365,
    image_url           TEXT,
    sort_order          INTEGER DEFAULT 0,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 12.5 purchases

```sql
CREATE TABLE purchases (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id                 UUID NOT NULL REFERENCES merchants(id),
    gift_card_id                UUID NOT NULL REFERENCES gift_cards(id),
    amount_cents                INTEGER NOT NULL,
    currency                    TEXT NOT NULL DEFAULT 'EUR',
    buyer_email                 TEXT NOT NULL,
    buyer_name                  TEXT,
    buyer_phone                 TEXT,
    recipient_name              TEXT NOT NULL,
    recipient_email             TEXT,
    recipient_phone             TEXT,
    relationship                TEXT NOT NULL,
    design_template             TEXT NOT NULL,
    personal_message            TEXT NOT NULL,
    sender_name                 TEXT NOT NULL,
    payment_source              TEXT NOT NULL,  -- 'ONLINE','OFFLINE'
    payment_method              TEXT NOT NULL,  -- 'card','apple_pay','google_pay','bizum_direct','bank_transfer','cash'
    stripe_payment_intent_id    TEXT,
    reference_code              TEXT UNIQUE NOT NULL,
    delivery_method             TEXT NOT NULL,  -- 'whatsapp','email','download'
    scheduled_delivery_at       TIMESTAMPTZ,
    consent_immediate_delivery  BOOLEAN NOT NULL DEFAULT FALSE,
    consent_accepted_at         TIMESTAMPTZ,
    status                      TEXT NOT NULL DEFAULT 'pending',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at                TIMESTAMPTZ,
    cancelled_at                TIMESTAMPTZ,
    refunded_at                 TIMESTAMPTZ,
    expires_at                  TIMESTAMPTZ
);
```

**Purchase statuses:** `pending` → `payment_confirmed` → `refunded` | `partially_refunded` | `cancelled`

### 12.6 vouchers

```sql
CREATE TABLE vouchers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id             UUID UNIQUE NOT NULL REFERENCES purchases(id),
    merchant_id             UUID NOT NULL REFERENCES merchants(id),
    code                    TEXT UNIQUE NOT NULL,
    qr_data                 TEXT NOT NULL,
    original_amount_cents   INTEGER NOT NULL,
    balance_cents           INTEGER NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'issued',
    issued_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at            TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ NOT NULL,
    current_holder_email    TEXT,
    current_holder_phone    TEXT,
    transfer_count          INTEGER DEFAULT 0,
    pdf_url                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Voucher statuses:** `issued` → `delivered` → `partially_redeemed` → `redeemed` | `exchanged` | `expired` | `voided`

### 12.7 redemptions

```sql
CREATE TABLE redemptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id      UUID NOT NULL REFERENCES vouchers(id),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    amount_cents    INTEGER NOT NULL,
    balance_before  INTEGER NOT NULL,
    balance_after   INTEGER NOT NULL,
    redeemed_by     UUID,
    notes           TEXT,
    redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHECK constraints
ALTER TABLE redemptions ADD CONSTRAINT positive_redemption CHECK (amount_cents > 0);
ALTER TABLE redemptions ADD CONSTRAINT valid_balance CHECK (balance_after >= 0 AND balance_after < balance_before);
```

**APPEND-ONLY. No updates. No deletes.**

### 12.8 Atomic Redemption SQL

```sql
BEGIN;

SELECT id, balance_cents, status
FROM vouchers
WHERE code = 'PU-A7F3-K9P2-X8Q1'
FOR UPDATE;  -- ROW LOCK

-- Validate: status not in (redeemed, expired, voided), balance >= amount, merchant_id matches

INSERT INTO redemptions (voucher_id, merchant_id, amount_cents, balance_before, balance_after, redeemed_by)
VALUES ($voucher_id, $merchant_id, $amount, $balance, $balance - $amount, $staff_id);

UPDATE vouchers
SET balance_cents = balance_cents - $amount,
    status = CASE
        WHEN balance_cents - $amount = 0 THEN 'redeemed'
        ELSE 'partially_redeemed'
    END,
    updated_at = now();

COMMIT;
```

### 12.9 delivery_events

```sql
CREATE TABLE delivery_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id         UUID NOT NULL REFERENCES purchases(id),
    voucher_id          UUID REFERENCES vouchers(id),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),
    channel             TEXT NOT NULL,  -- 'whatsapp','email','sms','pdf_download'
    recipient_contact   TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'queued',
    provider_message_id TEXT,
    provider_response   JSONB,
    queued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    failure_reason      TEXT
);
```

### 12.10 ledger_accounts + ledger_entries

```sql
CREATE TABLE ledger_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type      TEXT NOT NULL,      -- 'platform','merchant'
    owner_id        UUID,               -- merchant_id (NULL for platform)
    account_type    TEXT NOT NULL,       -- 'revenue','payable_85','reserve_15','processing_fees','refund_loss'
    balance_cents   INTEGER NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES ledger_accounts(id),
    merchant_id     UUID,
    entry_type      TEXT NOT NULL,       -- 'credit','debit'
    amount_cents    INTEGER NOT NULL,
    running_balance INTEGER NOT NULL,
    description     TEXT NOT NULL,
    reference_type  TEXT NOT NULL,       -- 'purchase','refund','payout','fee','adjustment'
    reference_id    UUID,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IMMUTABLE
REVOKE UPDATE, DELETE ON ledger_entries FROM authenticated;
REVOKE UPDATE, DELETE ON ledger_entries FROM service_role;
```

### 12.11 audit_events

```sql
CREATE TABLE audit_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID,
    event_type      TEXT NOT NULL,
    actor_type      TEXT NOT NULL,       -- 'system','merchant','buyer','admin'
    actor_id        TEXT,
    entity_type     TEXT NOT NULL,       -- 'purchase','voucher','merchant','payout'
    entity_id       UUID NOT NULL,
    payload         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IMMUTABLE
REVOKE UPDATE, DELETE ON audit_events FROM authenticated;
REVOKE UPDATE, DELETE ON audit_events FROM service_role;
```

### 12.12 security_events

```sql
CREATE TABLE security_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      TEXT NOT NULL,
    ip_address      INET NOT NULL,
    user_agent      TEXT,
    endpoint        TEXT NOT NULL,
    merchant_id     UUID,
    email           TEXT,               -- Masked: a***@gmail.com
    details         JSONB,
    severity        TEXT NOT NULL,       -- 'info','warning','critical'
    auto_action     TEXT,               -- 'blocked','captcha','flagged','none'
    resolved        BOOLEAN DEFAULT FALSE,
    resolved_by     UUID,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 12.13 processed_webhooks + payouts

```sql
CREATE TABLE processed_webhooks (
    event_id        TEXT PRIMARY KEY,
    provider        TEXT NOT NULL,       -- 'stripe'
    event_type      TEXT NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),
    amount_cents        INTEGER NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'EUR',
    payout_type         TEXT NOT NULL,   -- '85_percent','15_percent_reserve'
    stripe_transfer_id  TEXT,
    destination_iban    TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',
    scheduled_for       TIMESTAMPTZ NOT NULL,
    initiated_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 12.14 RLS Policy Pattern

```sql
-- Applied to EVERY table with merchant_id
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_isolation ON [table_name]
    FOR ALL
    USING (merchant_id = (current_setting('app.current_merchant', TRUE))::uuid);

-- merchant_id is set from JWT in every authenticated request:
CREATE OR REPLACE FUNCTION set_current_merchant(mid UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_merchant', mid::text, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 13. State Machines & Event System

### 13.1 Purchase State Machine

| From State | To State | Trigger |
|---|---|---|
| `pending` | `payment_confirmed` | Stripe webhook OR merchant clicks "Confirm" |
| `pending` | `cancelled` | Payment failed or buyer cancels |
| `pending` | auto-expired | 48h timeout for direct payments (cron) |
| `payment_confirmed` | `refunded` | Full refund within 24h |
| `payment_confirmed` | `partially_refunded` | 15% fee refund (24h-14d) |

### 13.2 Voucher State Machine

| From State | To State | Trigger |
|---|---|---|
| `issued` | `delivered` | Delivery confirmed (provider callback or PDF download) |
| `issued` | `voided` | Purchase refunded before delivery |
| `delivered` | `partially_redeemed` | Some balance used |
| `delivered` | `redeemed` | Full balance used in one redemption |
| `delivered` | `exchanged` | Service swapped at same merchant |
| `delivered` | `expired` | Past expiry date (cron job) |
| `delivered` | `voided` | Purchase refunded |
| `partially_redeemed` | `redeemed` | Remaining balance used |
| `partially_redeemed` | `expired` | Remaining balance expired |

**Terminal states** (no further transitions): `redeemed`, `expired`, `voided`

**Invalid transitions** (MUST NEVER happen):
- `redeemed` → anything
- `expired` → `redeemed`
- `voided` → anything
- Any state → backwards

### 13.3 Event Types

| Category | Events |
|---|---|
| Purchase | `purchase.created`, `purchase.payment_confirmed`, `purchase.cancelled`, `purchase.refund_requested`, `purchase.refunded`, `purchase.partially_refunded` |
| Voucher | `voucher.issued`, `voucher.delivered`, `voucher.redeemed`, `voucher.partially_redeemed`, `voucher.exchanged`, `voucher.transferred`, `voucher.expired`, `voucher.voided`, `voucher.expiry_extended` |
| Merchant | `merchant.created`, `merchant.updated`, `merchant.stripe_connected`, `merchant.suspended`, `merchant.closed` |
| Payout | `payout.scheduled`, `payout.initiated`, `payout.completed`, `payout.failed` |
| Delivery | `delivery.queued`, `delivery.sent`, `delivery.delivered`, `delivery.failed` |

### 13.4 Background Jobs (Cron)

| Job | Frequency | What It Does |
|---|---|---|
| `delivery_scheduler` | Every 5 min | Process scheduled deliveries where date <= now() |
| `payment_expiry` | Every 30 min | Cancel unconfirmed direct payments after 48h |
| `payout_85_percent` | Daily 06:00 UTC | Release 85% payouts for purchases older than 72h |
| `payout_15_percent` | Daily 06:00 UTC | Release 15% reserve for purchases older than 14 days |
| `voucher_expiry` | Daily midnight | Expire vouchers past expiry date |
| `expiry_reminders` | Daily 09:00 | Send reminders at 90d and 30d before expiry |
| `pii_cleanup` | Weekly Sun 03:00 | Delete buyer/recipient PII 30 days after expiry/redemption |
| `webhook_cleanup` | Monthly | Delete processed_webhooks older than 30 days |

---

## 14. Security & Threat Model

ParaUsted's security model addresses **44 identified threat vectors** across 7 categories, mapped against STRIDE and OWASP Top 10:2025.

### 14.1 Threat Categories

| Category | Threats | Covered | Key Defenses |
|---|---|---|---|
| Gift Card Code Attacks | 5 | 5 | Crypto random codes, rate limit, constant-time responses, CAPTCHA |
| Payment Fraud | 8 | 8 | 3D Secure, webhook signature verification, velocity checks, self-dealing flags |
| Auth & Access Control | 7 | 7 | RLS, RBAC, MFA (admin), rate-limited login, breached password check |
| Redemption Fraud | 6 | 6 | Row locking, atomic transactions, CHECK constraints, anomaly detection |
| API & Infrastructure | 8 | 8 | CSP headers, HSTS, CORS, parameterized queries, generic errors |
| Data Protection (GDPR) | 6 | 6 | PII auto-delete, encrypted backups, log masking, consent flows |
| Messaging & Delivery | 4 | 4 | Backend-only messaging, SPF/DKIM/DMARC, rate-limited delivery |

### 14.2 Critical Security Rules

| Rule | Implementation |
|---|---|
| Never touch card data | Stripe.js handles card input. Server never sees card numbers. |
| 3D Secure on ALL cards | Stripe enforces 3DS 2.0. PSD2 requirement. Shifts fraud liability. |
| Webhook signature verification | Verify Stripe HMAC on every webhook. Reject unsigned. |
| Idempotent webhooks | `processed_webhooks` table. `event_id` dedup. Safe to receive 5x. |
| Voucher only after payment | Generated INSIDE payment confirmation handler. Never before. |
| Atomic redemption | `SELECT...FOR UPDATE` row lock + DB transaction. |
| No negative redemptions | CHECK constraint: `amount_cents > 0 AND balance_after >= 0` |
| `service_role` key: backend only | NEVER in frontend code. |
| Admin requires MFA | TOTP (Google Authenticator). Mandatory. |
| Immutable audit trail | `REVOKE UPDATE, DELETE` on audit tables. |
| Generic error messages | Client sees "Invalid or not found." Server logs full details. |
| Constant-time voucher lookup | Prevent enumeration via timing attacks. |

### 14.3 HTTP Security Headers

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' js.stripe.com; frame-src js.stripe.com; connect-src 'self' api.stripe.com *.supabase.co` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

### 14.4 Key Fraud Scenarios & Defenses

| Threat | Defense |
|---|---|
| Brute force code guessing | Crypto random 12+ char codes. 5 req/min/IP. CAPTCHA after 3 failures. |
| Stolen credit card purchases | 3D Secure mandatory. Flag >€200. Velocity checks. |
| Fake Bizum confirmation | Merchant manually verifies in Bizum app. 48h auto-expiry. |
| Webhook forgery | HMAC signature verification. Reject unsigned. |
| Double redemption | Row lock (`FOR UPDATE`). Atomic transaction. |
| Merchant self-dealing | Flag buyer_email == merchant_email. Flag >3 purchases same buyer/merchant/24h. |
| Negative redemption attack | DB CHECK constraint. Server-side validation. |

---

## 15. Rate Limiting Matrix

| Endpoint | Auth? | Per IP | Per User/Email | Per Merchant | Special Rules |
|---|---|---|---|---|---|
| `GET /merchant-page` | No | 60/min | — | — | CDN cached |
| `POST /purchases` | No | 3/10min | 5/day | 50/hour | CAPTCHA after 2 fails, flag >€200 |
| `POST /confirm-direct` | Yes | 30/min | — | 20/hour | Merchant confirms offline payment |
| `GET /vouchers/{code}` | No | 5/min | — | — | Constant-time, CAPTCHA after 3 fails |
| `POST /vouchers/redeem` | Yes | 30/min | 10/min | 30/min | 1/5sec per voucher, row lock |
| `POST /vouchers/transfer` | No | 3/hour | — | — | 2/day per voucher |
| `POST /auth/login` | No | 10/15min | 5/15min | — | Lockout 30min, email alert |
| `POST /auth/magic-link` | No | 5/hour | 3/hour | — | Single-use, 10min expiry |
| `POST /auth/reset-pwd` | No | 5/hour | 3/hour | — | Single-use, 1hour expiry |
| `POST /webhooks/stripe` | Signed | 100/min | — | — | Signature + event_id dedup |
| `POST /delivery/resend` | No | 3/hour | 3/hour | — | 3/day per voucher |
| `GET /admin/*` | MFA | 60/min | — | — | All actions logged |

---

## 16. GDPR & Legal Compliance (LOPDGDD)

### 16.1 Applicable Laws

| Law | Scope | Key for ParaUsted |
|---|---|---|
| GDPR (EU) | All personal data processing in EU | Consent, data minimization, right to erasure, breach notification |
| LOPDGDD (Spain) | Spain's GDPR supplement | Age of consent = 14, data blocking rule, digital rights |
| RDL 1/2007 (LGDCU) | Consumer protection | Expiry must be reasonable, conditions clear BEFORE purchase |
| PSD2 (EU 2015/2366) | Payment services | ParaUsted is NOT a PSP — Stripe Connect is the licensed entity |

### 16.2 Data Retention Policy

| Data | Storage | Retention | Legal Basis |
|---|---|---|---|
| Merchant profile | Cloud DB | Until account deleted + blocking period | Contract |
| Buyer email/phone | Cloud DB | Auto-delete 30d after voucher expiry/redemption | Legitimate interest |
| Recipient email/phone | Cloud DB | Auto-delete 30d after voucher expiry/redemption | Legitimate interest |
| Payment transaction ID | Cloud DB | 5 years (Spanish tax law) | Legal obligation |
| Voucher code + status | Cloud DB | 5 years after redemption/expiry | Legal obligation |
| Analytics | Cloud DB | Indefinite — ANONYMIZED | Legitimate interest |
| Audit events | Cloud DB | Indefinite — immutable | Legal obligation |

### 16.3 Compliance Checklist

1. **Data Minimization:** Collect ONLY buyer email/phone (receipt), recipient email/phone (delivery), merchant business info
2. **Explicit Consent:** Pre-ticked checkboxes are ILLEGAL. Buyer actively opts-in.
3. **Privacy Policy:** Clear, readable, with icons. States what data, why, who sees it, how long, how to delete.
4. **Right to Erasure (ARSULIPO):** Respond within 1 month. Log every request.
5. **Data Blocking (Spain-specific):** On erasure, "block" data for legal liabilities, then destroy after limitation period.
6. **Breach Notification:** Notify AEPD within 72 hours. High risk → also notify affected individuals.
7. **Records of Processing (ROPA):** Maintain internal record of all data processing activities.
8. **Cookie Consent:** Rejecting must be as easy as accepting. No dark patterns.
9. **Age of Consent = 14 in Spain:** If buyer under 14, need parental consent.
10. **Auto-delete PII:** Cron job removes buyer/recipient PII 30 days after voucher expiry/redemption.

---

## 17. Logging, Audit & Monitoring

### 17.1 Three Logging Layers

| Layer | What | Where | Retention | Mutable? |
|---|---|---|---|---|
| Audit Events | Every business action | `audit_events` table | Forever | IMMUTABLE |
| Application Logs | API requests, errors, performance (structured JSON) | Cloud logging | 90 days | Append-only |
| Security Events | Failed logins, rate limits, fraud flags | `security_events` table | 1 year | IMMUTABLE |

### 17.2 Alert Thresholds

| Severity | Trigger | Notification |
|---|---|---|
| 🔴 CRITICAL | 50+ failed voucher lookups from single IP in 1h | Immediate email + SMS |
| 🔴 CRITICAL | Webhook with invalid signature | Immediate email + SMS |
| 🔴 CRITICAL | Admin login from new IP | Immediate email + SMS |
| 🔴 CRITICAL | 10+ failed login attempts on single merchant | Immediate email + SMS |
| 🔴 CRITICAL | Stripe chargeback received | Immediate email + SMS |
| 🟡 WARNING | Merchant flagged for self-dealing | Daily digest email |
| 🟡 WARNING | Purchase >€200 auto-flagged | Daily digest email |
| 🟡 WARNING | Merchant refund rate >5% | Daily digest email |
| 🟡 WARNING | Delivery failure rate >10% | Daily digest email |
| 🟢 INFO | New merchant registered | Weekly digest |
| 🟢 INFO | PII cleanup job completed | Weekly digest |

### 17.3 Monitoring Stack

| Concern | Tool | Cost |
|---|---|---|
| Error tracking | Sentry | Free (5K errors/month) → €26/mo |
| Performance | Vercel Analytics + Speed Insights | Free → €10/mo |
| Business metrics | PostHog | Free (1M events/month) |
| Uptime | UptimeRobot | Free (5-min checks) |
| Database | Supabase Dashboard (built-in) | Included |

---

## 18. Infrastructure & Deployment

### 18.1 Cost by Phase

| Phase | Merchants | Monthly Cost | Monthly Revenue | Margin |
|---|---|---|---|---|
| MVP (0-3 months) | 10 | ~€1 | ~€50 | ~€49 |
| Growth (3-12 months) | 100 | ~€172 | ~€1,050 | ~€878 |
| Scale (12-24 months) | 1,000 | ~€632 | ~€10,500 | ~€9,868 |

### 18.2 Deployment Pipeline

1. Developer pushes code to GitHub
2. GitHub Actions: TypeScript check → ESLint → Unit tests → Integration tests → npm audit → Build
3. Vercel auto-deploys preview URL (per PR) for review
4. PR merged to `main` → Vercel auto-deploys to production (zero downtime)
5. Sentry monitors for error spikes → auto-alert
6. One-click rollback in Vercel dashboard if needed (<30 seconds)

### 18.3 Database Migrations

All schema changes go through Supabase migrations (version-controlled SQL files in git). **NEVER modify production DB directly.**

Flow: create migration → test locally (`supabase db reset`) → push to staging → verify → push to production.

### 18.4 Disaster Recovery

| Scenario | Impact | Recovery | RTO |
|---|---|---|---|
| Vercel down | Frontend unavailable | Cloudflare cached pages. Wait for Vercel. | <30 min |
| Supabase down | All dynamic features | Multi-region failover (Pro plan) | <15 min |
| Stripe down | Online payments fail | "Pay directly via Bizum" — graceful degradation | <1 hour |
| Bad deployment | Bug in production | One-click rollback in Vercel | <1 min |
| Data loss | Database corruption | Supabase daily backups (7-day retention) | <1 hour |

### 18.5 Project Structure

```
parausted/
├── .github/workflows/
│   ├── ci.yml
│   └── security-audit.yml
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── [slug]/page.tsx          # Merchant gift card page (SSR)
│   │   │   ├── v/[code]/page.tsx        # Voucher status page (SSR)
│   │   │   └── page.tsx                 # Homepage
│   │   ├── (merchant)/
│   │   │   ├── dashboard/
│   │   │   ├── gift-cards/
│   │   │   ├── payouts/
│   │   │   └── settings/
│   │   ├── (admin)/
│   │   │   ├── merchants/
│   │   │   ├── payouts/
│   │   │   └── security/
│   │   ├── api/
│   │   │   ├── purchases/
│   │   │   ├── vouchers/
│   │   │   ├── webhooks/stripe/
│   │   │   ├── delivery/
│   │   │   └── health/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── gift-card/
│   │   ├── purchase/
│   │   ├── merchant/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── stripe/
│   │   ├── delivery/
│   │   ├── security/
│   │   └── ledger/
│   ├── types/
│   └── utils/
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_merchants.sql
│   │   ├── 002_create_gift_cards.sql
│   │   ├── ...
│   │   └── 012_create_cron_jobs.sql
│   ├── seed.sql
│   └── config.toml
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## 19. Go-To-Market Strategy (Seville)

### 19.1 Launch Plan

| Step | Action | Timeline | Why |
|---|---|---|---|
| 1 | Onboard 10 barbers in Seville personally | Week 1-2 | Validate product, get feedback |
| 2 | Each barber posts "Gift a haircut" link on Instagram | Week 2-4 | Free distribution |
| 3 | "Powered by ParaUsted" footer on every gift card | Ongoing | Viral loop |
| 4 | Expand to restaurants/gyms using barber success stories | Month 2-3 | Social proof |
| 5 | Launch city discovery: "Tarjetas regalo en Sevilla" | Month 3-4 | SEO organic acquisition |
| 6 | Repeat for Madrid, Barcelona, Valencia | Month 6+ | City-by-city expansion |

### 19.2 Launch Timing

**Optimal:** 2 weeks before Día de la Madre (first Sunday of May). Built-in urgency + demand.

### 19.3 Merchant Pitch

> "ParaUsted lets your Instagram followers gift your services to their friends and family. Free to start. Takes 5 minutes to set up. Your customers pay you directly via Bizum — we just handle the beautiful gift card, delivery, and tracking. Get paid the moment your customer smiles."

---

## 20. Success Metrics & KPIs

### North Star Metric

**Gift cards redeemed per month.** This measures the complete value loop: merchant created → buyer purchased → recipient received → recipient used → merchant delivered service.

### KPI Dashboard

| KPI | Target (Month 3) | Target (Month 12) | How Measured |
|---|---|---|---|
| Active merchants | 10 | 100 | Merchants with ≥1 sale in last 30 days |
| Gift cards sold/month | 100 | 2,000 | Total confirmed purchases |
| Redemption rate | ≥60% | ≥70% | Redeemed / total vouchers |
| Average card value | €30-40 | €35-45 | Total revenue / total cards |
| Online payment share | 20% | 30%+ | Online / total purchases |
| Refund rate | <5% | <3% | Refunds / total purchases |
| Merchant churn (monthly) | <10% | <5% | 0 sales for 60+ days |
| Time to first sale | <7 days | <3 days | Signup → first sale |
| Platform revenue | €50 | €1,050 | Commission from online sales |

---

## 21. Risks & Mitigations

| Risk | Severity | Probability | Mitigation |
|---|---|---|---|
| No Bizum in platform (MVP) | High | Certain | Direct Bizum to merchant. Free tracking. |
| Merchants don't enable online payments | High | Medium | Premium features locked to online-only |
| Low redemption rate | Medium | Medium | Expiry reminders at 90d and 30d |
| Competitor copies model | Medium | Low | First-mover. Network effects. Relationships. |
| Regulatory challenge (PSD2) | High | Low | Stripe Connect = licensed PSP. No money through platform. |
| Stripe onboarding friction | Medium | Medium | Offline-first. Online optional. |
| Fraud (stolen cards, fake redemptions) | High | Low | 3D Secure, rate limiting, audit trail, row locking |
| Data breach | Critical | Low | RLS, encrypted backups, PII auto-delete, security headers |
| Single-region outage | Medium | Low | Supabase failover. Cloudflare cache. |
| WhatsApp API policy change | Medium | Low | Email fallback. PDF download always available. |

---

## 22. Roadmap

| Phase | Timeline | Focus | Key Deliverables |
|---|---|---|---|
| **V1 — MVP** | 0-8 weeks | Barbers in Seville | Gift cards, family collection, Stripe Connect, offline tracking, PDF, WhatsApp/Email, dashboard, QR redemption |
| **V1.5 — Polish** | 8-14 weeks | + Restaurants + Gyms | Custom amounts, scheduled delivery, analytics, auto-reminders, ES/EN |
| **V2 — Growth** | 14-24 weeks | + Tour operators | Time-slot discounting, loyalty, staff accounts, trust tiers, buyer history, upgrade payment, combined cards |
| **V3 — Scale** | 24-36 weeks | Multi-city + B2B | Corporate bulk, city discovery, API, multi-location, white-label, SSO/SAML |
| **V4 — Expand** | 36-52 weeks | LATAM + Enterprise | LATAM expansion, enterprise plans, advanced analytics, Bizum integration (licensed) |

---

## Appendix A: Edge Cases Master List

### Purchase Edge Cases

| # | Edge Case | Solution |
|---|---|---|
| 1 | Payment fails mid-flow | Clear error + retry. NEVER generate voucher until confirmed. |
| 2 | Double payment (clicks twice) | Idempotency key on every payment request. |
| 3 | Cash: buyer claims paid, merchant denies | Merchant must click "Confirm." No confirmation = no voucher. |
| 4 | Bank transfer arrives late | `awaiting_bank_transfer` status. 48h auto-expiry. |
| 5 | Wrong recipient email/phone | Buyer can resend within 24h if unredeemed. |
| 6 | WhatsApp delivery fails | Fallback: email → SMS. QR backup. |
| 7 | Scheduled delivery: buyer cancels | Cancel if not yet delivered. Refund policy applies. |

### Redemption Edge Cases

| # | Edge Case | Solution |
|---|---|---|
| 8 | Partial redemption | Track remaining balance. Multiple redemptions. |
| 9 | Service costs MORE than card value | Partial redemption. Recipient pays difference directly. |
| 10 | Code brute-forced | Crypto random, rate limit, CAPTCHA after 3 failures. |
| 11 | Recipient at wrong merchant | `merchant_id` validated. RLS enforces. |
| 12 | Merchant closes | Notify voucher holders. V2: transfer to another merchant. |
| 13 | Expired voucher attempt | Clear message. Merchant can extend via dashboard. |
| 14 | Price increase after purchase | Service cards: honor original. Value cards: balance is balance. |

### Financial Edge Cases

| # | Edge Case | Solution |
|---|---|---|
| 15 | VAT on gift cards | Sale NOT taxable. VAT at redemption (merchant charges). |
| 16 | Unredeemed balance accounting | Dashboard shows liability. On expiry: converts to income. |
| 17 | Platform fee on cash | No fee. Offline is FREE. |
| 18 | Chargeback after redemption | 3D Secure shifts liability. Dispute with proof. |

---

## Appendix B: Production Security Checklist

### Authentication & Access

- [ ] All endpoints require auth except public pages & purchase flow
- [ ] RLS enabled on EVERY table with `merchant_id`
- [ ] `service_role` key ONLY in backend (never frontend)
- [ ] Admin requires MFA (TOTP)
- [ ] JWT expiry: 1 hour. Refresh token rotation enabled.
- [ ] Magic Link expiry: 10 minutes. Single-use.
- [ ] Password minimum 8 chars + breached password check

### Rate Limiting

- [ ] Login: 5 attempts/15min per email
- [ ] Voucher lookup: 5/min per IP, constant-time response
- [ ] Purchase: 3/10min per IP, 5/day per email
- [ ] Redemption: 1/5sec per voucher, row lock
- [ ] Delivery resend: 3/day per voucher
- [ ] All endpoints have SOME rate limit

### Payment Security

- [ ] 3D Secure on all card payments
- [ ] Webhook signature verification active
- [ ] `processed_webhooks` dedup active
- [ ] Voucher generated ONLY after payment confirmed
- [ ] No card data touches your server

### Data Protection

- [ ] HTTPS everywhere (HSTS enabled)
- [ ] No PII in logs (masked)
- [ ] No secrets in code or git
- [ ] PII auto-delete cron active
- [ ] Encrypted backups

### Headers & Infrastructure

- [ ] CSP headers set
- [ ] `X-Frame-Options: DENY`
- [ ] CORS restricted to your domains only
- [ ] Error messages generic (no stack traces to client)
- [ ] SPF + DKIM + DMARC on email domain
- [ ] CDN/edge protection on public pages

### Dependencies

- [ ] `package-lock.json` committed
- [ ] `npm audit` clean (no critical vulnerabilities)
- [ ] Dependabot/Snyk enabled

---

## Appendix C: Cost Projections

### MVP Phase (0-3 months)

| Service | Plan | Monthly Cost |
|---|---|---|
| Supabase | Free | €0 |
| Vercel | Hobby (free) | €0 |
| Cloudflare | Free | €0 |
| Stripe Connect | Per transaction | €0 |
| Resend | Free (3K emails) | €0 |
| Meta WhatsApp | Free (1K conversations) | €0 |
| Sentry | Free (5K errors) | €0 |
| PostHog | Free (1M events) | €0 |
| Domain (parausted.es) | ~€10/year | ~€1 |
| **TOTAL** | | **~€1/month** |

### Growth Phase (3-12 months)

| Service | Plan | Monthly Cost |
|---|---|---|
| Supabase | Pro | €25 |
| Vercel | Pro | €20 |
| Cloudflare | Free | €0 |
| Resend | Pro (50K emails) | €20 |
| Meta WhatsApp | ~2K conversations | ~€80 |
| Sentry | Team | €26 |
| PostHog | Free | €0 |
| Domain | | ~€1 |
| **TOTAL** | | **~€172/month** |
| **Revenue (est.)** | 100 merchants | **~€1,050/month** |

### Scale Phase (12-24 months)

| Service | Plan | Monthly Cost |
|---|---|---|
| Supabase | Pro + Compute | €75 |
| Vercel | Pro | €20 |
| Cloudflare | Pro | €20 |
| Resend | Business | €40 |
| Meta WhatsApp | ~10K conversations | ~€400 |
| Sentry | Team | €26 |
| PostHog | Paid | ~€50 |
| Domain | | ~€1 |
| **TOTAL** | | **~€632/month** |
| **Revenue (est.)** | 1,000 merchants | **~€10,500/month** |

---

## Document Status

**Version:** 1.0
**Status:** ✅ APPROVED — All Pillars Locked
**Date:** June 2026

---

*ParaUsted — "El regalo perfecto, para quien tú quieras"*
