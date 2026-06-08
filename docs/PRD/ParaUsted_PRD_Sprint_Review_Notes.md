# ParaUsted — PRD & Sprint Plan Review Notes

**Date:** 2026-06-08  
**Status:** Minor additions to apply during execution or before next sprint review  
**Does NOT block:** current implementation or pending purchase prompt  

---

## PRD v1.1 Change Pack — Minor Notes

### Note 1: Pending purchase expiry automation

Current state: `expires_at` is set on purchase creation.  
Missing: no cron or manual job yet to cancel/expire pending purchases past `expires_at`.

Action: implement in Week 4 or Week 7.

Options:
- Simple: server-side check that filters out expired pending purchases from merchant dashboard
- Better: scheduled job or manual action to move expired purchases to `cancelled`
- Best: pg_cron job that runs periodically

Minimum for V1 launch: dashboard must not show expired pending purchases as actionable.

---

### Note 2: Buyer confirmation after pending purchase

V1: buyer sees on-screen success with reference code and payment instructions.  
V1.5: buyer receives email confirmation of pending purchase request.

No code change needed now. Just a product expectation note.

---

### Note 3: Merchant notification of new pending purchases

V1: merchant checks dashboard manually for pending requests.  
V1 fast-follow or V1.5: merchant receives email or push notification when a new pending purchase arrives.

No code change needed now. Important for adoption because merchants may not check dashboard constantly.

---

### Note 4: Automated voucher delivery to recipient

V1: voucher page is accessible by code. Merchant can share link after confirmation.  
V1 fast-follow: automated email delivery to recipient after voucher issuance using Resend or similar.

No code change needed now. The voucher page is the source of truth; delivery is a channel.

---

## Sprint Plan v1.1 — Minor Additions

### Week 4 addition

Add to Day 2 or Day 3:

```text
- [ ] Show expired indicator on pending purchases past expires_at
- [ ] Optionally: server action to manually cancel expired pending purchases
- [ ] Cron or manual job: cancel/expire pending purchases past expires_at (can defer to Week 7)
```

---

### Week 5 risk note

If Stripe Connect is not fully ready by end of Week 5, move webhook edge cases to Week 7 security hardening. Core Stripe happy path should work; edge cases can be hardened later.

---

### Week 7 additions

Add to Day 4 (Audit and Data Safety):

```text
- [ ] Pending purchase expiry automation or manual cleanup
- [ ] Processed webhook cleanup plan documented
```

---

### Week 8 additions

Add to Day 3 (Production Readiness):

```text
- [ ] Verify legal/consent copy with at least one Spanish-speaking reviewer
- [ ] Verify Stripe live mode vs test mode decision is documented
- [ ] Document known V1 limitations and V1.5 priorities
```

---

## When to apply these notes

```text
Week 4: apply expiry indicator and cancel action notes
Week 5: apply Stripe risk note if slipping
Week 7: apply expiry automation and webhook cleanup notes
Week 8: apply legal review and limitations document notes
Before V1.5 planning: apply buyer email, merchant notification, and voucher delivery notes
```

---

## Summary

These are not blockers. They are quality improvements to apply during execution.

The PRD and Sprint Plan are approved and ready to use as Copilot context now.
