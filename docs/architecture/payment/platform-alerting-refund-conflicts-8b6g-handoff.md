# Slice 8b.6g Handoff — Platform/Admin Alerting for Critical Refund Conflicts

**Project:** ParaUsted  
**Area:** Payments / Refunds / Platform Alerts / Support Operations  
**Date:** 2026-06-15  
**Recommended repo path:** `docs/architecture/payment/platform-alerting-refund-conflicts-8b6g-handoff.md`  
**Status:** Implementation completed through dry-run validation. Resend-mode validation deferred until environment is ready.

---

## 1. Purpose

Slice 8b.6g adds a platform/admin alerting pipeline for critical refund conflict flags, especially:

```text
external_refund_after_redemption
```

This closes the operational gap where ParaUsted could detect a critical refund conflict in `fraud_flags`, but no platform/admin notification pipeline existed.

The alerting design is intentionally decoupled from Stripe webhook reconciliation.

```text
Stripe webhook / DB reconciliation
→ fraud_flags + audit_events
→ platform alert scanner/job
→ platform_alerts queue
→ admin alert mailer
```

The Stripe webhook never waits for email delivery and alert delivery failure never affects Stripe webhook response.

---

## 2. Commits Included

```text
47b906c feat(alerts): add platform alert queue
f78a259 feat(alerts): add platform alert worker RPCs
161cc49 feat(alerts): add platform alert enqueue scanner
553f461 feat(alerts): add admin alert mailer
aff46ea feat(alerts): add platform alert processing job
```

Supporting refund reconciliation commits:

```text
8b57440 fix(payment): deduplicate external refund fraud flags
8f31c62 feat(payment): reconcile Stripe refund webhook events
70dee43 feat(payment): add Stripe refund reconciliation RPC
```

---

## 3. Implemented Architecture

### 3.1 Alert Queue Table

Created:

```text
public.platform_alerts
```

Purpose:

```text
platform-only operational alert queue
not merchant-visible
not buyer-visible
not voucher delivery
```

Key properties:

```text
RLS enabled
no RLS policies
service_role-only operational access
no FK to merchant/purchase/fraud_flags by design
generic source_type/source_id model
payload is safe whitelist only
```

Important dedup index:

```text
source_type + source_id + alert_type
```

This ensures:

```text
one source fraud_flag
→ one platform alert for the same alert_type
```

### 3.2 Worker RPCs

Created trusted worker RPCs:

```text
claim_queued_platform_alerts
mark_platform_alert_sent
mark_platform_alert_failed
```

Pattern follows the existing delivery worker approach:

```text
FOR UPDATE SKIP LOCKED
attempt_count / max_attempts
next_attempt_at retry scheduling
locked_at / locked_by ownership
service_role-only grants
```

These RPCs do not:

```text
send email
call Stripe
mutate fraud_flags
mutate audit_events
mutate delivery_events
```

### 3.3 Enqueue Scanner

Created server-only scanner:

```text
src/lib/platform-alerts/enqueue-platform-alerts.ts
```

It scans only:

```text
fraud_flags.status = open
fraud_flags.severity = critical
fraud_flags.rule_code = external_refund_after_redemption
```

It inserts one queued `platform_alerts` row per unalerted fraud flag.

The scanner avoids starvation by excluding `fraud_flags.id` values that already have matching platform alerts.

### 3.4 Admin Alert Template and Mailer

Created:

```text
src/lib/platform-alerts/admin-alert-template.ts
src/lib/platform-alerts/admin-alert-mailer.ts
```

The mailer is intentionally separate from voucher delivery:

```text
AdminAlertMailer != ResendEmailProvider
platform alert email != gift-card delivery email
```

It uses Resend directly and supports:

```text
dry-run safety via worker mode
real recipient guardrail
Resend idempotency key platform_alert:<alertId>
```

### 3.5 Processing Job Route

Created:

```text
src/app/api/jobs/process-platform-alerts/route.ts
```

The route:

```text
requires PLATFORM_ALERT_WORKER_ENABLED=true
requires Bearer PLATFORM_ALERT_WORKER_SECRET
supports PLATFORM_ALERT_WORKER_MODE=dry_run|resend
supports batchSize override
calls processPlatformAlerts
returns summary JSON
```

---

## 4. Safe Payload / PII Policy

Platform alert payload and email content include only safe operational fields:

```text
fraud_flag_id
rule_code
severity
purchase_id
merchant_id
reference_code
refund_id
payment_intent_id
charge_id
refund_amount_cents
currency
refund_status
voucher_status
redemption_count
fraud_flag_created_at
runbook_path
```

They must not include:

```text
buyer email
recipient email
phone
voucher_code
personal message
raw evidence
raw Stripe payload
secrets/tokens
merchant PII
```

The email template escapes dynamic HTML values.

---

## 5. Environment Variables

### Worker route

