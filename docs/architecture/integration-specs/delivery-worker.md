# Integration Spec: Delivery Worker

## Overview
This spec documents the dry-run delivery worker only. It validates the delivery lifecycle end to end without sending real email. Real email sending is deferred to a future provider implementation.

## Current Status
- Dry-run worker implemented.
- Delivery queue processing is available behind a secured Next.js route.
- Real email sending is intentionally deferred.

## Scope
Included:
- email channel only
- `dry_run` mode only
- secured Next.js route
- service-role Supabase RPC calls
- context loading from `delivery_events`, `vouchers`, `purchases`, and `merchants`
- dry-run provider
- `mark_delivery_event_sent` and `mark_delivery_event_failed` RPCs

Excluded:
- real email
- Resend SDK
- cron or scheduler
- WhatsApp
- SMS
- PDF download tracking
- UI changes
- database changes

## Route
- Method: `POST`
- Path: `/api/jobs/process-deliveries`
- Implementation: `src/app/api/jobs/process-deliveries/route.ts`

## Required Environment Variables
```powershell
DELIVERY_WORKER_ENABLED=true
DELIVERY_WORKER_SECRET=<strong-secret>
DELIVERY_WORKER_MODE=dry_run
DELIVERY_WORKER_BATCH_SIZE=1
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Security
The worker must require this authorization header:

```text
Authorization: Bearer <DELIVERY_WORKER_SECRET>
```

Expected responses:
- disabled -> HTTP 503 `worker_disabled`
- missing secret -> HTTP 503 `worker_not_configured`
- missing or wrong auth -> HTTP 401 `unauthorized`
- unsupported mode -> HTTP 400 `unsupported_worker_mode`

Security rules:
- `recipient_contact` must not be returned in JSON responses.
- `recipient_contact` must not appear in logs.
- Responses should stay generic and avoid leaking delivery payload details.

## Delivery Lifecycle
1. POST the worker route.
2. Validate the enabled flag.
3. Validate the worker secret.
4. Validate `dry_run` mode.
5. Claim queued email events using `claim_queued_delivery_events`.
6. Load delivery context from `delivery_events`, `vouchers`, `purchases`, and `merchants`.
7. Call `DryRunEmailProvider`.
8. Mark the event sent with `mark_delivery_event_sent` or failed with `mark_delivery_event_failed`.
9. Return a processing summary.

The dry-run provider must not call a real email API.

## Dry-Run Warning
Dry-run does not send real email, but successful processing can still update database rows:

```text
delivery_events.status = sent
provider_message_id = dry-run:<delivery_event_id>
sent_at = now()
locked_at = null
locked_by = null
```

Do not run this worker on production-like data unless that behavior is intentional.

## Manual Test Plan
### Disabled worker test
```powershell
$env:DELIVERY_WORKER_ENABLED = "false"
$env:DELIVERY_WORKER_SECRET = "local-worker-secret"
$env:DELIVERY_WORKER_MODE = "dry_run"
$env:DELIVERY_WORKER_BATCH_SIZE = "1"
$env:NEXT_PUBLIC_APP_URL = "http://localhost:3001"

Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/jobs/process-deliveries" -Headers @{ Authorization = "Bearer local-worker-secret" }
```

Expected result: HTTP 503 `worker_disabled`.

### Unauthorized worker test
```powershell
$env:DELIVERY_WORKER_ENABLED = "true"
$env:DELIVERY_WORKER_SECRET = "local-worker-secret"
$env:DELIVERY_WORKER_MODE = "dry_run"
$env:DELIVERY_WORKER_BATCH_SIZE = "1"
$env:NEXT_PUBLIC_APP_URL = "http://localhost:3001"

Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/jobs/process-deliveries" -Headers @{ Authorization = "Bearer wrong-secret" }
```

Expected result: HTTP 401 `unauthorized`.

### Optional authorized dry-run processing test
```powershell
$env:DELIVERY_WORKER_ENABLED = "true"
$env:DELIVERY_WORKER_SECRET = "local-worker-secret"
$env:DELIVERY_WORKER_MODE = "dry_run"
$env:DELIVERY_WORKER_BATCH_SIZE = "1"
$env:NEXT_PUBLIC_APP_URL = "http://localhost:3001"

Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/jobs/process-deliveries" -Headers @{ Authorization = "Bearer local-worker-secret" }
```

Expected result: the worker processes at most one queued email event and returns a processing summary.

## SQL Verification
Use this query to verify dry-run activity:

```sql
SELECT id, status, provider_message_id, sent_at, locked_at, locked_by
FROM delivery_events
WHERE provider_message_id LIKE 'dry-run:%'
ORDER BY sent_at DESC;
```

## Future Work
- real Resend provider
- cron or scheduler
- retry observability
- merchant retry UX
- WhatsApp provider
- SMS provider
- PDF download tracking

## Non-Goals
- no real email
- no Resend
- no self-scheduling
- no WhatsApp
- no SMS
- no PDF download tracking
- no merchant retry controls
- no exposing `recipient_contact`
