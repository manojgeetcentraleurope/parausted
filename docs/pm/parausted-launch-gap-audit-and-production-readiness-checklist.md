# ParaUsted V1 — Launch Gap Audit & Production Readiness Checklist (Slice 8b.7)

**Project:** ParaUsted
**Area:** MVP Delivery / Launch Governance / Production Readiness
**Date:** 2026-06-16
**Recommended repo path:** `docs/pm/parausted-launch-gap-audit-and-production-readiness-checklist.md`
**Baseline commit:** `51d011d docs(integration): record Seville Tours hosted gift flow handoff`
**Working tree at audit time:** clean (before adding audit documents)
**Mode:** Audit only — no code, SQL, file edits to source, package changes, or commits produced.

---

## 0. Source Reconciliation & Repo-Governance Note

This audit is the official Slice 8b.7 output. It reconciles the Opus 4.8 launch-gap audit with the now-canonical PM status document and the payment/integration handoffs.

Primary sources:

```text
docs/pm/parausted-mvp-sprint-status-and-future-plan.md
docs/architecture/integrations/seville-tours-parausted-hosted-gift-flow-handoff.md
docs/architecture/payment/stripe-refund-external-reconciliation-8b6-handoff.md
docs/architecture/payment/platform-alerting-refund-conflicts-8b6g-handoff.md
docs/operations/payment/refund-conflict-support-runbook.md
docs/operations/payment/offline-direct-payment-operations-runbook.md
docs/pm/ParaUsted_Revised_MVP_Sprint_Plan_8_Weeks.md
docs/PRD/ParaUsted_Gold_Class_PRD.md
```

**Repo-governance note (canonical status map):**
The PM status document is now present in the repository at `docs/pm/parausted-mvp-sprint-status-and-future-plan.md` and should be treated as the **canonical current-state map** for ParaUsted V1. This audit document is the launch-gate companion: the PM doc says *where we are*, this audit says *what blocks launch and in what order to close it*. When the two differ in future, the PM status doc is the source of truth for completion status and this audit is regenerated from it.

> The earlier audit note stating that the PM status document was "missing from the repo" no longer applies and has been removed — the document has been added.

---

## 1. Executive Summary

The **core transactional spine of ParaUsted V1 is functionally complete and architecturally sound**, and in payment-safety areas it is **ahead of the original 8-week plan**. The full gift-card lifecycle works end-to-end:

```text
merchant onboarding
→ bilingual gift-card setup
→ public merchant/gift-card page
→ buyer pending purchase
→ payment confirmation
→ voucher issuance only after confirmation
→ public voucher page
→ full redemption
```

Both payment rails (offline/direct and Stripe Connect) converge on a single voucher lifecycle, exactly as the locked product principles require. The Stripe path is hardened, external refund reconciliation is implemented and **sandbox-validated**, platform alerting is wired and **dry-run-validated**, the offline/direct path is implemented and **documented via runbook**, and the Seville Tours hosted-link integration is **locked and manually validated**.

The gaps are **not in the domain core** — they are in the **launch perimeter**: the operational, legal, and production-hardening layer that turns a working application into a publicly launchable one. Specifically, several items scheduled for Weeks 7–8 are **not yet present in code or not yet verified**: production security headers (CSP/HSTS/X-Frame-Options), enforced rate limiting on public endpoints, a `/api/health` endpoint, `sitemap.ts`/`robots.ts`, a cookie-consent surface, **real-email (Resend-mode) validation** for both gift-card delivery and platform alerts, a clean `npm run build` gate, and production deployment/monitoring. Legal coverage exists only as a **single combined pilot page** (`/[locale]/legal`), not the separate Terms/Privacy/refund/cookie surfaces the plan and PRD anticipate.

**Bottom line:** The product is **demo-ready and pilot-capable** for a controlled, hand-held first-merchant pilot (Seville Tours), but it is **not yet a clean public production launch**. The remaining work is well-scoped, low-risk, and slice-shaped. Recommendation: **CONDITIONAL GO** for a guarded pilot, **NO-GO** for unguarded public launch until the critical perimeter items close.

---

## 2. Launch Readiness Matrix