```text
PLATFORM_ALERT_WORKER_ENABLED
PLATFORM_ALERT_WORKER_SECRET
PLATFORM_ALERT_WORKER_MODE
PLATFORM_ALERT_WORKER_BATCH_SIZE
```

### Resend/admin mailer

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_REPLY_TO_EMAIL
RESEND_ALLOW_REAL_RECIPIENTS
RESEND_TEST_RECIPIENT
PLATFORM_ALERT_TO
PLATFORM_ALERT_RUNBOOK_URL
```

### Safe validation mode

For controlled test mode:

```text
PLATFORM_ALERT_WORKER_MODE=resend
RESEND_ALLOW_REAL_RECIPIENTS=false
RESEND_TEST_RECIPIENT=<controlled test inbox>
```

This prevents merchant/buyer/platform distribution emails during test validation.

---

## 6. Dry-Run Validation Evidence

Dry-run mode was validated locally.

### Pre-state

There were two open critical sandbox fraud flags:

```text
rule_code = external_refund_after_redemption
severity = critical
reference_code = PU-4Q8P-L22D
refund_id = re_3Tgn2u9qrmo5WtYo1SI0nhUc
```

`platform_alerts` initially had no rows.

### Dry-run processing result

The worker processed both old sandbox flags in separate `batchSize=1` runs.

Resulting `platform_alerts` rows:

```text
status = sent
attempt_count = 1
provider_response.provider = dry_run
provider_response.mode = platform_alert
provider_response.sent = false
sent_at populated
failed_at = null
locked_at = null
locked_by = null
last_error = null
```

### Final idempotency check

A third worker run returned:

```json
{
  "ok": true,
  "mode": "dry_run",
  "enqueued": 0,
  "claimed": 0,
  "processed": 0,
  "sent": 0,
  "failed": 0,
  "retryScheduled": 0,
  "results": []
}
```

This proves:

```text
already-alerted flags are not re-enqueued
sent platform alerts are not reprocessed
no stuck locks remain
no real email was sent
```

---

## 7. Current Status

Completed:

```text
platform_alerts table
claim/mark worker RPCs
enqueue scanner
safe AdminAlertMailer/template
process-platform-alerts route/orchestrator
dry-run validation
```

Deferred:

```text
Resend-mode controlled validation
production scheduling/cron setup
platform alert documentation update
merchant alerting
buyer alerting
admin UI
Slack/Teams alerts
automatic refund cancellation
automatic fraud flag clearing
```

---

## 8. Resend-Mode Validation Deferred

Resend-mode validation is intentionally deferred until environment is ready.

Required safe test setup:

```text
PLATFORM_ALERT_WORKER_ENABLED=true
PLATFORM_ALERT_WORKER_SECRET configured
PLATFORM_ALERT_WORKER_MODE=resend
RESEND_API_KEY configured
RESEND_FROM_EMAIL configured
RESEND_ALLOW_REAL_RECIPIENTS=false
RESEND_TEST_RECIPIENT configured
```

Recommended validation approach:

```text
create one safe manual queued platform_alert test row
run process-platform-alerts in resend mode
verify email arrives only at RESEND_TEST_RECIPIENT
verify platform_alerts.status = sent
verify provider_message_id is populated
verify provider_response indicates resend mode and test recipient guardrail
```

Do not enable:

```text
RESEND_ALLOW_REAL_RECIPIENTS=true
```

until test-recipient validation passes and alert content is reviewed.

---

## 9. Architect Notes

The architecture now cleanly separates responsibilities:

```text
fraud_flags = source review queue
platform_alerts = operational notification queue
audit_events = immutable history
delivery_events = voucher/buyer delivery only
processed_webhooks = Stripe event idempotency
```

This prevents platform/internal alerts from being mixed with merchant-visible voucher delivery data.

The route is intentionally separate from Stripe webhook reconciliation.

```text
Stripe webhook success does not depend on alert delivery.
```

---

## 10. Product Owner Notes

V1 alerting is platform/admin only.

No merchant or buyer notification is sent.

This is correct because refund conflict flags are reconciliation exceptions requiring review, not automatic accusations of fraud.

The first alert scope remains intentionally narrow:

```text
external_refund_after_redemption
severity = critical
status = open
```

---

## 11. PM Notes

Production readiness is improved, but final launch gates should include:

```text
Resend-mode controlled validation
runbook link in platform alert email via PLATFORM_ALERT_RUNBOOK_URL
worker scheduling/cron decision
alert recipient ownership
policy for clearing old sandbox flags
```

Recommended next slice:

```text
8b.6g-7 — Resend-mode controlled validation when environment is ready
```

If Resend env is not ready, proceed with:

```text
8b.6h — offline/direct payment operations runbook
```

---

## 12. Final Status

```text
Platform/admin alerting foundation: PASS
Dry-run validation: PASS
Real email validation: DEFERRED
Production readiness: CONDITIONAL PASS pending Resend-mode validation and scheduling setup
```
