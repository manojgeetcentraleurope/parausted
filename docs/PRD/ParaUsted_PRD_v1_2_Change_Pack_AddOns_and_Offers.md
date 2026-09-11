# ParaUsted PRD Change Pack — Add-Ons & Offer Engine

**Version:** 1.2 Change Pack
**Date:** 2026-09-11
**Status:** Proposed updates to PRD v1.0 / v1.1
**Scope:** Physical & digital add-ons (tour-first) + promotional offer engine
**Pilot vertical:** `tour` — Seville Tours Co.
**Supersedes:** PRD v1.0 §6.2 row "Time-slot discounting"

---

## Table of Contents

1. [Why This Change Pack Exists](#1-why-this-change-pack-exists)
2. [Positioning Guardrail](#2-positioning-guardrail)
3. [Concept Model — Two Products, One Engine](#3-concept-model--two-products-one-engine)
4. [Add-Ons](#4-add-ons)
5. [Offer Engine](#5-offer-engine)
6. [Fulfilment Model](#6-fulfilment-model)
7. [Commercial Model](#7-commercial-model)
8. [Architecture Decisions](#8-architecture-decisions)
9. [Schema Impact](#9-schema-impact)
10. [Legal, Tax & Privacy](#10-legal-tax--privacy)
11. [Security Guardrails](#11-security-guardrails)
12. [Phasing & Gates](#12-phasing--gates)
13. [Success Metrics & Kill Criteria](#13-success-metrics--kill-criteria)
14. [Open Decisions](#14-open-decisions)
15. [Changes to PRD v1.0](#15-changes-to-prd-v10)

---

## 1. Why This Change Pack Exists

Two merchant needs surfaced that PRD v1.0 does not address:

1. **Merchants want to sell or gift physical items alongside the gift card.** For a tour operator this is a *souvenir*; for a salon it is a *product*. PRD v1.0 has no concept of a non-voucher item.
2. **Merchants want to drive demand into low-occupancy slots.** PRD v1.0 §6.2 lists "Time-slot discounting" as a one-line V2 feature with no specification. It is under-specified and, as worded, commercially wrong (see §5.2).

Both needs share one underlying primitive: **a rule that changes what a buyer gets or pays.** This change pack specifies that primitive once and applies it to both.

---

## 2. Positioning Guardrail

The public storefront promise is:

> **"Regala un recuerdo, no una cosa."** — *Give a memory, not a thing.*

A generic merchandise shop directly contradicts this promise and erodes the differentiator that separates ParaUsted from commodity gift-card platforms.

**Binding rule:** an add-on is never the gift. An add-on is the **physical proof of the memory** — something to unwrap before the experience, or something to keep after it. Add-ons must never be sold standalone, and must never be presented above or at equal visual weight to the gift cards.

**Approved positioning line:** *"Regala un recuerdo. Y algo para recordarlo."*

---

## 3. Concept Model — Two Products, One Engine

| | **Keepsake** (pre-experience) | **Memento** (post-experience) |
|---|---|---|
| Buyer | Buyer, at checkout | Recipient, after redemption |
| Job-to-be-done | *"I have nothing physical to hand over"* | *"That was magic, I want to keep it"* |
| Emotional peak | Unwrapping | Nostalgia |
| Tour example | Ceramic azulejo magnet with recipient name + date | Photo from the tour, printed and shipped home |
| Content required | Already captured (message, names, design) | Requires a photo pipeline |
| Ships to | Buyer's home (usually ES) | Traveller's home country |
| Phase | D2–D3 | D4+ |

Both are `addons`. They differ only in **when** they are offered and **who** pays.

---

## 4. Add-Ons

### 4.1 Naming — label layer, not entity name

`souvenir` is a tour-specific word and must not leak into the domain model. The entity is **`addons`**. The displayed noun is resolved at render time:

```text
1. merchants.addon_label_es / addon_label_en   (merchant override — wins)
2. category default                             (per vertical)
3. generic fallback                             ("Extra")
```

| Category | ES | EN |
|---|---|---|
| `tour` | Recuerdo | Souvenir |
| `barber` | Producto | Product |
| `beauty` *(new)* | Producto | Product |
| `restaurant` | Detalle | Extra |
| `gym` | Equipación | Gear |
| `school` | Material | Supplies |
| `other` | Extra | Extra |

This layer is also what makes future verticals (bakery, spa, clinic) a data change rather than a code change.

### 4.2 Curation rule

Add-ons are organised as **collections**, each holding a short list of items.

| Surface | Rule |
|---|---|
| **Production** | A merchant publishes at most **3 collections**, each with at most **6 items** |
| **D1 demo** | Deliberately over-shows — **4 collections / 10 pieces** |

The divergence is intentional and must not be read as a spec change. A fake door
exists to discover *which* items earn attention, so it shows more than we intend
to ship. **Breadth in the demo, curation in production.** A permanently large
catalogue destroys the boutique feel that makes the storefront convert — the same
reason the storefront shows exactly three gift cards. Scarcity is the luxury cue.

### 4.3 Tour starter catalogue (pilot)

Themed on the **Real Alcázar**, so the keepsakes read as the companion to the
Alcázar guided-tour gift card this merchant already sells.

| Collection | Items | Indicative price | Fulfilment |
|---|---|---|---|
| **Cerámica del Alcázar** | Azulejo magnet (personalised with name + date) | €6 | Pickup |
| | Azulejo coasters, set of 2 | €16 | Pickup |
| | Framed azulejo 15 × 15 | €24 | Pickup |
| **Mesa y café** | "Real Alcázar" mug, 350 ml | €14 | Pickup |
| | "Sevilla" insulated bottle, 500 ml | €22 | Pickup |
| **Textil** | "Real Alcázar" T-shirt, organic cotton | €24 | Pickup |
| | "Patio de las Doncellas" linen tote | €14 | Pickup |
| **Láminas y papel** | "Mi Sevilla" route print (A5) | €12 | Pickup |
| | "Patio de las Doncellas" print (A4) | €18 | Pickup |
| | Set of 4 postcards | €8 | Pickup |

Price ladder spans €6–€24 on purpose: the demo must reveal the buyer's price
ceiling, not just their taste. The free-with-purchase variant of the €6 magnet
remains the primary demo hypothesis (see §5.3).

> **Open risk — monument naming (IP).** "Real Alcázar" names a UNESCO site
> managed by the Patronato del Real Alcázar (Ayuntamiento de Sevilla).
> Descriptive souvenir use is widespread in Seville, but **official marks,
> crests and photography are not ours to use.** D1 is a non-commercial preview
> with no sale, so nothing is exposed yet. Confirm naming and imagery rights
> with the Patronato **before any paid add-on ships**. Owner: legal.

> **Imagery decision.** D1 uses merchant-supplied product mockups for the mug,
> T-shirt and ceramic keepsake. Each image shows the product in context with
> Seville landmarks, orange blossom and the merchant identity clearly visible.
> Products without a dedicated asset retain a neutral illustrated placeholder.
> Production requires approved, merchant-owned print-ready media and a final
> review of every brand lockup before publication.

### 4.4 Other verticals (post-pilot reference only)

| Category | Indicative starter items |
|---|---|
| `barber` / `beauty` | Enamel pin · metal member card · branded comb · beard-oil tin |
| `restaurant` | Recipe card set · personalised wine label · mini olive oil · apron |
| `gym` | Bottle · towel · milestone medal |
| `school` | Diploma print · notebook · tote |

---

## 5. Offer Engine

### 5.1 Three distinct mechanics — must not be built as one

| ID | Mechanic | Example | Merchant cost | Applied at |
|---|---|---|---|---|
| **M1** | Purchase discount | `SEVILLA10` → 10% off card price | **Cash** — €10 of €100 gone | Purchase |
| **M2** | Bonus value at purchase | "Buy €50, get €60" | **COGS** (~€5) | Purchase |
| **M3** | Off-peak redemption offer | "Thursday lunch: +30% value" | **COGS, on dead capacity** | Redemption |

### 5.2 Design principle — bonus value, not percentage off

M1 costs the merchant **cash**. M2 and M3 cost the merchant **cost of goods** on capacity that would otherwise go unsold. A €15 food bonus on an empty Thursday table costs roughly €5 in ingredients.

**Same perceived value to the customer. Roughly one third of the cost to the merchant. And it fills capacity instead of discounting capacity that would have sold anyway.**

**Binding rule:** ParaUsted leads with bonus value. Copy must read *"tu tarjeta vale un 30% más"*, never *"30% de descuento"*. Percentage-off discounting erodes merchant brand and trains buyers to wait for sales.

This supersedes the PRD v1.0 §6.2 "Time-slot discounting — sell discounted gift cards for off-peak hours" line, which specified the commercially inferior mechanic.

### 5.3 Free-with-purchase add-ons are promotions

A free add-on is an **M2-class promotion**, not a €0 product. It runs on the offer engine. This is why the offer engine must be built **before** paid add-ons — building it first collapses two epics into one.

Strategic value: a free add-on is a **conversion lever on the gift card**, which is the revenue-bearing product. *"Compra hoy y llévate un imán de cerámica de regalo."*

**Binding rule: "free" is never free — someone pays COGS.** Every promotional add-on must carry:

```text
price_cents  = 0          -- what the buyer pays
cost_cents   > 0          -- never derived, never hidden
funded_by    = merchant | platform
max_claims   = <hard cap, per campaign and per month>
```

Without an enforced cap, a merchant runs a promotion, it spreads, and they receive a bill they never agreed to. That is a trust-destroying defect, not a billing edge case.

### 5.4 M3 is a rules primitive, not a coupon

M3 has no code to type. It is evaluated at redemption time against:

- day of week
- time window
- date range
- blackout dates
- merchant timezone (`merchants.timezone` already exists — no new field needed)

Table: `redemption_offers`. Evaluated inside the existing atomic redemption transaction.

### 5.5 Non-negotiable offer guardrails

1. A discount applies at **purchase OR redemption — never both**
2. **No stacking** without explicit, per-merchant opt-in. M1 + M2 + M3 combined can sell €100 of value for €60
3. Every code carries **caps**: max total redemptions, max per buyer, validity window, minimum purchase
4. Codes are **per-merchant and RLS-scoped**. A barber's code must never validate at a tour operator
5. Codes are **rate-limited and non-enumerable**, held to the same standard as voucher codes. A leaked "30% off" code on a Spanish deals forum is a live incident, not a hypothetical
6. Every application writes an `audit_event` **and** a ledger entry. Promotional value is a liability and must appear on the books

---

## 6. Fulfilment Model

### 6.1 Two paths, sequenced — not launched together

| Path | Who fulfils | Platform cost | Phase |
|---|---|---|---|
| **Pickup** | Merchant hands the item over at redemption | €0 marginal | D2 |
| **Ship (POD)** | Print-on-demand partner ships to address | VAT, returns, support | D4, gated |

### 6.2 Why pickup first

- Matches real user reality: a tourist standing in Seville wants the item handed over, not posted
- **Drives footfall back to the merchant** — a directly sellable merchant benefit: *"your gift card brings them through the door twice"*
- No shipping address means no new PII class, no new retention rule, no new GDPR surface
- No change to VAT treatment — the merchant sells locally under their own VAT

### 6.3 Why shipping is not in v1

| Risk | Detail |
|---|---|
| Unclaimed stock | Pickup couples the add-on to redemption timing. Never redeemed → merchant holds stock indefinitely. Requires hold period, unclaimed policy, and an agreed cost owner |
| Double compliance | Pickup = merchant's local sale, their VAT. Ship = platform cross-border sale, OSS. Two refund flows, two support flows, from day one, for unproven demand |
| Conversion cost | Every added checkout decision costs conversion on a flow that currently converts. The add-on competes with the revenue-bearing product |
| New PII | Shipping addresses create a new retention and GDPR surface purely to serve an unvalidated path |

### 6.4 Decision — show both, build one

The buyer sees both options. Shipping renders **visible but disabled**: *"Envío a casa — Próximamente"*, with a notify-me.

This is a **zero-cost fake door** that returns the one number needed to justify or reject POD: the percentage of buyers who want shipping. Below 15% → POD is never built. Above 40% → POD is built with a business case rather than a hunch.

### 6.5 Print-on-demand partner (D4 reference)

Gelato is the leading candidate for the shipped path: local production in 32 countries, ~90% of orders produced locally, ~90% delivered within 5 days, and a documented API. Local production matters because the memento ships to the **traveller's home country**, not from Spain.

No partner commitment is made in this change pack. Partner selection is a D4 decision.

---

## 7. Commercial Model

| Type | Platform take | Rationale |
|---|---|---|
| Pickup add-on | **0%** | 5% of a €6 magnet is €0.30 — the accounting costs more than the revenue. 0% drives Stripe adoption, which is where the platform actually earns |
| Free promotional add-on | **0%** | But `cost_cents` must be surfaced so the merchant sees real spend |
| Shipped POD add-on | **Flat markup** (~€1.50–2.50/item) | Percentage takes collapse on low-value physical goods once Stripe's €0.25 + 1.5% is applied |

**Binding framing:** add-ons are **not a revenue line in v1**. They are a conversion and retention lever for the gift card. Monetising them early prices them out of existence.

---

## 8. Architecture Decisions

### 8.1 No separate SaaS — modular monolith

Add-ons and offers ship **inside ParaUsted**, as `src/lib/addons/` and `src/lib/offers/`, with fulfilment behind an adapter interface (`PickupFulfilmentAdapter`, `PodFulfilmentAdapter`).

Rationale:

1. The add-on's entire value derives from **gift context** — recipient name, message, date, merchant brand, tour photos. A separate system either loses that context or must synchronise it, building a distributed system to solve a problem that does not currently exist
2. Pre-PMF, splitting duplicates auth, billing, tenancy, RLS, deploys and on-call
3. A split **creates** the hardest problem in the feature: a distributed transaction between "payment confirmed" and "order the physical item"

If add-ons later justify independence, a clean module boundary makes extraction a refactor rather than a rewrite.

### 8.2 Legal separation ≠ codebase separation

For shipped goods ParaUsted becomes **seller of record** (VAT, returns, consumer liability). This may require separate terms and possibly a separate legal entity. That is a legal structure decision and must **not** drive the software architecture.

### 8.3 "Another app" — three different things

| Interpretation | Verdict |
|---|---|
| Separate SaaS | **No** — §8.1 |
| Separate worker/process | **Yes, eventually** — POD dispatch, retries, media processing. Same repository, background worker |
| Separate thin client | **Possibly** — a PWA for the guide in the field to upload tour photos. Thin client against the same API, not a new product. Prerequisite for the Memento |

One backend, one tenant model, optionally a second thin client.

### 8.4 Add-on fulfilment must never block voucher issuance

If add-on fulfilment fails, **the voucher still issues.** Fulfilment is decoupled, idempotent and independently retried. This preserves the existing operational-safety rule that retries must not produce duplicate vouchers, deliveries, payouts or ledger entries.

---

## 9. Schema Impact

### 9.1 Verified findings

| Finding | Impact |
|---|---|
| `vouchers.original_amount_cents` has **no constraint tying it to `purchases.amount_cents`**. The only rule is `balance_cents <= original_amount_cents` | **M2 and M3 bonus value are already representable.** "Pay €50, receive a €60 voucher" needs no schema rewrite |
| `merchants.category` is a hard `CHECK` over `('barber','restaurant','tour','gym','school','other')` | `beauty` requires a small migration |
| No promo/coupon/discount concept exists anywhere in `src/` | Greenfield — no legacy to unpick |
| `vouchers` public read was already hardened (`20260612120000`) | No additional exposure from offer codes reading voucher state |

### 9.2 Required additions

| Object | Purpose |
|---|---|
| `merchants.addon_label_es` / `addon_label_en` | Merchant label override (§4.1) |
| `merchants.category` → add `beauty` | New vertical. **Add**, do not rename `barber` — renaming breaks seeded rows, slugs, and three lookup maps (`CATEGORY_LABEL`, `CATEGORY_COVER`, `GIFT_PRESENTATIONS`) for no gain |
| `addons` | Merchant add-on catalogue. `price_cents`, `cost_cents`, `funded_by`, `active`, `sort_order`, RLS tenant-scoped |
| `addon_order_items` | What was bought/claimed, per purchase |
| `addon_fulfilments` | Fulfilment state machine, adapter-agnostic |
| `promo_codes` | M1/M2 codes. Caps, window, per-merchant, RLS |
| `redemption_offers` | M3 rules primitive (§5.4) |
| `vouchers.bonus_amount_cents` | **Explicit, never derived.** Separates funded value from promotional value for ledger and audit |

### 9.3 Invariants

- All monetary values in **integer cents**
- `addons`, `promo_codes`, `redemption_offers` are merchant-owned → **RLS tenant isolation mandatory**
- `merchant_id` always from the authenticated session, never from request input
- Add-on and offer state changes write `audit_events`
- Promotional value writes `ledger_entries` — append-only

---

## 10. Legal, Tax & Privacy

### 10.1 Bonus value refund rule — binding

Scenario: buyer pays €50, receives a €60 voucher, recipient redeems €55, buyer requests a refund.

**Rule: refunds are capped at cash actually paid, pro-rated against funded value only. Bonus value is never refundable in cash.**

This must appear in the T&Cs **and** be enforced in code. Without it, the bonus mechanic is an open arbitrage hole.

### 10.2 VAT

| Path | Treatment |
|---|---|
| Gift card (multi-purpose voucher) | VAT at redemption — unchanged |
| Pickup add-on | Merchant's own local sale, merchant's VAT — **no platform change** |
| Shipped POD add-on | Platform sale, VAT at sale (21% ES standard), cross-border via OSS — **requires tax sign-off before D4** |

A single Stripe payment intent carrying both voucher and physical goods requires line-item tax handling. This is a D4 blocker, not a D2 concern — which is a further reason pickup ships first.

### 10.3 Right of withdrawal

Personalised goods are exempt from the 14-day right of withdrawal under LGDCU art. 103.c. The exemption requires **explicit buyer acknowledgement at checkout**. Reuse the existing `consent_immediate_delivery` pattern rather than inventing a second consent mechanism.

### 10.4 Privacy

- Pickup path collects **no address** — this is a deliberate privacy-by-design choice, not an omission
- Shipping addresses (D4) are a new PII class requiring their own retention rule, RLS policy and log masking
- Tour photos (Memento, D4+) are personal data and require an explicit consent and retention model before any pipeline is built

---

## 11. Security Guardrails

1. Promo codes generated with `crypto.randomBytes()` — never sequential, never `Math.random()`
2. Promo code validation is **rate-limited per IP, per buyer and per merchant**
3. Failed promo-code attempts write `security_events`
4. Generic client errors only — never "code exists" vs "code not found" (prevents enumeration)
5. Promo code caps enforced **inside the database transaction** with row locking, matching the existing atomic-redemption pattern. Cap checks outside the transaction are a race condition
6. `funded_by` and `cost_cents` are server-derived only — never accepted from client input
7. Add-on selection never changes voucher value. Only the offer engine may change voucher value, and only via audited paths

---

## 12. Phasing & Gates

| Phase | Scope | Gate to proceed |
|---|---|---|
| **D1** | Fake-door demo, tour-only, UI-only, flag-gated. No schema change, no persistence, no PII | Qualitative merchant + buyer feedback |
| **D2** | Offer engine (M1 + M3) + free pickup add-on, tour pilot | Offer engine live and audited |
| **D3** | Paid pickup catalogue, second vertical (`restaurant` for M3) | Attach rate ≥15%; gift-card conversion not depressed |
| **D4** | POD shipping, seller-of-record, tax sign-off | Ship-intent ≥40% from D1/D2 data **and** tax/legal sign-off |
| **D5** | Memento (post-experience photo pipeline), guide thin client | D4 proven |

**Sequencing note:** the offer engine (D2) precedes paid add-ons (D3) because a free add-on *is* a promotion. Building the engine first collapses two epics into one.

---

## 13. Success Metrics & Kill Criteria

| Metric | Target | Phase |
|---|---|---|
| Add-on attach rate | ≥15% | D2–D3 |
| Ship-intent share (fake door) | Measure only; ≥40% unlocks D4 | D1–D2 |
| Off-peak redemption shift (M3) | ≥10% of redemptions move into target slots | D3 |
| Merchant activation of an offer | ≥3 of 5 pilot merchants create one unaided | D2 |

### Kill criterion — agreed in advance

> **If add-ons depress gift-card conversion, the feature is killed.**

The gift card is the revenue-bearing product. An add-on that increases average order value while reducing purchase completion is a net loss. This must be measured against a control, not assumed.

---

## 14. Open Decisions

| # | Decision | Owner | Recommendation |
|---|---|---|---|
| 1 | Confirm sequencing: offer engine before paid add-ons | PO | Accept |
| 2 | Bonus-value refund ceiling (§10.1) | PO + Legal | Accept as written |
| 3 | Who funds free add-ons — merchant, platform, or per-campaign | PO | Per-campaign, merchant default |
| 4 | Add `beauty` as a seventh category | PO | Yes; add, do not rename |
| 5 | Pilot pair — Seville Tours Co. + one restaurant | PM | Restaurant matters more than tour for M3 |
| 6 | POD partner selection | Architect | Defer to D4 |

---

## 15. Changes to PRD v1.0

| PRD location | Change |
|---|---|
| §6.2 V2 Features | Row "Time-slot discounting" **superseded** by Offer Engine (§5). Mechanic changed from percentage-off to bonus-value |
| §6.2 V2 Features | Add row: "Add-ons (souvenirs/products)" |
| §6.2 V2 Features | Add row: "Offer engine (promo codes + off-peak offers)" |
| §12.1 Table Overview | Add `addons`, `addon_order_items`, `addon_fulfilments`, `promo_codes`, `redemption_offers` |
| §12.3 merchants | Add `addon_label_es`, `addon_label_en`; extend `category` CHECK with `beauty` |
| §12.6 vouchers | Add `bonus_amount_cents` |
| §22 Roadmap | V2 focus updated to include add-ons and offer engine |

---

*ParaUsted — "Regala un recuerdo. Y algo para recordarlo."*
