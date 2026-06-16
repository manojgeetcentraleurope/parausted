# ParaUsted MVP Sprint Status and Future Plan

**Project:** ParaUsted  
**Area:** MVP Delivery / Sprint Governance / Launch Readiness  
**Date:** 2026-06-15  
**Recommended repo path:** `docs/pm/parausted-mvp-sprint-status-and-future-plan.md`  
**Status:** Sprint status checkpoint after refund reconciliation, platform alerting, and offline/direct payment operations documentation.

---

## 1. Executive Summary

ParaUsted is broadly **on track for the V1 MVP**, and in several payment-safety areas it is ahead of the original 8-week sprint plan.

The core V1 lifecycle is implemented:

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

The Stripe path is also significantly hardened beyond the original baseline:

```text
Stripe Connect onboarding
Stripe webhook confirmation
online refund saga
external Stripe Dashboard refund reconciliation
fraud flag deduplication
platform/admin alerting foundation
dry-run alert validation
```

The main remaining work is no longer core feature construction. The project is entering the **launch readiness phase**:

```text
legal/public policy verification
security hardening verification
E2E/manual smoke testing
production environment readiness
pilot merchant onboarding
Resend-mode platform alert validation when env is ready
```

Recommendation:

```text
Stop expanding refund/payment features now.
Focus on Week 7/8 launch gates and production readiness.
```

---

## 2. Current Git Checkpoint

Latest known clean history:

```text
51d011d docs(integration): record Seville Tours hosted gift flow handoff
a9065d3 feat(gift-card): add Seville Tours luxury gift card
5f485e9 docs(payment): add offline payment operations runbook
594f001 docs(alerts): record platform alerting handoff
aff46ea feat(alerts): add platform alert processing job
553f461 feat(alerts): add admin alert mailer
161cc49 feat(alerts): add platform alert enqueue scanner
f78a259 feat(alerts): add platform alert worker RPCs
47b906c feat(alerts): add platform alert queue
e025bcd docs(payment): add refund conflict support runbook
```

Working tree before adding this document:

```text
clean
```

Current documentation change:

```text
docs/pm/parausted-mvp-sprint-status-and-future-plan.md added as the canonical PM status document.
```

---

## 3. Sprint Principles Alignment

The implementation remains aligned with the locked ParaUsted MVP principles.

### Strongly aligned

```text
No voucher before payment confirmation
One gift-card lifecycle across direct and Stripe payments
Direct Payment Confirmation Center is core V1
Stripe remains V1 but modular
Marketplace/discovery remains deferred to V1.5
Voucher page remains source of truth
SOLID/DRY/KISS/YAGNI discipline followed
Server/client boundary discipline preserved
No PII logging discipline followed in new code
Manual validation before commit consistently applied
```

### Partially complete / needs launch verification

```text
Spain-first legal safety public pages
SEO-heavy public polish
Security headers and rate limits
Production deployment checks
Full E2E and mobile validation
```

---

## 4. Week-by-Week MVP Sprint Status

## Week 1 — Foundation, i18n, Database, and Security Baseline

**Status:** Mostly complete.

Completed:

```text
Next.js / Supabase foundation
EU Frankfurt Supabase project
Core database tables
i18n ES/EN foundation
SEO helper foundation
Next.js 16 proxy.ts direction
Bilingual content columns
RLS/security baseline for core tables
Seed/test data
Repeated lint/type validation
```

Needs final verification:

```text
Cloudflare DNS for parausted.es
GitHub branch protection
CI workflow for lint/type/build
.env.example completeness
security headers baseline
```

Verdict:

```text
Foundation is functionally ready, but production infrastructure checklist still needs explicit final verification.
```

---

## Week 2 — Merchant Experience and Gift-Card CRUD

**Status:** Mostly complete.

Completed:

```text
localized auth pages
dashboard shell
merchant onboarding
merchant profile management
bilingual merchant fields
gift-card create/update/toggle flow
public merchant integration
```

