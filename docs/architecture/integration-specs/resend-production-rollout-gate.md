# Resend Production Rollout Gate

## Status

State: Not approved for real recipients yet.

The controlled Resend test passed in test-recipient mode only. Production rollout is separate from local or test success.

Do not set RESEND_ALLOW_REAL_RECIPIENTS=true until every rollout gate item in this document is complete and explicit approval has been recorded.

## Current Safe State

- The delivery worker supports DELIVERY_WORKER_MODE=dry_run.
- The delivery worker supports DELIVERY_WORKER_MODE=resend.
- A controlled test-recipient send passed.
- The controlled test used onboarding@resend.dev and test-recipient mode.
- RESEND_ALLOW_REAL_RECIPIENTS=false remains required.
- Real customer delivery is not enabled.

## Required Production Preconditions

- Resend domain verified for production sending.
- SPF configured for the verified domain or verified sending subdomain.
- DKIM configured for the verified domain or verified sending subdomain.
- DMARC configured for the verified domain or verified sending subdomain.
- RESEND_FROM_EMAIL uses the verified production domain or verified sending subdomain.
- RESEND_REPLY_TO_EMAIL points to a monitored inbox.
- RESEND_API_KEY stored only server-side.
- DELIVERY_WORKER_SECRET strong and server-only.
- DELIVERY_WORKER_BATCH_SIZE conservative for the first rollout. Start with 1 for the first real-recipient run.

## Sender Address Decision

- onboarding@resend.dev is test-only.
- Production sender must be one of the following, depending on what is verified in Resend:
- ParaUsted <regalos@parausted.es>
- ParaUsted <regalos@verified-subdomain.parausted.es>
- Production must use a verified ParaUsted domain or verified sending subdomain.

## Real Recipient Enablement Rule

RESEND_ALLOW_REAL_RECIPIENTS=true may only be set after explicit approval.

Before approval, keep:

```text
RESEND_ALLOW_REAL_RECIPIENTS=false
```

Local or test success does not change this rule.

## First Production Test Plan

1. Choose one known test purchase/voucher.
2. Confirm recipient email is controlled or explicitly approved.
3. Set DELIVERY_WORKER_BATCH_SIZE=1.
4. Enable real recipients only for the controlled run.
5. Trigger worker once.
6. Verify DB row status and provider response.
7. Verify recipient received email.
8. Immediately review logs and failed events.

## SQL Verification

The default worker lock timeout is 900 seconds. Adjust the interval below only if the worker timeout changes.

```sql
-- Recent Resend sent events
SELECT id, merchant_id, status, provider_message_id, sent_at, provider_response
FROM delivery_events
WHERE channel = 'email'
  AND status = 'sent'
  AND provider_response ->> 'provider' = 'resend'
ORDER BY sent_at DESC
LIMIT 25;

-- Recent Resend failed events
SELECT id, merchant_id, status, failure_reason, failed_at, provider_response
FROM delivery_events
WHERE channel = 'email'
  AND status = 'failed'
  AND provider_response ->> 'provider' = 'resend'
ORDER BY failed_at DESC
LIMIT 25;

-- Locked events older than the default timeout
SELECT id, merchant_id, status, locked_at, locked_by, attempt_count, max_attempts, next_attempt_at
FROM delivery_events
WHERE channel = 'email'
  AND locked_at IS NOT NULL
  AND locked_at < now() - interval '15 minutes'
ORDER BY locked_at ASC;

-- Events where real recipients were allowed
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

Before approval, and outside a specifically approved controlled production run, the final query should return zero rows.

## Monitoring Requirements

- Monitor failed delivery count during and after the first real-recipient run.
- Review failure_reason trends for configuration, provider, and unexpected errors.
- Alert on locked rows older than the worker timeout.
- Confirm provider_response records provider=resend on processed rows.
- Dashboard visibility for merchants remains read-only during rollout.

## Rollback Plan

- Set RESEND_ALLOW_REAL_RECIPIENTS=false.
- Set DELIVERY_WORKER_ENABLED=false if needed.
- Stop cron or scheduler if one exists.
- Do not delete audit or delivery rows.
- Investigate failed rows before retrying.

## Deferred Work

- Resend bounce/complaint webhooks.
- Automatic retry dashboard.
- Merchant retry UX.
- Localized polished templates.
- Verified production sending domain automation.
- Zoho ZeptoMail comparison after production learnings.

## Non-Goals

- No cron setup in this document.
- No webhook implementation.
- No UI changes.
- No WhatsApp/SMS/PDF.
- No bulk sending.
- No marketing emails.