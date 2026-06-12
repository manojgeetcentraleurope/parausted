# Resend Production Domain Test Evidence

## Status

This document is an evidence template for a production-domain Resend test only.

It does not approve real-recipient delivery.

Real-recipient delivery remains blocked unless the production rollout gate is explicitly approved.

The following must remain true during this test:

```text
RESEND_ALLOW_REAL_RECIPIENTS=false
```

Default approval status:

```text
Not approved for real recipients
```

## Test Summary

Use placeholders only. Do not record secrets, API keys, private recipient addresses, or real buyer email addresses in this file.

```text
Test date:
Environment:
Branch/commit:
Reviewer:
Resend domain/subdomain:
Resend dashboard status:
Sending identity:
Reply-To identity:
Delivery worker mode:
Real recipients allowed:
Test recipient mode:
Provider message id:
Delivery event id:
Purchase id/reference:
Voucher id/reference:
Approval status: Not approved for real recipients
```

## Required Environment Flags

Expected safe flags:

```text
DELIVERY_WORKER_MODE=resend
RESEND_ALLOW_REAL_RECIPIENTS=false
```

Non-secret environment evidence:

```text
RESEND_FROM_EMAIL configured with verified production domain/subdomain: yes/no
RESEND_REPLY_TO_EMAIL monitored: yes/no
RESEND_TEST_RECIPIENT_EMAIL configured: yes/no, do not record private address here
RESEND_API_KEY present server-side: yes/no, do not record value
DELIVERY_WORKER_SECRET present server-side: yes/no, do not record value
```

## Preconditions Checklist

- [ ] Production sending domain/subdomain added in Resend.
- [ ] Resend dashboard status is verified.
- [ ] SPF verification passed.
- [ ] DKIM verification passed.
- [ ] DMARC record exists.
- [ ] DMARC report inbox is monitored.
- [ ] Production From address uses verified domain/subdomain.
- [ ] Reply-To inbox is monitored.
- [ ] Test recipient mode remains enabled.
- [ ] `RESEND_ALLOW_REAL_RECIPIENTS` remained false.
- [ ] No secrets/API keys are recorded in this evidence file.
- [ ] No real buyer email address is recorded in this evidence file.

## Execution Steps

1. Confirm repo is clean.
2. Confirm production-domain DNS setup runbook is complete.
3. Confirm rollout gate still says real recipients are not approved.
4. Confirm environment uses `DELIVERY_WORKER_MODE=resend`.
5. Confirm `RESEND_ALLOW_REAL_RECIPIENTS=false`.
6. Confirm configured From address uses verified production domain/subdomain.
7. Trigger the delivery worker once for a controlled pending delivery event.
8. Confirm the email is sent only to the controlled/internal test recipient.
9. Record provider message id.
10. Query `delivery_events` and record non-sensitive evidence.
11. Review email headers where practical.
12. Confirm approval status remains `Not approved for real recipients`.

## Expected Provider Response Evidence

Expected values:

```text
provider = resend
sentToTestRecipient = true
realRecipientAllowed = false
```

Observed values:

```text
Observed provider:
Observed sentToTestRecipient:
Observed realRecipientAllowed:
Observed provider_message_id:
Observed status:
Observed failure_reason if any:
```

## SQL Evidence Placeholders

Use safe `SELECT`-only queries.

### Recent Resend Sent Event

```sql
SELECT id, merchant_id, status, provider_message_id, sent_at, provider_response
FROM delivery_events
WHERE channel = 'email'
  AND provider_response ->> 'provider' = 'resend'
ORDER BY COALESCE(sent_at, failed_at, queued_at) DESC
LIMIT 5;
```

### Real Recipient Safety Check

```sql
SELECT id,
       merchant_id,
       status,
       provider_message_id,
       sent_at,
       failed_at,
       provider_response ->> 'provider' AS provider,
       provider_response ->> 'realRecipientAllowed' AS real_recipient_allowed,
       provider_response ->> 'sentToTestRecipient' AS sent_to_test_recipient
FROM delivery_events
WHERE channel = 'email'
  AND provider_response ->> 'provider' = 'resend'
  AND COALESCE((provider_response ->> 'realRecipientAllowed')::boolean, false) = true
ORDER BY COALESCE(sent_at, failed_at, queued_at) DESC
LIMIT 25;
```

Before approval, and outside a specifically approved controlled real-recipient run, the real-recipient safety check must return zero rows.

## Email Header Review

```text
SPF pass observed: yes/no/not checked
DKIM pass observed: yes/no/not checked
DMARC pass observed: yes/no/not checked
From domain observed:
Return-Path/envelope domain observed if available:
Notes:
```

## Stop Conditions

Stop the test and keep real-recipient rollout blocked if any of the following occurs:

- Resend domain/subdomain is not verified.
- SPF, DKIM, or DMARC cannot be confirmed.
- `RESEND_ALLOW_REAL_RECIPIENTS` is true unexpectedly.
- Email is sent to a real buyer unexpectedly.
- `provider_response.realRecipientAllowed` is true unexpectedly.
- `provider_response.sentToTestRecipient` is not true for the test.
- Provider response does not identify `provider = resend`.
- Bounce or complaint signals appear during controlled testing.
- Any secret, API key, or private recipient address is exposed.

## Result Decision

```text
Decision: Pass / Blocked / Needs retest
Reason:
Reviewer:
Review date:
Approval status: Not approved for real recipients
```

A passing production-domain test does not automatically approve real-recipient sending.

Real-recipient sending still requires explicit approval through the production rollout gate.

## Cross-References

- ./resend-production-rollout-gate.md
- ./resend-production-domain-setup-runbook.md

The rollout gate remains the source of truth for approving real-recipient delivery.

The domain setup runbook remains the source of truth for DNS setup steps.

## Non-Goals

- No app code changes.
- No environment variable behavior changes.
- No real-recipient enablement.
- No cron/scheduler setup.
- No webhook implementation.
- No marketing email.
- No bulk sending.
- No DNS automation.
- No provider migration.
