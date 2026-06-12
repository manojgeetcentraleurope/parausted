# Resend Controlled Test Checklist

## Controlled Test Result - 2026-06-12

Result: Passed.

Evidence:
- Worker mode: resend
- Real recipients allowed: false
- Sent to test recipient: true
- Provider: Resend
- Provider message id: 2a10dfce-b1ee-40a2-a499-5bdec9beb7ad
- Delivery event status: sent
- Email received in internal test mailbox
- Voucher code rendered correctly
- Voucher link rendered correctly

Notes:
- From address used Resend test sender: onboarding@resend.dev
- Production rollout still requires verified ParaUsted sending domain.
- Do not enable RESEND_ALLOW_REAL_RECIPIENTS=true until production rollout gate is approved.

## Status

- Draft: follow these steps in a controlled test environment only.

## Preconditions

- You have a local or staging environment connected to the same schema used by the delivery worker.
- The delivery worker supports mode `resend` and the `ResendEmailProvider` is available.
- The following RPCs exist: `claim_queued_delivery_events`, `mark_delivery_event_sent`, `mark_delivery_event_failed`.
- Do not modify source code, migrations, or environment files as part of this test.

## Environment Variables

Set these variables in the test environment only. Do not enable real recipients by default.

- `DELIVERY_WORKER_MODE=resend`
- `RESEND_ALLOW_REAL_RECIPIENTS=false`  # safety gate; keep false unless approved for production rollout
- `RESEND_TEST_RECIPIENT=your.internal@test.example.com`  # Mailbox controlled by the team for verification
- `DELIVERY_WORKER_BATCH_SIZE=1`  # process a single queued event for the test

Optional (confirm before use):
- `RESEND_API_KEY` or other provider credentials needed for Resend. Use staging credentials when available.

## Safety Rules

- Do not send to real customers by default. Keep `RESEND_ALLOW_REAL_RECIPIENTS=false` at all times during testing.
- Use `RESEND_TEST_RECIPIENT` for all outbound messages during the test.
- Use `DELIVERY_WORKER_BATCH_SIZE=1` to limit impact to a single delivery event.
- Confirm the queued delivery event is a test-targeted event (recipient_contact set to the test recipient) before starting the worker.
- Do not change `RESEND_ALLOW_REAL_RECIPIENTS` to true unless an explicit production rollout decision exists and appropriate approvals are recorded.

## Test Steps

1. Prepare a single queued delivery event that targets the test recipient:
   - Insert or identify a `delivery_events` row where `status = 'queued'` and `recipient_contact` equals the `RESEND_TEST_RECIPIENT` value.
   - Note the `id` and `queued_at` for later verification.

2. Confirm environment variables:
   - `DELIVERY_WORKER_MODE` is set to `resend`.
   - `RESEND_ALLOW_REAL_RECIPIENTS=false`.
   - `RESEND_TEST_RECIPIENT` is set to the test mailbox.
   - `DELIVERY_WORKER_BATCH_SIZE=1`.

3. Start the delivery worker in the test environment.
   - Run the worker process or job runner used by the project with the variables above.

4. Observe worker output and provider logs.
   - The worker should claim one queued event (batch size 1) via `claim_queued_delivery_events`.
   - The worker should attempt to send the message via `ResendEmailProvider` to the `RESEND_TEST_RECIPIENT`.

5. Confirm a successful result.
   - On success the worker should call `mark_delivery_event_sent` for the event id.
   - The `delivery_events` row should transition from `queued` to `sent` and `sent_at` should be populated.

6. If the send fails, the worker should call `mark_delivery_event_failed` and record `failure_reason` and `failed_at`.

7. Stop the worker and collect logs for audit.

## SQL Verification

Use these SQL queries to verify the test outcome. Replace `:id` and `:merchant_id` with actual values.

- Confirm the queued event existed prior to running the worker:

  SELECT id, purchase_id, voucher_id, merchant_id, channel, recipient_contact, status, queued_at
  FROM delivery_events
  WHERE id = ':id';

- After the test, verify the status moved to sent and `sent_at` is set:

  SELECT id, status, provider_message_id, provider_response, sent_at, delivered_at, failed_at, failure_reason
  FROM delivery_events
  WHERE id = ':id';

- Quick checks for merchant-scoped results:

  -- queued events for merchant
  SELECT count(*) FROM delivery_events
  WHERE merchant_id = ':merchant_id' AND status = 'queued';

  -- recently sent events for merchant
  SELECT id, recipient_contact, sent_at, provider_message_id
  FROM delivery_events
  WHERE merchant_id = ':merchant_id' AND status = 'sent'
  ORDER BY sent_at DESC
  LIMIT 10;

Notes:
- A successful controlled test will show exactly one event transitioned from `queued` to `sent` for the test id.
- If `failure_reason` is populated, treat this as a failed test and follow rollback/repair notes.

## Rollback / Repair Notes

- If a test mistakenly targeted a real recipient, immediately:
  1. Stop the worker.
 2. Revoke or rotate any staging provider credentials if they were leaked.
 3. Insert an `audit_event` explaining the accidental send and notify the product and legal teams per incident procedures.

- If the delivery event status is `failed`, inspect `provider_response` and `failure_reason` for guidance, then re-run the test against a corrected queued event.

## Production Rollout Gate

- Never set `RESEND_ALLOW_REAL_RECIPIENTS=true` unless a documented production rollout decision exists.
- Production rollout checklist must include:
  - Security review of provider credentials and access controls.
  - A plan for monitoring and alerting for failed sends and delivery complaints.
  - Communication plan for merchants if behavior changes.

## Non-Goals

- This checklist does not cover bulk sending, performance testing, or end-to-end merchant billing flows.
- This is not a production rollout plan. It is only a controlled, single-event test checklist.