| # | Domain | Status | Evidence / Rationale |
|---|--------|--------|----------------------|
| 1 | **Legal / public policy** | **PARTIAL** | Combined bilingual pilot legal page exists at `src/app/[locale]/legal/page.tsx` covering issuance, validity, refunds, official-source, privacy. **Missing:** separate `/terminos` + `/privacidad` routes, cookie-consent banner, refund policy explicitly surfaced *before* payment, footer links. Legal docs remain outlines only in `docs/legal/`. |
| 2 | **Security hardening** | **PARTIAL** | Strong tenant/RLS, append-only ledger, voucher-after-payment, signature-verified idempotent webhooks, PII/voucher masking discipline, safe redirect handling in `src/proxy.ts`. **Missing in code:** security headers (CSP/HSTS/X-Frame-Options), enforced rate limiting on public purchase/voucher/redemption endpoints — both exist only in PRD/plan docs. |
| 3 | **SEO / mobile / public UX** | **PARTIAL** | Locale routing, canonical + hreflang helpers (`src/lib/seo/metadata.ts`), self-canonical localized pages, server-generated metadata. **Missing:** `sitemap.ts`, `robots.ts`, LocalBusiness JSON-LD on merchant pages, OG-tag verification, explicit mobile-device smoke pass. |
| 4 | **Direct / offline payment** | **PASS** *(operational caveat)* | Full pending → confirm → issue → refund/void flow implemented; redeemed-voucher safety preserved; comprehensive runbook at `docs/operations/payment/offline-direct-payment-operations-runbook.md`. **Caveat:** evidence/reference fields are operational discipline, not yet schema-enforced. |
| 5 | **Stripe payment & refund** | **PASS (sandbox)** | Stripe Connect purchase + webhook issuance hardened; external refund reconciliation RPC live; happy-path and after-redemption-conflict paths sandbox-validated; fraud-flag dedup hardened. **Not yet:** live-mode keys/switch, live-mode end-to-end. `charge.refunded` intentionally deferred. |
| 6 | **Platform alerting** | **PARTIAL** | Full pipeline built: `platform_alerts` queue, worker RPCs, enqueue scanner, separate AdminAlertMailer, processing route; **dry-run validated** incl. idempotency. **Deferred:** Resend-mode real-email validation, production cron scheduling. |
| 7 | **Delivery / email** | **PARTIAL** | Delivery orchestrator + worker + Resend provider with real-recipient guardrail at `src/lib/delivery/providers/resend-email-provider.ts`; dry-run path works. **Deferred:** real Resend-mode delivery validation; SPF/DKIM/DMARC + sender-domain verification not confirmed. |
| 8 | **E2E / manual smoke** | **PARTIAL** | Manual validation captured for refund reconciliation, alerting dry-run, and Seville Tours. **Missing:** consolidated full-lifecycle E2E (offline + Stripe) green run, automated suite execution evidence, mobile-browser pass. |
| 9 | **Production environment** | **PENDING** | **Missing:** `/api/health` endpoint, clean `npm run build`, Stripe live-mode switch, production Supabase verification, DNS/SSL cutover, Sentry, uptime monitoring, cron/scheduler wiring (delivery, alerts, expiry, reminders), `processed_webhooks` cleanup job, PII retention/cleanup job. |
| 10 | **Pilot merchant readiness** | **PARTIAL** | Seville Tours merchant active, branded, 3 active cards (fixed/flexible/luxury), slug `seville-tours-co` canonical. **Missing:** real delivery email proven, production URLs live, merchant-facing confirmation walkthrough rehearsed against production. |
| 11 | **Seville Tours integration** | **PASS** | Hosted-link boundary locked and manually validated in both repos; no cross-app data leakage; correct architectural boundary (acquisition vs. transaction source-of-truth). See `docs/architecture/integrations/seville-tours-parausted-hosted-gift-flow-handoff.md`. |

**Status legend:** PASS = ready · PARTIAL = exists but incomplete · PENDING = not started, not blocked · BLOCKED = cannot proceed without external dependency · DEFERRED = intentionally out of V1 scope.

---

## 3. Critical Blockers (must close before any public/production launch)

These are not optional polish — each is a real launch-day risk.