Known or possible gaps:

```text
preserve form values after validation errors
password recovery / magic link / Google OAuth final scope check
minor dashboard UX polish
```

Verdict:

```text
MVP-complete enough for pilot, with UX polish remaining.
```

---

## Week 3 — Public Merchant Pages and Pending Purchase Flow

**Status:** Complete with minor UX gaps.

Completed:

```text
localized public merchant pages
active merchant/gift-card filtering
404 handling
bilingual fallback
public gift-card purchase page
pending purchase server action
reference code generation
payment_source = OFFLINE for direct methods
payment_method = bizum_direct / bank_transfer / cash
no voucher before payment confirmation
payment instructions only after pending purchase creation
```

Known deferred items:

```text
preserve purchase form values after validation errors
show Bizum amount/details more clearly
better buyer/recipient email handling if needed
```

Verdict:

```text
Core Week 3 transaction-safety milestone is complete.
```

---

## Week 4 — Direct Payment Confirmation and Voucher Issuance

**Status:** Complete and strengthened.

Completed:

```text
merchant pending purchase manager
confirm direct payment
cancel/reject flows
offline refund/void safety
voucher issuance after payment_confirmed only
crypto voucher code generation
idempotency protection
audit events
public voucher page
voucher state/balance display
```

Additional hardening:

```text
offline refund void RPC
offline refund dashboard action/UI
redeemed voucher refund protection
```

Verdict:

```text
Week 4 is complete and stronger than originally planned.
```

---

## Week 5 — Stripe Connect V1 Payment Path

**Status:** Complete and heavily hardened.

Completed:

```text
Stripe Connect onboarding
Stripe status refresh
Stripe online purchase path
Stripe webhook signature verification
processed_webhooks idempotency
confirm_stripe_purchase_and_issue_voucher RPC
voucher issuance only after Stripe webhook confirmation
Stripe refund server action/dashboard UI
online refund saga RPCs
external Stripe refund reconciliation
refund.created/refund.updated/refund.failed webhook wiring
```

Additional production hardening:

```text
external Stripe Dashboard refund happy-path reconciliation
external refund after redemption conflict detection
fraud flag deduplication using same-refund advisory locking
platform_alerts queue
platform alert worker RPCs
enqueue scanner
AdminAlertMailer and safe template
process-platform-alerts job route
dry-run validation of platform alert pipeline
```

Verdict:

```text
Week 5 is complete and ahead of plan. Stop expanding refund/payment features now except deferred Resend validation.
```

---

## Week 6 — Redemption, SEO Hardening, Tourist Mode

**Status:** Mostly complete, needs verification.

Completed:

```text
full redemption flow
voucher locking/safety behavior
redeemed voucher status handling
refund action hidden for non-refundable states
public voucher page foundation
```

Needs verification or completion:

```text
localized metadata on voucher and purchase pages
OG tags for sharing
tourist-mode copy for tour category
English tourist flow avoids Bizum assumption
basic dashboard activity summary
mobile UX for voucher/redemption flows
```

Verdict:

```text
Redemption is complete. SEO/tourist/dashboard polish needs a focused verification slice.
```

---

## Week 7 — Legal Safety, Security Hardening, and Operational Readiness

**Status:** Partially complete.

Completed / strong progress:

```text
refund policy and platform risk docs
refund validation and launch gates doc
refund conflict support runbook
offline/direct payment operations runbook
external refund reconciliation handoff
platform alerting handoff
audit coverage for money-state transitions
fraud_flags support queue
platform_alerts dry-run alerting
no PII logging discipline in new alert/refund code
```

Still pending or needs explicit verification:

```text
public Terms page final wording
public Privacy page final wording
public Refund/goodwill policy page final wording
pre-purchase disclosure final review
cookie banner decision if non-essential cookies exist
security headers
rate limits
Sentry/monitoring if desired
processed_webhooks cleanup plan/job
PII retention/cleanup plan
mobile/accessibility polish batch
```

