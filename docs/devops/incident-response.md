# Incident Response Playbook — ParaUsted

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|:------------:|---------|
| **P0 — Critical** | Platform fully down or data breach | < 15 min | Site unreachable, DB down, security breach |
| **P1 — High** | Major feature broken, payments failing | < 1 hour | Stripe webhooks failing, vouchers not generating |
| **P2 — Medium** | Feature degraded, workaround exists | < 4 hours | WhatsApp delivery failing (email works), slow dashboard |
| **P3 — Low** | Minor issue, cosmetic | Next business day | Typo in UI, minor styling issue |

## Response Procedures

### P0 — Critical: Site Down
1. Check Vercel status page: vercel.com/status
2. Check Supabase status: status.supabase.com
3. Check Cloudflare status: cloudflarestatus.com
4. If your code: rollback via Vercel dashboard (< 1 min)
5. If provider: wait + update status.parausted.es
6. Post-incident: write post-mortem within 24 hours

### P0 — Critical: Suspected Data Breach
1. **DO NOT** modify or delete any logs
2. Rotate all API keys immediately (Stripe, Supabase, WhatsApp, Resend)
3. Check `security_events` table for suspicious activity
4. Check `audit_events` for unauthorized data access
5. If confirmed: notify AEPD within 72 hours (GDPR requirement)
6. If high risk to users: notify affected individuals
7. Document everything for legal review

### P1 — High: Payments Failing
1. Check Stripe dashboard for webhook delivery issues
2. Check `processed_webhooks` table — are events being received?
3. Verify webhook signing secret matches
4. Check Vercel function logs for errors
5. If webhook endpoint is down: Stripe retries for up to 3 days
6. Manual fix: process pending purchases from Stripe dashboard

### P2 — Medium: Delivery Failing
1. Check `delivery_events` table for failure patterns
2. WhatsApp failing? Check Meta Business API status
3. Email failing? Check Resend dashboard
4. Fallback: buyers can use "Download & Send Yourself" option
5. Fix root cause, then retry failed deliveries

## Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

**Date:** YYYY-MM-DD
**Duration:** X hours Y minutes
**Severity:** P0/P1/P2
**Impact:** What users experienced

## Timeline
- HH:MM — Issue detected (how)
- HH:MM — Investigation started
- HH:MM — Root cause identified
- HH:MM — Fix deployed
- HH:MM — Confirmed resolved

## Root Cause
What went wrong and why.

## Resolution
What was done to fix it.

## Action Items
- [ ] Prevent recurrence: ...
- [ ] Improve detection: ...
- [ ] Update runbook: ...
```