1. **No clean `npm run build` gate verified (Domain 9).** PM DoD item 12 reads "LINT/TSC PASS; BUILD NEEDED". A production build must compile green before deploy. Cheap, fast, blocking.
2. **No `/api/health` + no production monitoring (Domain 9).** Cannot safely operate or detect outages. Plan requires health check + uptime monitor + Sentry.
3. **No production security headers (Domain 2).** No CSP/HSTS/X-Frame-Options in code. A public payment surface without these contradicts PRD §13/§14 and AGENTS.md §7.
4. **No enforced rate limiting on public endpoints (Domain 2).** Purchase, voucher-lookup, and redemption endpoints are publicly reachable; copilot-instructions and AGENTS.md mandate rate limiting on every public endpoint. Currently doc-only.
5. **Real email delivery never validated (Domains 7 & 10).** The entire delivery layer has only run in dry-run. A pilot where the recipient never receives the gift email is a launch failure. Needs guarded Resend-mode validation (`RESEND_ALLOW_REAL_RECIPIENTS=false` + `RESEND_TEST_RECIPIENT`).
6. **Stripe live-mode never exercised (Domain 5).** All Stripe validation is sandbox. Live keys, live Connect onboarding, and one real low-value live purchase must be proven before taking real card money — *or* the pilot must be restricted to offline/direct payment only.

---

## 4. High-Priority Pre-Launch Tasks (ordered, slice-shaped)

1. **Build gate:** run and green `npm run build`; fix any production-build-only errors before deploy.
2. **Health + monitoring slice:** add `/api/health` (200 + minimal DB ping), wire Sentry DSN, configure uptime check.
3. **Security-headers slice:** apply CSP/HSTS/X-Frame-Options/Referrer-Policy via `next.config.ts` headers or `proxy.ts`, scoped to allow Stripe + Supabase origins per PRD §13 matrix.
4. **Rate-limit slice:** enforce limits on public purchase, voucher-lookup, and redemption endpoints; log throttles to `security_events`.
5. **Real-email validation slice:** guarded Resend-mode run for gift-card delivery to a controlled inbox; verify `provider_message_id`, `delivery_events` state, and sender-domain auth (SPF/DKIM/DMARC).
6. **Platform-alert Resend-mode slice:** the one explicitly deferred validation from 8b.6g — single safe queued alert → resend guardrail → confirm test-recipient-only delivery.
7. **Legal-perimeter slice:** split/extend legal into linked Terms + Privacy surfaces, add cookie-consent (essential-only), and surface refund policy *before* payment confirmation.
8. **SEO-perimeter slice:** add `sitemap.ts`, `robots.ts`, LocalBusiness JSON-LD on merchant pages, OG-tag verification.
9. **Cron/scheduler slice:** schedule delivery worker, platform-alert worker, voucher-expiry, expiry-reminders, `processed_webhooks` cleanup, and PII retention/cleanup jobs (all idempotent).
10. **Full E2E + mobile smoke slice:** one documented green run each for offline and Stripe lifecycles + iOS Safari / Android Chrome pass.
11. **Stripe live-cutover slice:** live keys, live Connect onboarding for Seville Tours, one real test purchase + refund.

---

## 5. Production / Privacy / Cron Readiness (Detail)

These items sit under Domain 9 and are called out explicitly because they carry operational and GDPR/LOPDGDD weight.

### 5.1 `processed_webhooks` cleanup

```text
status: PENDING
need: scheduled, idempotent cleanup of old processed_webhooks rows
why: idempotency table grows unbounded without retention; keep dedup window adequate
note: cleanup must not delete records still inside the active idempotency window
```

### 5.2 PII retention / cleanup

```text
status: PENDING
need: planned buyer/recipient PII retention + cleanup aligned with GDPR/LOPDGDD
scope: minimize stored PII; remove/anonymize after delivery/legal window
why: AGENTS.md §8 Privacy by Design + Spain/EU obligations
note: must preserve append-only audit/ledger/redemption truth while removing personal data
```

### 5.3 Scheduled jobs (cron/scheduler)

```text
status: PENDING
jobs: delivery worker, platform-alert worker, voucher-expiry,
      expiry-reminders, processed_webhooks cleanup, PII cleanup
property: every job must be idempotent and avoid duplicate
          voucher creation, delivery, payouts, or ledger entries
```

### 5.4 Environment & deploy

```text
status: PENDING
items: Vercel env vars, production Supabase (EU Frankfurt) verification,
       Stripe webhook endpoint events configured, Resend env decision,
       worker bearer secrets, DNS, HTTPS/SSL, health check, monitoring,
       backup/recovery basics
```

---

## 6. Deferred Items (intentionally out of V1 — do not block launch)

- `charge.refunded` Stripe event handling (`refund.*` strategy is sufficient and validated).
- Automatic refund cancellation and automatic fraud-flag clearing (manual support-driven only).
- Partial/over-refund automation (flag-for-review only).
- Merchant-facing and buyer-facing alerting; admin UI; Slack/Teams alerts.
- WhatsApp Business API as a purchase/delivery path (post-purchase support only per Seville Tours lock).
- Marketplace/discovery, rich media, partial redemption, ledger/payout automation, advanced analytics (V1.5+).
- Embedded checkout / iframe / headless partner API (explicitly avoided for V1).