Verdict:

```text
Operational backend safety is strong, but public legal/security launch gates remain partially open.
```

---

## Week 8 — Testing, Launch, and First Merchants

**Status:** Pending.

Still required:

```text
manual E2E suite
merchant signup → onboarding → create card
Direct payment → confirmation → voucher → redemption
Stripe payment → webhook → voucher → redemption
custom amount validation
inactive gift-card checks
missing merchant/card 404 checks
Spanish and English flows
Seville tourist-mode checks
mobile iOS Safari / Android Chrome checks
production environment verification
Vercel production deployment
DNS and HTTPS verification
Stripe webhook endpoint production/test configuration
health check
pilot merchant onboarding
controlled pilot purchase and redemption
```

Verdict:

```text
Week 8 remains the major remaining launch phase.
```

---

## 5. V1 Definition of Done Status

```text
1. Merchant can onboard.                         PASS
2. Merchant can create/manage bilingual cards.   PASS
3. Public merchant page works ES/EN.             PASS
4. Buyer can create pending direct purchase.     PASS
5. Merchant can confirm direct payment.          PASS
6. Stripe online path confirms via webhook.      PASS
7. Voucher issued only after confirmation.       PASS
8. Recipient can open voucher page.              PASS
9. Merchant can fully redeem voucher.            PASS
10. Audit events for core state changes.         PASS
11. Legal consent/policy pages exist.            NEEDS FINAL VERIFY
12. TypeScript/lint/build pass.                  LINT/TSC PASS; BUILD NEEDED
13. Manual E2E checks pass.                      PARTIAL / PENDING FULL SUITE
14. First pilot merchant can use safely.         PENDING
```

---

## 6. Major Completed Work Beyond Original MVP Baseline

The original sprint plan excluded advanced refunds and alerting, but the following hardening was completed because it protects real money-state integrity:

```text
online refund saga RPCs
online refund dashboard action/UI
external Stripe refund webhook reconciliation
external refund after redemption critical conflict flag
fraud flag deduplication
refund conflict support runbook
platform alert queue and worker RPCs
platform alert scanner
AdminAlertMailer and safe template
process-platform-alerts job route
dry-run validation
```

This work is acceptable over-scope because it reduces production risk:

```text
Stripe refund outside ParaUsted
+ voucher still redeemable
= potential double-loss
```

However, further refund/alert feature expansion should now stop until launch gates are closed.

---

## 7. Current Risk Register

### High priority before launch

```text
public legal pages and refund policy final review
security headers and rate limits
full manual E2E validation
production environment and webhook configuration
pilot merchant smoke test
```

### Medium priority

```text
Resend-mode platform alert validation
delivery real-recipient gating review
SEO/OG metadata verification
mobile UX polish
processed_webhooks cleanup plan
```

### Deferred

```text
merchant alert emails
buyer alert emails
Slack/Teams alerting
manual refund cancel support for requires_action
partial refunds
ledger/payout automation
marketplace discovery
rich media personalization
WhatsApp Business API delivery
advanced analytics
```

---

## 8. Recommended Future Plan

## Phase A — Stop Feature Expansion and Run Launch Gap Audit

**Goal:** Freeze feature expansion and verify Week 7/8 readiness.

Recommended slice:

```text
8b.7 — Launch Gap Audit and Production Readiness Checklist
```

Outputs:

```text
completed / pending / blocked / deferred status
legal checklist
security checklist
E2E checklist
production env checklist
pilot checklist
```

Validation commands:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

---

## Phase B — Legal and Public Policy Verification

**Goal:** Ensure public legal and purchase disclosure flows are launch-safe.

Check:

```text
Terms page ES/EN
Privacy page ES/EN
Refund/goodwill policy page ES/EN
purchase consent checkbox
pre-purchase disclosure
expiry/validity wording
Stripe fee/admin fee wording if used
```

