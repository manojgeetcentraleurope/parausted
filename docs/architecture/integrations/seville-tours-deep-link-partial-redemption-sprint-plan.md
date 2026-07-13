# Sprint Plan — Seville Tours Deep Links & Partial Redemption

**Project:** ParaUsted
**Companion doc:** `seville-tours-deep-link-partial-redemption-gap-and-plan.md`
**Authors:** PM / PO / Architect
**Date:** 2026-06-17
**Sprint length:** 2 weeks (10 working days)
**Status:** PROPOSED

---

## 1. Sprint Goal

> Enable Seville Tours to (a) deep-link buyers to a specific gift card with safe prefill and a
> return-to-brand flow, and (b) redeem vouchers partially while preserving remaining balance —
> both shipped backward-compatibly, fully audited, and security-reviewed.

**Demo at sprint end:** A buyer clicks a Seville Tours deep link → lands on the ParaUsted product
page with amount prefilled → buys → is offered a "Return to Seville Tours" link. Separately, a
merchant redeems €40 of a €100 voucher in the dashboard; balance shows €60 and status is
`partially_redeemed`; a second redemption of €60 sets status `redeemed`.

---

## 2. Scope

### In Scope
- Partial redemption RPC + server action + dashboard UI (ParaUsted)
- Deep-link query param contract with Zod validation + amount clamping (ParaUsted)
- `return_url` allowlist + post-purchase return CTA (ParaUsted)
- Deep-link builder + return landing page (Seville Tours brand site)
- Tests + manual round-trip QA

### Out of Scope (tracked separately)
- Merchant new-purchase notifications
- Invoice/factura generation
- External/partner machine-to-machine redeem API (Phase 2)
- Multi-currency / short product slugs

---

## 3. Workstreams & Stories

### Workstream 1 — Partial Redemption (ParaUsted) — `feat/voucher-partial-redemption`

| ID | Story | Est (pts) | Acceptance Criteria |
|----|-------|-----------|---------------------|
| PR-1 | Migration: `redeem_voucher_partial(code, amount_cents, notes, idempotency_key)` RPC | 5 | Auth + tenant scope from `auth.uid()`; `FOR UPDATE`; reject terminal/expired; enforce `amount<=balance`; CAS on `balance_cents`; insert `redemptions` + `audit_events`; `status='partially_redeemed'` when remainder>0 else `redeemed`; `REVOKE anon / GRANT authenticated`. |
| PR-2 | Server action `redeemVoucherPartial(code, amountCents, notes?)` | 3 | Reuses rate-limit + security-event pattern; deny-by-default on no session; maps RPC errors to safe generic results. |
| PR-3 | Dashboard UI: amount input + remaining balance + partial/full states | 5 | Amount field (EUR→cents), client validation, shows balance before/after, full-redeem still works, accessible labels + loading/disabled states. |
| PR-4 | Tests (Vitest) for RPC + action | 3 | Happy partial, exhaust-to-redeemed, over-balance reject, terminal-state reject, double-spend/concurrency (CAS), auth failure. |

**WS1 total: 16 pts**

### Workstream 2 — Deep-Link Param Contract (ParaUsted) — `feat/deep-link-prefill`

| ID | Story | Est (pts) | Acceptance Criteria |
|----|-------|-----------|---------------------|
| DL-1 | Zod `deepLinkParamsSchema` (drop-invalid, no PII) | 3 | Optional `amount`, `recipient_name`, `sender_name`, `message`, `return_url`, `utm_*`; rejects/ignores PII params; never throws on bad input. |
| DL-2 | Product page parse + prefill + amount clamp | 5 | `amount` clamped to `[min,max]`, ignored for `fixed_value`; fields prefilled; invalid params silently dropped; SEO/canonical unaffected. |
| DL-3 | `getSafeExternalReturnUrl` + env allowlist `PARAUSTED_RETURN_URL_ALLOWLIST` | 5 | Requires https, host allowlist match, strips credentials/fragments, rejects all non-listed hosts (open-redirect safe). |
| DL-4 | Persist `return_url`/`utm_*` through purchase metadata | 3 | Survives Stripe + offline confirm paths; never stored as PII. |
| DL-5 | Tests (Vitest) | 3 | Clamping, invalid-drop, PII rejection, allowlist accept/reject, fixed-card amount ignore. |

**WS2 total: 19 pts**

### Workstream 3 — Return-to-Brand (ParaUsted) — `feat/return-to-brand`

| ID | Story | Est (pts) | Acceptance Criteria |
|----|-------|-----------|---------------------|
| RB-1 | Post-purchase "Return to Seville Tours" CTA (default) | 3 | Shown only when a safe `return_url` exists; no PII appended; voucher code excluded by default. |
| RB-2 | Tests | 2 | Only allowlisted hosts produce a CTA; no PII leakage. |

