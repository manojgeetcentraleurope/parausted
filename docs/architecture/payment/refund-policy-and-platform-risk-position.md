# ParaUsted Refund Policy and Platform Risk Position

**Project:** ParaUsted  
**Area:** Payments / Refunds / Consumer Policy / Platform Risk  
**Date:** 2026-06-14  
**Recommended repo path:** `docs/architecture/payment/refund-policy-and-platform-risk-position.md`  
**Status:** Product/legal-risk positioning note. No implementation included.  

> **Important disclaimer:** This document is a product and architecture risk-positioning note, not legal advice. Final buyer-facing Terms & Conditions, refund policy wording, withdrawal-right wording, and merchant obligations should be reviewed by a qualified Spain/EU consumer-law lawyer before public launch.

---

## 1. Purpose

This document clarifies the correct platform position for ParaUsted refunds.

The key principle is:

```text
Refund tooling is a merchant/support capability.
Refund availability is not a ParaUsted buyer entitlement by default.
```

ParaUsted should not present refunds as an automatic buyer right created by the platform. Instead, ParaUsted provides secure tooling so the business using ParaUsted can refund eligible unused vouchers when the business chooses to do so, when its published policy allows it, or when applicable law requires it.

This distinction keeps the platform safer while still giving merchants operational flexibility.

---

## 2. Legal Context Summary

Spain/EU consumer rules generally provide a 14-day withdrawal right for many distance/online purchases, but that right has exceptions. The European Consumer Centre in Spain explains that consumers generally have 14 days to withdraw from distance or off-premises contracts, while also noting that withdrawal does not apply to goods produced according to customer specifications or clearly personalised goods. citeturn191search36turn191search35

Spanish/EU consumer information also identifies exceptions for remote sales, including customised or made-to-measure items, and digital content where access or download has begun with the consumer’s agreement and acknowledgement of losing withdrawal rights. citeturn191search53turn191search42

Gift cards do not have one simple EU-wide dedicated refund regime. Legal commentary notes that gift cards are still subject to general consumer law, including the Consumer Rights Directive and unfair commercial practice rules, and that local member-state law can add requirements. citeturn191search52turn191search44

Therefore, ParaUsted should avoid absolute claims such as:

```text
Personalized gift cards are never refundable.
```

The safer formulation is:

```text
Refund availability depends on the merchant’s refund policy and applicable law. Some customised or clearly personalised products may be excluded from statutory withdrawal rights where legally permitted.
```

---

## 3. Platform Position

ParaUsted’s recommended position is:

```text
ParaUsted provides technical refund and voucher-voiding tools.
The merchant/business using ParaUsted controls its refund policy.
The merchant/business is responsible for complying with applicable consumer law.
ParaUsted does not provide buyer self-service refunds in V1.
```

This means ParaUsted should communicate refunds as:

```text
merchant-controlled refund tooling
support/admin refund capability
audit-safe voucher voiding
```

ParaUsted should **not** communicate refunds as:

```text
a universal buyer refund guarantee
a no-questions-asked refund feature
a buyer self-service cancellation/refund portal in V1
```

---

## 4. Personalized Gift Card Nuance

ParaUsted gift cards may include personalization such as:

```text
recipient name
sender name
personal message
custom voucher prefix
merchant branding
email or WhatsApp delivery
```

However, the legal classification of a gift card may depend on what is actually being sold:

- If the product is genuinely made to consumer specification or clearly personalised, the withdrawal-right exception may apply where legally permitted. citeturn191search36turn191search35
- If the product is effectively a standard prepaid voucher value with only lightweight personalization, a regulator or lawyer may analyse it differently under general gift-card and consumer-law principles. citeturn191search52turn191search53

Therefore, buyer-facing wording should be conservative and legally reviewed.

Recommended safe wording direction:

```text
Personalized gift cards may be non-refundable once issued, except where required by applicable law or where the merchant chooses to offer a refund.
```

Avoid:

```text
All personalized gift cards are non-refundable.
No refunds are ever allowed.
ParaUsted decides whether buyers get refunds.
```

---

## 5. Current Product Rules for V1 / Pilot

The current ParaUsted V1 refund policy should be:

```text
Refunds are merchant/support-controlled.
No buyer self-service refund.
Full 100% refund only.
No partial refund.
No 90% refund.
No custom refund percentage.
Reason is required.
Refund is allowed only for unused vouchers.
Any redemption blocks automatic refund.
Voucher is voided when refund is processed.
```

This aligns with the current implementation:

```text
Offline/direct refund = DB-state only, merchant returns money outside ParaUsted.
Online/card refund = Stripe refund saga, voucher voided, stripe_refund_id stored.
```

---

## 6. Current Technical Capability vs Refund Entitlement

### 6.1 Technical Capability

ParaUsted can now process:

```text
eligible offline/direct refunds
eligible online/card Stripe refunds
voucher voiding
refund audit events
redeemed-voucher refund blocking
```

### 6.2 Refund Entitlement

This technical capability does **not** mean every buyer is entitled to a refund.

Refund entitlement depends on:

```text
merchant refund policy
published terms at purchase time
whether the gift card is personalised/customised
whether the voucher has been used
applicable Spanish/EU consumer law
merchant goodwill or support decision
```

The merchant/business remains responsible for the policy decision.

---

## 7. Merchant Responsibility

The merchant using ParaUsted should be responsible for:

```text
publishing clear refund terms
complying with consumer-law requirements
deciding whether to refund when law does not require it
processing offline money return for cash/Bizum/bank transfer refunds
using ParaUsted refund tools for Stripe/card refunds
not refunding directly in Stripe Dashboard during pilot
```