---

## 7. Recommended Next Implementation Slices (sequenced)

> Stop feature expansion. Each slice is small, independently shippable, and closes a launch gate. Order respects dependency and risk.

```text
Slice 8b.8  → Build gate green + Health endpoint + monitoring (Sentry + uptime)
Slice 8b.9  → Production security headers
Slice 8b.10 → Public-endpoint rate limiting + security_events logging
Slice 8b.11 → Guarded real-email delivery validation (gift card)
Slice 8b.12 → Platform-alert Resend-mode validation (closes 8b.6g defer)
Slice 8b.13 → Legal perimeter (Terms/Privacy split + cookie consent + pre-pay refund visibility)
Slice 8b.14 → SEO perimeter (sitemap.ts, robots.ts, LocalBusiness JSON-LD)
Slice 8b.15 → Cron/scheduler wiring (delivery, alerts, expiry, processed_webhooks cleanup, PII cleanup)
Slice 8b.16 → Consolidated E2E + mobile smoke evidence
Slice 8b.17 → Stripe live cutover + single live test purchase/refund
```

Slices 8b.8–8b.12 are the **launch-critical wave**; 8b.13–8b.17 are the **public-launch finishing wave**. A guarded Seville Tours pilot can begin after 8b.11–8b.12 if delivery is proven (and Stripe is restricted to sandbox or the pilot is offline-only until 8b.17).

---

## 8. Architect / PO / PM Notes

**Architect:**
- The domain core respects every locked guardrail: tenant isolation, integer-cent money, append-only ledger/audit/security/redemptions, voucher-after-confirmation, idempotent signed webhooks, payment-source-as-metadata. No architectural debt blocks launch.
- The missing items are **perimeter, not core** — headers, rate limiting, health, SEO files, scheduled jobs. These are additive and low-risk; none require touching the transactional spine.
- Keep security headers Stripe/Supabase-origin-aware to avoid breaking the Payment Element and SSR auth.

**Product Owner:**
- The single combined pilot legal page is acceptable *for a hand-held pilot* but not for unguarded public sale. Refund policy **must be visible before payment** to stay aligned with the personalized-gift refund stance in the 8b.6 handoff.
- Refund reconciliation remains platform-protection tooling, not a buyer entitlement — preserve that framing in any buyer-facing copy.
- Seville Tours buyer-experience ownership ("I'm buying a Seville Tours gift card") is correctly preserved; don't dilute it during the legal/SEO slices.

**PM:**
- The canonical status map is now `docs/pm/parausted-mvp-sprint-status-and-future-plan.md`. Treat this audit as its launch-gate companion.
- Weeks 7–8 of both sprint plans are **partially unmet** (build gate, security headers, rate limiting, legal pages, cron jobs, monitoring, live cutover). Treat slices 8b.8–8b.17 as the formal Week 7/8 burndown.
- Two explicitly-deferred validations (real email delivery, platform-alert Resend-mode) are now the gating dependencies for pilot — escalate environment readiness for Resend + production envs.

---

## 9. Recommendation

### CONDITIONAL GO — guarded Seville Tours pilot only · NO-GO for unguarded public launch

**GO for a controlled pilot** *after* closing the delivery-validation slices (8b.11, 8b.12) and confirming a real recipient receives a gift email — because the lifecycle, offline path, Stripe sandbox path, refund safety, and Seville Tours boundary are all proven, and a pilot can be hand-held end-to-end.

**Conditions that must all be true before pilot:**
1. `npm run build` passes green.
2. Real gift-card email proven deliverable (guarded Resend-mode).
3. `/api/health` + monitoring live.
4. Security headers + public-endpoint rate limiting in place.
5. One live-mode Stripe test purchase + refund completed **if** accepting real card payments in the pilot; otherwise restrict the pilot to offline/direct payment only.

**NO-GO for unguarded public launch** until the full finishing wave (8b.13–8b.17) — legal perimeter, SEO files, cron scheduling (incl. `processed_webhooks` cleanup and PII retention/cleanup), consolidated E2E/mobile evidence, and Stripe live cutover — is complete.

**Net:** Stop building features. Execute the 8b.8–8b.17 launch-gate slices in order. The product is close — the remaining distance is perimeter hardening, not core construction.