**WS3 total: 5 pts**

### Workstream 4 — Seville Tours Brand Site — `feat/parausted-deep-links` (separate repo)

| ID | Story | Est (pts) | Acceptance Criteria |
|----|-------|-----------|---------------------|
| ST-1 | SKU UUID config + deep-link builder utility | 3 | 3 SKUs as typed constants; builder composes locale + amount + return_url. |
| ST-2 | Update gift CTAs to deep links | 2 | Fixed/flex/luxury CTAs point to correct product URLs with optional prefill. |
| ST-3 | `/gift/thanks` return landing page | 3 | Reads only non-PII params; friendly confirmation; optional voucher link. |
| ST-4 | Staging round-trip QA | 2 | Full click→buy→return verified in staging. |

**WS4 total: 10 pts**

**Sprint total: ~50 pts** (adjust to team velocity; WS4 is the brand-site team's load).

---

## 4. Day-by-Day Schedule (2 weeks)

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1 | Kickoff, finalize param contract + allowlist decision (R1–R3) | Signed-off contract; env var naming |
| 2 | PR-1 RPC migration | RPC drafted, applied to local/staging |
| 3 | PR-1 hardening + PR-4 tests start | Concurrency/CAS tests green |
| 4 | PR-2 server action + PR-3 UI start | Partial redeem callable end-to-end |
| 5 | PR-3 UI finish + WS1 review | **Milestone M1: Partial redemption demo-ready** |
| 6 | DL-1 schema + DL-3 allowlist helper | Validated parsing + safe return_url |
| 7 | DL-2 prefill + clamp | Product page prefilled from deep link |
| 8 | DL-4 metadata persistence + RB-1 return CTA | Round-trip wiring (ParaUsted side) |
| 9 | DL-5 / RB-2 tests + WS4 integration (brand site) | **Milestone M2: Deep-link round trip in staging** |
| 10 | Hardening, security review, QA sign-off, docs | `tsc`/lint green; demo; retro |

---

## 5. Milestones & Gates

| Milestone | Day | Exit Criteria |
|-----------|-----|---------------|
| M1 — Partial Redemption | 5 | RPC + action + UI working; concurrency-safe; tests green |
| M2 — Deep-Link Round Trip | 9 | Prefill + allowlisted return_url + brand landing verified in staging |
| M3 — Sprint Done | 10 | All AC met; `npx tsc --noEmit` + `npm run lint` pass; security review signed; manual QA checklist complete |

---

## 6. Validation Commands (per AGENTS.md)

```powershell
npx tsc --noEmit
npm run lint
supabase db push   # for the partial-redemption migration
```

Manual checks:
```text
Deep link with amount → product page shows clamped amount
Deep link with PII params → params ignored
return_url=https://sevilletours.com/... → return CTA shown
return_url=https://evil.com/... → rejected, no CTA
Partial redeem €40 of €100 → balance €60, status partially_redeemed
Second redeem €60 → balance €0, status redeemed
Over-balance redeem → rejected, no ledger row
```

---

## 7. Security Review Checklist (gate for M3)
- [ ] `return_url` allowlist enforced; arbitrary hosts rejected (OWASP A01/A10).
- [ ] No PII accepted via inbound URL params.
- [ ] `merchant_id` derived from `auth.uid()` in partial RPC (never client).
- [ ] Partial redeem is `FOR UPDATE` + CAS guarded (no double-spend).
- [ ] `redemptions` remains append-only; audit event written per redemption.
- [ ] Rate limiting on partial-redeem action; security events on abuse.
- [ ] No voucher code / PII in logs or return URLs by default.

---

## 8. Dependencies & Risks

| Item | Type | Mitigation / Owner |
|------|------|--------------------|
| Brand-site team availability (WS4) | Dependency | Confirm at kickoff; WS1–WS3 can ship independently |
| Allowlist host list | Decision | PO provides Seville Tours domains by Day 1 |
| Voucher-code-in-return-url decision | Decision | PO sign-off by Day 1 (default: no) |
| Stripe + offline confirm both carry metadata | Risk | DL-4 covers both paths; test each |
| Scope creep (notifications/invoicing) | Risk | Explicitly out of scope; separate backlog |

---

## 9. Backlog (Post-Sprint / Phase 2)
- Partner machine-to-machine "validate balance / redeem" API (scoped token) for POS.
- Merchant new-purchase notification (email/webhook).
- Invoice/factura generation with sequential, race-safe numbering.
- Short, human-friendly product slugs for marketing URLs.
- Multi-currency support (currency column on vouchers).
