# Resend Production Rollout Gate

## Status

State: Not approved for real recipients yet.

The controlled Resend test passed in test-recipient mode only. Production rollout is separate from local or test success.

Current safe state:

- The delivery worker supports DELIVERY_WORKER_MODE=dry_run.
- The delivery worker supports DELIVERY_WORKER_MODE=resend.
- A controlled test-recipient send passed.
- The controlled test used onboarding@resend.dev and test-recipient mode.
- The controlled test produced provider message id 2a10dfce-b1ee-40a2-a499-5bdec9beb7ad.
- RESEND_ALLOW_REAL_RECIPIENTS=false remains required.
- Real customer delivery is not enabled.

## Production Sending Identity

- Provider: Resend.
- Purpose: transactional gift card delivery.
- Recommended From address: ParaUsted <giftcards@send.parausted.com>.
- Acceptable alternative: ParaUsted <no-reply@send.parausted.com>.
- Recommended sending subdomain: send.parausted.com.
- Reason: isolate transactional email reputation from the root domain and make system-generated email intent clear.

## Reply-To Decision

- V1 should use a controlled support inbox such as support@parausted.com.
- Merchant-specific Reply-To may be considered later, but it is deferred because it adds support, abuse, and deliverability complexity.

## Required Production Preconditions

- Resend production domain or sending subdomain is verified.
- SPF is configured.
- DKIM is configured.
- DMARC is configured at least in monitoring mode.
- RESEND_FROM_EMAIL uses the verified production domain or sending subdomain.
- RESEND_REPLY_TO_EMAIL points to a monitored inbox.
- RESEND_API_KEY is stored only server-side.
- DELIVERY_WORKER_SECRET is strong and server-only.
- DELIVERY_WORKER_BATCH_SIZE is conservative for the first rollout, preferably 1.

## DNS And Authentication Setup Gate

- Before any real-recipient rollout, add the Resend production domain or sending subdomain.
- Publish the SPF and DKIM records provided by Resend.
- Verify the domain status in Resend.
- Ensure DMARC exists at least in monitoring mode.
- Recommended initial DMARC policy:

```text
v=DMARC1; p=none; rua=mailto:dmarc-reports@parausted.com;
```

- Move DMARC to quarantine or reject only after successful monitoring.

## Production-Like Test Gate

- Keep DELIVERY_WORKER_MODE=resend.
- Keep RESEND_ALLOW_REAL_RECIPIENTS=false.
- Keep the recipient controlled and internal.
- Confirm provider_response contains all of the following:
  - provider = resend
  - sentToTestRecipient = true
  - realRecipientAllowed = false
- Confirm the production From address is used.
- Confirm email headers show authentication passing where practical.

## Real-Recipient Rollout Gate

Real-recipient sending requires explicit human approval.

RESEND_ALLOW_REAL_RECIPIENTS must remain false until all of the following are complete:

- DNS verification passes.
- A controlled production-domain test passes.
- Product owner approval is recorded.
- The rollback plan is understood.
- The monitoring plan is ready.

Before approval, keep:

```text
RESEND_ALLOW_REAL_RECIPIENTS=false
```

Local or test success does not change this rule.

## First Controlled Real-Recipient Test Plan

1. Choose one known test purchase/voucher.
2. Confirm recipient is internal/friendly or explicitly approved.
3. Set DELIVERY_WORKER_BATCH_SIZE=1.
4. Enable real recipients only for the approved controlled run.
5. Trigger worker once.
6. Verify delivery_events row status and provider_response.
7. Verify recipient received email.
8. Review logs and failed events immediately.
9. Return to RESEND_ALLOW_REAL_RECIPIENTS=false if the rollout is paused.

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

## Rollout Stages

- Stage 0: test-recipient only.
- Stage 1: internal or friendly real recipients only.
- Stage 2: one trusted merchant.
- Stage 3: low-volume production.
- Stage 4: normal production.

## Monitoring Requirements

- Monitor failed delivery count during and after each rollout stage.
- Review failure_reason trends for configuration, provider, and unexpected errors.
- Alert on locked rows older than the worker timeout.
- Confirm provider_response records provider=resend on processed rows.
- Keep the monitored DMARC inbox active.
- Review bounce and complaint signals if available.
- Keep merchant dashboard visibility read-only during rollout.

## Rollback Plan

- Set RESEND_ALLOW_REAL_RECIPIENTS=false.
- Keep DELIVERY_WORKER_MODE=resend or switch to dry_run depending on severity.
- Stop cron or scheduler if one exists.
- Investigate failed, bounced, or complained messages.
- Do not delete delivery_events because they are part of the delivery audit and history.

## Deferred Work

- Resend bounce/complaint webhooks.
- Automatic retry dashboard.
- Merchant retry UX.
- Localized polished templates.
- Verified production sending domain automation.
- Zoho ZeptoMail comparison after production learnings.

## Acceptance Criteria

- [ ] Production sending identity documented.
- [ ] Required production preconditions documented.
- [ ] DNS and authentication gate documented.
- [ ] DMARC monitoring policy documented.
- [ ] Test-recipient-only production-domain test documented.
- [ ] Explicit approval requirement documented.
- [ ] First controlled real-recipient test plan documented.
- [ ] SQL verification queries preserved.
- [ ] Monitoring requirements documented.
- [ ] Rollback plan documented.
- [ ] No app code changed.
- [ ] No real-recipient sending enabled.

## Non-Goals

- No application code changes.
- No environment variable behavior changes.
- No real-recipient enablement.
- No secrets, API keys, or production recipient addresses.
- No marketing email.
- No bulk sending.