Recommended output:

```text
legal-readiness-checklist.md
```

No code unless gaps are discovered.

---

## Phase C — Security Hardening Verification

**Goal:** Close basic MVP security posture.

Check:

```text
security headers
CSP/HSTS/referrer/frame policy
rate limits for public purchase creation
rate limits for voucher lookup
rate limits for redemption
webhook secret verification
worker route bearer secrets
no PII logs
no raw DB errors
```

Recommended output:

```text
security-hardening-checklist.md
```

Implementation only if a clear gap is found.

---

## Phase D — E2E Manual Smoke Pack

**Goal:** Verify real V1 flows end-to-end.

Minimum manual tests:

```text
merchant signup → onboarding → create gift card
Spanish direct purchase → confirm → voucher page → redeem
English direct purchase → confirm → voucher page → redeem
Stripe purchase → webhook confirmation → voucher page → redeem
custom amount validation
inactive gift card hidden/not purchasable
missing merchant/card returns 404
external Stripe refund happy path
external Stripe refund redeemed conflict
platform alert dry-run still idempotent
mobile iOS Safari
mobile Android Chrome
```

Recommended output:

```text
v1-manual-e2e-evidence.md
```

---

## Phase E — Production Environment Readiness

**Goal:** Prepare deploy and first pilot.

Check:

```text
Vercel env vars
Supabase production project
Stripe webhook endpoint events
Stripe Connect mode decision
Resend env decision
worker secrets
DNS / HTTPS
health check
Sentry or logging if available
backup/recovery basics
```

Recommended output:

```text
production-readiness-runbook.md
```

---

## Phase F — Pilot Merchant Onboarding

**Goal:** Launch with one controlled pilot merchant.

Steps:

```text
create merchant account
complete merchant onboarding
create first gift card
configure Bizum/bank/cash
configure Stripe if ready
publish merchant link
run one controlled purchase
confirm payment
issue voucher
redeem voucher
collect feedback
```

Recommended output:

```text
pilot-merchant-launch-evidence.md
```

---

## 9. Recommended Next Immediate Task

Next best task:

```text
8b.7 — Launch Gap Audit and Production Readiness Checklist
```

Why:

```text
Core features are built.
Refund/payment safety is strong.
Alerting foundation is dry-run validated.
Further feature work now increases launch risk.
```

Recommended model/workflow:

```text
Model: Claude Opus 4.8 for audit/planning
Chat: new chat recommended
Output: Markdown checklist only
No implementation
```

Then implementation slices should be created only from concrete gaps found by the audit.

---

## 10. Architect / PO / PM Learning Note

### Architect

The architecture is now strong in the money-state area:

```text
DB transactional state transitions
processed_webhooks idempotency
same-refund advisory locking
fraud flag support queue
platform alert queue separated from delivery_events
safe server-only worker routes
```

Main remaining architectural concerns are production hardening:

```text
headers
rate limits
secrets
deploy configuration
scheduled jobs
observability
```

### Product Owner

The V1 product promise is intact:

```text
safe gift-card sale
voucher only after payment confirmation
merchant-controlled direct payment confirmation
Stripe card payment option
voucher page source of truth
full redemption
```

Avoid new product features before pilot. Focus on trust, clarity, legal wording, and pilot usability.

### Project Manager

The project has moved from feature delivery to launch readiness.

Next management priority:

```text
convert remaining work into launch-gate checklist items
assign status
close blockers
run E2E evidence
prepare pilot merchant
```

---

## 11. Final Recommendation

```text
MVP core: ON TRACK / AHEAD
Payment safety: AHEAD
Alerting foundation: AHEAD, real email validation deferred
Offline payment process: DOCUMENTED
Legal/security launch gates: PARTIAL
E2E/production/pilot: PENDING
```

Recommended action:

```text
Stop feature expansion.
Run launch-gap audit.
Close Week 7/8 readiness gates.
Prepare pilot merchant launch.
```
