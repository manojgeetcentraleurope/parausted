# Slice A — ParaUsted Read-Only Discovery Checklist (Fixed Alcázar Gift Pilot)

**Project:** Seville Tours × ParaUsted — Fixed Alcázar guided-tour gift pilot
**Workspace:** ParaUsted (`C:\learn\parausted`)
**Type:** Read-only discovery. **No code changes. No SQL writes. No migrations. No commits.**
**Date:** 2026-06-19
**Purpose:** Confirm the facts that BLOCK Seville Tours implementation (Slice B). This checklist
must be fully completed and its outputs handed back before any brand-site CTA change begins.
**Companion docs:**
`seville-tours-parausted-contract-audit-2026-06.md`,
`seville-tours-parausted-hosted-gift-flow-handoff.md`,
`seville-tours-deep-link-partial-redemption-gap-and-plan.md`

> Boundary reminder: ParaUsted remains the source of truth for purchase, payment confirmation,
> voucher issuance, delivery, and redemption. This discovery only **reads** that state.

---

## 1. Why this slice exists (the two blockers)

Seville Tours implementation cannot start until these are answered:

1. **Which `gift_cards` UUID is the fixed Alcázar card?** Two fixed cards exist (Cathedral and
   Alcázar). Linking the wrong one is a silent correctness bug.
2. **What actually triggers voucher issuance, and how is the recipient reached?** The plan assumed a
   manual admin payment-confirm step and an email delivery queue. Neither is verified. The end-to-end
   smoke test depends on the real answer.

---

## 2. Required outputs (hand these back to Seville Tours)

```text
ST_GC_FIX_ALCAZAR_GIFT_CARD_ID = <uuid>
ES product URL = https://parausted.es/es/m/seville-tours-co/gift-cards/<uuid>
EN product URL = https://parausted.es/en/m/seville-tours-co/gift-cards/<uuid>

Actual voucher_code_prefix      = <value as stored, do NOT assume ST-GC-FIX>
Actual card_type value          = <value as stored, do NOT assume fixed_value>
Title (es) / Title (en)         = <values>
Fixed amount (cents) + currency = <value> EUR
Pilot-safe title?               = YES / NO (+ note if a ParaUsted copy fix is needed)

Voucher issuance trigger        = STRIPE_WEBHOOK / MANUAL_ADMIN_CONFIRM / BOTH
Recipient delivery mechanism    = EMAIL / VOUCHER_PAGE_ONLY / BOTH
Voucher page fallback reachable = YES / NO  (/{locale}/v/{code})
```

---

## 3. Discovery checklist

### 3.1 Merchant
- [ ] Active merchant `seville-tours-co` exists and is enabled.

### 3.2 Identify the fixed Alcázar card (disambiguate from Cathedral)
- [ ] List all active `gift_cards` for `seville-tours-co`.
- [ ] Identify the **Alcázar** fixed card specifically (by title/`title_en`, not by assuming a prefix).
- [ ] Confirm it is the fixed/single-value card type (capture the **actual** `card_type` value).
- [ ] Capture its `id` (UUID), `voucher_code_prefix`, `title`, `title_en`, fixed amount, currency, `active`.
- [ ] Record the Cathedral fixed card UUID too, only to confirm it is NOT the one being linked.

### 3.3 Product URL reachability
- [ ] `GET https://parausted.es/es/m/seville-tours-co/gift-cards/<uuid>` returns **200**.
- [ ] `GET https://parausted.es/en/m/seville-tours-co/gift-cards/<uuid>` returns **200**.
- [ ] Page renders the correct Alcázar fixed card (title + amount match section 3.2).

### 3.4 Amount + prefill safety
- [ ] Fixed amount is derived **server-side** from the SKU (not from any query param).
- [ ] Appending `?amount=...&recipient=...&return_url=...` is ignored / does not alter the displayed
      amount or behaviour (confirms it is safe for Seville Tours to pass nothing — and that nothing
      leaks if a param is ever added accidentally).

### 3.5 Issuance trigger (resolve blocker #2)
- [ ] Determine the real path from payment → voucher issuance:
      Stripe webhook automatic, manual admin confirm, or both.
- [ ] Confirm issuance still happens **only after** payment confirmation (unchanged from audit §1.2).
- [ ] Record the exact step a tester performs to reach "voucher issued" in the smoke test.

### 3.6 Delivery + recipient handoff (resolve recipient-journey gap)
- [ ] Confirm whether ParaUsted emails the **recipient** after issuance.
- [ ] Confirm the public voucher page `/{locale}/v/{code}` is always available as the guaranteed fallback.
- [ ] Confirm where the recipient sees "send your code + preferred dates to Seville Tours" guidance
      (voucher page copy vs. email vs. neither — this determines if a ParaUsted copy task is needed).

### 3.7 Redemption (confirm full-redeem fits)
- [ ] Confirm `redeem_voucher_full` is merchant-only via dashboard and zeroes balance + sets `redeemed`.
- [ ] Confirm no booking-date dependency exists in ParaUsted (booking coordination stays manual,
      merchant redeems only after Seville Tours confirms the booking).

---

## 4. Pilot-safety judgement (fill in after discovery)

- [ ] Title communicates an Alcázar guided-tour gift clearly enough for the pilot — or a ParaUsted
      copy update is logged as a **non-blocking** follow-up (does not block Seville Tours Slice B).
- [ ] Amount matches the agreed Alcázar fixed gift price.

---

## 5. Explicitly OUT OF SCOPE for this slice

```text
- No deep-link prefill (amount/recipient/sender/message)
- No return_url / return-to-brand work
- No partial redemption changes
- No merchant notification email/webhook
- No invoice/factura work
- No /p/{slug} product slug route
- No schema changes, migrations, or RPC changes
```

---

## 6. Exit criteria (Slice A is "done")

All section 2 outputs are filled, sections 3.1–3.7 checked, and section 4 judged. Only then is
Seville Tours authorized to begin Slice B (typed SKU config + product-URL helper + repoint the
**fixed** Alcázar CTA; flexible/luxury remain on the generic merchant page).
