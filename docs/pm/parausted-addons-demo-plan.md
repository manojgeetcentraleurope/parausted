# ParaUsted — Add-Ons Demo Plan (D1)

**Version:** 1.0
**Date:** 2026-09-11
**Owner:** PO
**Spec:** [PRD v1.2 Change Pack](../PRD/ParaUsted_PRD_v1_2_Change_Pack_AddOns_and_Offers.md)
**Pilot merchant:** Seville Tours Co. — `/es/m/seville-tours-co`
**Phase:** D1 only. D2+ is out of scope for this plan.

---

## 1. Purpose

Validate demand for merchant add-ons **before** building the offer engine, a schema, or a fulfilment pipeline.

D1 answers exactly four questions:

| # | Question | How it is answered |
|---|---|---|
| Q1 | Do buyers want a physical keepsake alongside a gift card at all? | Moderated buyer sessions on the live page |
| Q2 | Do they want it **handed over** or **shipped**? | Fake-door choice, observed |
| Q3 | What does each vertical **call** it? | Moderated merchant sessions — asked, not guessed |
| Q4 | Which **collection and price point** earns attention? | Observed on a deliberately broad €6–€24 catalogue |

Q3 is the decision the PRD explicitly defers to evidence (change pack §4.1). A salon owner tells us her word for it; we do not invent one.

Q4 is why the demo shows 10 pieces when production will curate to far fewer: we cannot learn the buyer's ceiling from a catalogue that has no range.

---

## 2. Scope — what ships today

### In scope

- One add-on showcase block on the existing merchant storefront (`/[locale]/m/[slug]`)
- **Tour category only** — renders for `category === 'tour'`, nothing else
- **Feature-flagged off by default.** Invisible in production unless explicitly enabled
- **4 collections / 10 curated tour pieces** from a **static, in-repo catalogue**, themed on the Real Alcázar (change pack §4.3)
- Fulfilment choice UI: **Pickup** selectable, **Ship** visible but disabled with *"Envío a casa — Próximamente"*
- Bilingual ES/EN via the existing dictionary pattern
- Server component, no client JS beyond what the page already ships

### Explicitly out of scope

| Excluded | Why |
|---|---|
| Database migration | D1 must carry zero schema risk |
| Persistence of any kind | No new tables, no writes |
| Taking payment for add-ons | Never charge for something that does not exist |
| Shipping address collection | No new PII class in a throwaway phase |
| Changes to the purchase flow | The revenue-bearing flow is not touched |
| Changes to voucher, ledger or redemption logic | Untouched |
| Offer engine / promo codes | D2 |
| POD integration | D4, gated |
| Other categories | Post-pilot |

**D1 is presentation-only. It cannot affect money, vouchers, tenancy or PII.** That property is what makes it safe to ship the same day.

---

## 3. Why a fake door instead of a prototype

A clickable mock in a design tool gets polite feedback. The live page gets real reaction — real branding, real prices, real context, next to real gift cards.

**Ethical boundaries — non-negotiable:**

1. No money is taken for any add-on
2. The disabled shipping option is labelled *"Próximamente"* — never presented as available
3. No buyer is told an add-on will arrive
4. The flag is off in production except during a moderated session

---

## 4. Acceptance criteria

| # | Criterion |
|---|---|
| AC1 | With the flag disabled, `/es/m/seville-tours-co` is byte-for-byte unchanged |
| AC2 | With the flag enabled, the add-on block renders **below** the gift card collection, at lower visual weight (change pack §2) |
| AC3 | Block renders only when merchant `category === 'tour'` |
| AC4 | Section heading uses the category label — "Recuerdo" (ES) / "Souvenir" (EN) |
| AC5 | **4 collections / 10 pieces** render, grouped by collection, prices formatted in € from integer cents |
| AC6 | Pickup is pre-selected; shipping is visibly disabled with "Próximamente" |
| AC7 | No network request, no write, no cookie, no localStorage is added |
| AC8 | `npx tsc --noEmit` and `npm run lint` both pass |
| AC9 | ES and EN both render correctly; no hardcoded user-facing strings |
| AC10 | Lighthouse/SEO metadata for the page is unchanged |
| AC11 | On mobile, collections use horizontal snap rows, the next item remains partially visible as a swipe cue, and the document has no horizontal overflow |
| AC12 | Every piece identifies the merchant edition; branded mug and T-shirt copy explicitly includes the tour operator brand |

