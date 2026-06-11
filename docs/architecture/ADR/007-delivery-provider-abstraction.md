# ADR 007 - Delivery Provider Abstraction

- **Status:** Accepted
- **Date:** 2026-06-11
- **Author:** Engineering
- **Supersedes:** None
- **Related:** ADR-002 (Stripe Connect), ADR-003 (Offline Payments), integration-specs/resend-email.md, integration-specs/whatsapp-meta.md

---

## Context

ParaUsted now has the first delivery lifecycle foundation in place:

1. A voucher is issued after payment confirmation.
2. A `delivery_events` row is queued when a voucher is inserted.
3. Merchant voucher history shows delivery channel and status.
4. Buyer voucher detail pages show delivery channel and status.

The next architectural decision is how ParaUsted should actually send delivery messages in the future without coupling checkout, webhook handling, voucher display, or dashboard UI directly to a specific provider such as Resend, WhatsApp Meta, Twilio, or another vendor.

Delivery is business-critical but also failure-prone. Provider APIs can be unavailable, emails can bounce, WhatsApp templates can be rejected, and retries can accidentally duplicate messages if not designed carefully. Delivery also touches personally identifiable information such as recipient email addresses and phone numbers, so GDPR minimisation and auditability are required from the start.

Requirements driving this decision:

1. Delivery sending must not run inside buyer checkout, Stripe webhook processing, or page rendering.
2. The UI must remain read-only for delivery state until explicit retry/resend workflows are designed.
3. Delivery state must remain durable and queryable through `delivery_events`.
4. Provider-specific code must be isolated behind an abstraction.
5. Email is the first practical outbound delivery channel for MVP.
6. WhatsApp and SMS must be possible later without rewriting core delivery orchestration.
7. PDF download is not an outbound provider channel and must be treated separately from email, WhatsApp, or SMS sending.
8. Before real automated sending, the delivery queue must be hardened for retries, locking, and idempotency.

---

## Decision

### 1. Use `delivery_events` as the durable delivery state source

The `delivery_events` table remains the source of truth for delivery lifecycle state.

Current statuses:

```text
queued
sent
delivered
failed
downloaded
```

Current channels:

```text
email
whatsapp
sms
pdf_download
```

The UI reads this state but does not mutate it.

### 2. Delivery sending is worker-owned

Delivery sending must be performed by a background worker or scheduled job, not directly by:

```text
checkout server actions
Stripe webhook handlers
voucher detail pages
merchant dashboard pages
client components
```

The intended flow is:

```text
delivery_events.status = queued
  -> delivery worker selects eligible event
  -> delivery orchestrator loads voucher, purchase, merchant, and locale context
  -> provider factory selects a delivery provider
  -> provider sends the message
  -> delivery_events is updated to sent or failed
```

This prevents slow provider calls from blocking payment confirmation or voucher issuance. It also keeps retry and failure handling outside user-facing request paths.

### 3. Introduce a provider abstraction

ParaUsted will use a delivery provider abstraction instead of calling a concrete provider directly throughout the application.

Conceptual boundary:

```text
DeliveryProvider
  send(input) -> result
```

Provider input should contain only the data needed for delivery, for example:

```text
delivery_event_id
voucher_code
voucher_url
recipient_contact
recipient_name
merchant_name
amount
locale
personal_message
```

Provider result should return:

```text
success
provider_message_id
provider_response
failure_reason
retryable
```

Concrete providers are implementation details behind this boundary.

Initial concrete provider:

```text
EmailProvider
```

Future concrete providers:

```text
WhatsAppProvider
SmsProvider
```

### 4. Email is the first outbound MVP provider

The first real outbound delivery implementation should be email.

Reasons:

1. Email aligns with existing purchase fields: `buyer_email` and `recipient_email`.
2. Email is easier to test safely than WhatsApp or SMS.
3. Email has fewer template-approval and consent constraints than WhatsApp.
4. Email is sufficient for the first buyer delivery loop.
5. Existing architecture already includes `integration-specs/resend-email.md`.

WhatsApp and SMS remain future channels.

### 5. PDF download is not an outbound provider delivery

`pdf_download` must not be treated like email, WhatsApp, or SMS.

It represents buyer readiness/download tracking rather than provider-based outbound sending.

Future behaviour may be:

```text
queued -> downloaded
```

when the buyer opens or downloads the voucher/PDF.

It should not be processed by the outbound delivery provider worker.

### 6. UI remains read-only for now

Merchant dashboard and buyer voucher detail pages may display delivery state, but they must not provide delivery mutations yet.

Deferred UI actions:

```text
resend delivery
retry failed delivery
change recipient contact
manual mark as sent
manual mark as delivered
```

Those actions require separate product, security, and audit decisions.

### 7. Do not send delivery inside Stripe webhook processing

Stripe webhook processing confirms payment and issues vouchers. It must not call email, WhatsApp, or SMS providers directly.

Reason:

1. Stripe webhooks must remain fast and reliable.
2. Provider outages should not cause payment confirmation rollback.
3. Duplicate webhook retries could duplicate delivery messages.
4. Delivery failure must be recoverable independently from payment confirmation.