ParaUsted should provide:

```text
secure refund tooling
audit trail
voucher voiding
redemption safety checks
support evidence
```

ParaUsted should not silently decide merchant policy.

---

## 8. ParaUsted Platform Safety Rules

### 8.1 Do Not Promise Universal Refunds

Buyer-facing pages should avoid general statements like:

```text
You can always get a refund.
```

Use safer language:

```text
Refunds are subject to the merchant’s refund policy and applicable law.
```

### 8.2 Do Not Offer Buyer Self-Service Refunds in V1

V1 should remain merchant/support-controlled:

```text
buyer contacts merchant/support
merchant/support reviews policy/legal basis
merchant/support initiates refund if appropriate
ParaUsted records reason and audit trail
```

### 8.3 Do Not Support Partial Refunds in V1

Partial/custom refunds require separate design for:

```text
voucher value handling
Stripe partial refund amount
proportional transfer reversal
ledger entries
payout reconciliation
buyer communication
merchant policy disclosure
```

### 8.4 Do Not Let Stripe Dashboard Bypass ParaUsted State

For pilot:

```text
All Stripe refunds must go through ParaUsted.
Stripe Dashboard refunds are emergency-only and must be manually reconciled immediately.
```

For production:

```text
Stripe external refund webhook reconciliation is required before broader launch.
```

---

## 9. Current Refund Scenarios

### Scenario A — Merchant Chooses to Refund Unused Voucher

Status:

```text
Implemented.
```

Behavior:

```text
Merchant/support initiates refund.
System confirms voucher is unused and full balance.
Refund is processed.
Voucher is voided.
Audit trail is written.
```

### Scenario B — Merchant Policy Says No Refund and Law Allows No Withdrawal

Status:

```text
Supported as product policy.
```

Behavior:

```text
No buyer self-service refund.
Merchant may refuse refund if legally allowed.
No ParaUsted state change.
```

### Scenario C — Applicable Law Requires Refund / Withdrawal

Status:

```text
Supported through merchant/support refund tooling.
```

Behavior:

```text
Merchant/support uses ParaUsted refund tooling.
Reason is recorded.
Voucher is voided.
Audit trail is preserved.
```

### Scenario D — Voucher Already Redeemed

Status:

```text
Automatic refund blocked.
```

Behavior:

```text
Any redemption row blocks refund.
No automatic refund.
Manual legal/support review only.
```

### Scenario E — Stripe Dashboard Direct Refund

Status:

```text
Future reconciliation required.
```

Risk:

```text
Money refunded in Stripe.
Voucher remains active in ParaUsted.
Recipient can still redeem.
```

Future requirement:

```text
Webhook reconciliation must detect and handle external refunds.
```

---

## 10. Recommended Buyer-Facing Language Direction

### Safe Short Form

```text
Refunds are subject to the merchant’s refund policy and applicable law. Personalized gift cards may be non-refundable once issued, except where required by law or where the merchant chooses to offer a refund.
```

### Safe Merchant Dashboard Note

```text
Use this action only when your business has decided to refund this unused gift card or when a refund is required by applicable law. ParaUsted will void the voucher and record the refund reason for audit purposes.
```

### Safe Stripe/Card Refund Note

```text
A Stripe/card refund will be processed through ParaUsted. The voucher will be voided before the refund is completed. If Stripe is still processing the refund, the status may remain as processing.
```

### Safe Offline Refund Note

```text
This marks the purchase as refunded and voids the voucher in ParaUsted. Returning the money to the buyer is handled by you outside ParaUsted.
```

---

## 11. Recommended Merchant Terms Topics

Merchant/buyer terms should eventually clarify:

```text
who the seller/merchant is
whether the gift card is personalised
whether statutory withdrawal applies
merchant refund policy
voucher expiry
voucher redemption conditions
what happens after redemption
what happens after partial use, if ever supported
how refund requests are handled
who to contact for support
```

Final wording should be legally reviewed.

---

## 12. Architect Notes

### Current Architecture Remains Correct

The current refund implementation is a capability, not a promise. It safely enforces:

```text
unused voucher only
full balance only
no redemptions
voucher voiding
audit trail
tenant-scoped merchant action
```

### Future Architecture Requirement

Before broader production launch:

```text
external Stripe refund reconciliation must exist
```

This protects against direct Stripe Dashboard refunds bypassing ParaUsted.

---

## 13. Product Owner Notes

Refunds should be positioned as:

```text
merchant-controlled support tooling
```

Not as:

```text
buyer self-service refund feature
universal refund promise
ParaUsted guarantee
```

The product promise should focus on:

```text
safe voucher lifecycle
auditability
merchant control
legal-policy flexibility
```

---

## 14. PM Notes

### Current Pilot Position

```text
Refund tooling is ready for controlled pilot with operational guardrails.
```

### Required Guardrail

```text
Do not process Stripe refunds directly in Stripe Dashboard during pilot unless manually reconciled immediately.
```

### Before Broader Launch

Required:

```text
legal review of buyer-facing refund wording
merchant terms template
support refund runbook
external Stripe refund webhook reconciliation
feature-gating decisions for SaaS plans
```

---

## 15. Final Decision

ParaUsted should continue with the following policy position:

```text
ParaUsted provides refund and voucher-voiding tools.
Refunds are initiated by the merchant/business or support when allowed by policy or required by law.
ParaUsted does not create an automatic buyer refund entitlement in V1.
Personalized gift cards may be non-refundable once issued, except where required by applicable law or where the merchant chooses to refund.
```