---

## 5. Session protocol

### 5.1 Merchant panel (B2B) — 5 merchants, ≥3 categories

Required mix: 1 tour, 1 restaurant, 1 salon/barber, 2 free choice.

| Step | Prompt |
|---|---|
| 1 | Show the storefront **without** the block. "What's missing, if anything?" |
| 2 | Enable the flag. Say nothing. Observe the unprompted reaction |
| 3 | **"What would you call this on your page?"** — record the exact word. This is the Q3 answer |
| 4 | "Would you hand this over, or post it?" |
| 5 | "Would you give one away free with a gift card purchase? Who should pay for it?" |
| 6 | "What would you rather have: this, or a way to fill your quiet Thursdays?" |

Step 6 is the priority test between add-ons and the offer engine. Record it verbatim.

### 5.2 Buyer panel (B2C) — 20–30 buyers

**Observed, not interviewed.** Stated preference is unreliable; behaviour is not.

Record per session: did they notice the block unprompted · did they click an add-on · pickup or ship · did the block change their gift-card decision.

Capture for D1 is **manual** — a shared tally sheet. No instrumentation, because instrumentation implies persistence, and persistence implies a migration.

---

## 6. Metrics & decision rules

| Signal | Threshold | Consequence |
|---|---|---|
| Unprompted buyer interest | ≥40% notice it | Proceed to D2 |
| Ship-intent share | ≥40% | Unlocks D4 business case |
| Ship-intent share | <15% | POD is never built. Pickup-only permanently |
| Merchant naming consensus | ≥3 distinct words across verticals | Confirms the label layer (change pack §4.1) is required |
| Merchant priority (step 6) | Majority choose "quiet Thursdays" | **Offer engine is promoted ahead of paid add-ons** |

### Kill criterion

> If the block visibly distracts from or reduces gift-card purchase intent in buyer sessions, D1 stops here and the feature is shelved.

The gift card is the revenue-bearing product. Average order value gained at the cost of purchase completion is a net loss.

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Flag accidentally enabled in production | Medium | Default off; server-side flag; assert in AC1 |
| Block cannibalises gift-card attention | **High** | Placed below collection, lower visual weight; kill criterion §6 |
| Merchant reads the demo as a commitment | Medium | Open every session with "this is a test, nothing is built" |
| Team treats the static catalogue as the real model | Medium | Catalogue is in-repo and clearly marked demo-only; the real model is change pack §9 |
| Scope creep into D2 during the demo build | **High** | Out-of-scope table §2 is binding |

---

## 8. Validation

```powershell
npx tsc --noEmit
npm run lint
```

Manual verification with the flag **disabled**:

```text
/es/m/seville-tours-co      -> renders exactly as before, no add-on block
/en/m/seville-tours-co      -> renders exactly as before
```

Manual verification with the flag **enabled**:

```text
/es/m/seville-tours-co      -> add-on block below gift cards, heading "Recuerdo"
/en/m/seville-tours-co      -> add-on block below gift cards, heading "Souvenir"
/es/m/<non-tour-merchant>   -> no add-on block
```

Regression check — must be unaffected:

```text
/ -> /es
/es/dashboard unauthenticated -> /es/login?next=/es/dashboard
/api/health not redirected
purchase flow unchanged end to end
```

---

## 9. Rollback

Set the flag to disabled. No migration, no data, no payment path — nothing to reverse.

If the code itself must be removed, the change is confined to the add-on module and one render slot in the storefront page.

---

## 10. Exit criteria → D2

D1 is complete when all are true:

1. 5 merchant sessions and ≥20 buyer sessions recorded
2. Q1, Q2, Q3 answered with evidence
3. Naming decision made per category, with the merchant-override tier confirmed or dropped
4. Priority between add-ons and offer engine settled by §5.1 step 6
5. Open decisions 1–5 in change pack §14 closed

**Expected outcome, stated in advance so we can be wrong on the record:** merchants will prioritise filling quiet days over selling souvenirs, and the offer engine will be promoted ahead of paid add-ons. D1 exists to test that prediction cheaply.