Webhook responsibility:

```text
confirm payment
issue voucher
queue delivery event
record audit/payment state
```

Delivery worker responsibility:

```text
send delivery
update delivery_events
record provider response
```

### 8. Harden `delivery_events` before production sending

Before enabling real automated provider sending, `delivery_events` should be extended for worker safety.

Recommended future fields:

```text
attempt_count
max_attempts
next_attempt_at
last_attempt_at
locked_at
locked_by
idempotency_key
```

Recommended future index:

```text
status = queued and next_attempt_at <= now()
```

These fields support:

```text
safe retries
worker locking
duplicate-send prevention
scheduled delivery
operational visibility
```

This ADR approves the direction but does not require adding those fields until the worker implementation slice.

---

## Consequences

### Positive

- Payment confirmation and voucher issuance remain fast and reliable.
- Delivery sending can fail independently without corrupting purchase or voucher state.
- Provider-specific code is isolated and replaceable.
- Email can be implemented first without blocking future WhatsApp or SMS support.
- Merchant and buyer UI can continue using `delivery_events` as a simple read model.
- The architecture supports retries, scheduled delivery, and provider observability later.
- GDPR minimisation can be enforced centrally in the delivery orchestrator and provider adapters.

### Negative / Trade-offs

- Real delivery sending requires a worker or scheduled job, adding operational complexity.
- `delivery_events` needs additional retry/locking fields before production sending.
- Delivery status may remain `queued` until a worker is implemented.
- Provider-specific features such as WhatsApp templates, email bounce webhooks, or SMS delivery receipts are deferred.
- The initial abstraction adds structure before there is more than one provider, but this is justified because delivery is a multi-channel product requirement.

---

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Send email directly inside checkout success flow | Blocks buyer request, makes provider failure user-facing, and risks duplicate sends on retries |
| Send delivery directly inside Stripe webhook | Webhook retries can duplicate sends; provider outage should not affect payment confirmation |
| Hardcode Resend calls in voucher issuance RPC/app action | Couples core domain logic to one provider and makes WhatsApp/SMS expansion harder |
| Treat `pdf_download` as an outbound provider channel | Download is buyer-initiated readiness/tracking, not provider sending |
| Implement WhatsApp first | Higher compliance and template complexity; not necessary for MVP delivery loop |
| Add full queue infrastructure immediately | Too much operational complexity for current MVP stage |

---

## Implementation Notes

The future implementation should be split into small slices.

### Slice 1 - Worker-safe delivery queue schema

Add retry and locking fields to `delivery_events`:

```text
attempt_count
max_attempts
next_attempt_at
last_attempt_at
locked_at
locked_by
idempotency_key
```

Add indexes for efficient worker selection.

### Slice 2 - Delivery orchestrator and provider abstraction

Create application-level orchestration that:

```text
loads queued delivery event
loads voucher, purchase, and merchant context
builds provider input
selects provider by channel
updates delivery_events
```

### Slice 3 - Email provider

Implement the first concrete email provider, likely based on the Resend integration spec.

Provider response storage must be minimised and must not store unnecessary PII.

### Slice 4 - Secured worker execution

Choose one MVP worker strategy:

```text
secured Next.js cron endpoint
or Supabase scheduled function
```

The endpoint/function must not be publicly callable without a secret.

### Slice 5 - Observability and retry UX

Later, expose selected delivery details to merchants:

```text
failure reason
attempt count
last attempted time
retry action
```

This is not part of the initial provider implementation.

---

## Security and Privacy Requirements

1. Do not log full recipient email addresses or phone numbers.
2. Mask recipient contact values in application logs.
3. Store only necessary provider response fields.
4. Do not expose provider payloads directly to buyers or merchants.
5. Only backend service role or trusted worker execution should mutate provider delivery state.
6. Merchant RLS may allow reading delivery state for their own merchant, but not arbitrary mutation.
7. Delivery retry/resend actions require separate audit and permission design.
8. Scheduled delivery must respect `purchases.scheduled_delivery_at` when implemented.

---

## Deferred Decisions

The following decisions are intentionally deferred:

1. Exact email provider choice for production.
2. Whether the MVP worker runs as a secured Next.js cron endpoint or Supabase scheduled function.
3. Bounce and complaint webhook handling.
4. WhatsApp provider implementation details.
5. SMS provider implementation details.
6. PDF generation and download tracking behaviour.
7. Merchant-facing resend/retry UX.
8. Delivery audit event types such as `delivery_sent` or `delivery_failed`.

---

## Final Decision

ParaUsted will use a worker-owned delivery orchestration architecture with provider abstractions.

Email is the first outbound provider target. WhatsApp and SMS are deferred. PDF download is treated as readiness/download tracking rather than outbound provider delivery.

No checkout, webhook, voucher page, or dashboard UI path may directly send delivery messages. Real provider sending must wait until `delivery_events` is hardened for retry, locking, scheduled delivery, and idempotency.
