# Integration Spec: Resend Email Provider

## Status
- Decision approved for the first real gift-card delivery email provider.
- Scope is documentation only.
- No code, dependency, environment, or database changes are included in this spec update.

## Scope
Included:
- gift-card delivery email only
- first real provider implementation target
- provider request and result expectations
- domain and webhook setup expectations
- privacy, logging, and testing guidance for delivery email

Excluded:
- buyer receipts
- merchant notifications
- password reset email
- magic link email
- WhatsApp or SMS delivery
- package installation
- environment file changes
- database migrations
- production rollout steps beyond email delivery setup

## Architecture
The existing delivery flow should keep the same high-level shape:
1. The delivery worker claims a queued email `delivery_event`.
2. Delivery context is loaded from existing purchase, voucher, merchant, and delivery records.
3. A `DeliveryProvider` implementation for Resend builds and sends one gift-card delivery email.
4. The provider returns a normalized result to the delivery worker.
5. The delivery worker updates the `delivery_events` row through the existing success and failure RPCs.

Design constraints:
- Resend must be used only behind the `DeliveryProvider` abstraction.
- Provider-specific request and response details must not leak into worker orchestration logic.
- Gift-card delivery remains the only email flow in scope for the first provider implementation.
- Webhook handling should be treated as a provider integration concern, not a reason to couple business logic to Resend.

## Provider Choice Notes
Resend is chosen first because it offers good developer speed, a strong Next.js and TypeScript fit, a simple API and SDK, webhook support, and a straightforward testing workflow.

Zoho ZeptoMail remains a valid future alternative, especially if cost efficiency and transactional-only positioning become stronger priorities.

The `DeliveryProvider` abstraction keeps the provider choice reversible. Long-term provider choice should be revisited after price, deliverability, support, and operational experience are compared in production-like usage.

## Required Environment Variables
The first real provider implementation is expected to require these environment variables:

```powershell
RESEND_API_KEY=<server-only-api-key>
RESEND_AUDIENCE_ID=<optional-if-later-needed>
EMAIL_FROM_ADDRESS=regalos@parausted.es
EMAIL_FROM_NAME=ParaUsted
EMAIL_REPLY_TO=support@parausted.es
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

Notes:
- `RESEND_API_KEY` must remain server-only.
- `EMAIL_FROM_ADDRESS` must use a verified sending domain.
- `RESEND_AUDIENCE_ID` is optional and not required for gift-card delivery, but it may appear later if contact workflows are introduced.

## Domain Setup
Before real delivery is enabled:
1. Create a Resend account for the project.
2. Verify the sending domain that will be used for gift-card delivery.
3. Add the required DNS records for SPF and DKIM.
4. Add DMARC according to the project domain policy.
5. Confirm that the chosen `from` address is authorized for the verified domain.
6. Configure a webhook endpoint for delivery status events if webhook-based status reconciliation is enabled.

Operational notes:
- Start with a dedicated transactional sender identity for gift-card delivery.
- Avoid using shared personal inbox addresses as the sender.
- Keep webhook secrets server-only and separate from the send API key.

## Gift Card Delivery Email
Trigger:
- purchase has been confirmed
- voucher has been issued
- delivery method is email
- queued `delivery_event` channel is email

Minimum message requirements:
- recipient email address
- localized subject
- merchant display name
- buyer display name when available
- recipient display name when available
- personal message when available
- voucher code or secure voucher access URL, based on the delivery template design
- clear redemption or access call to action
- support reply path

Rendering rules:
- Keep templates focused on voucher delivery, not general marketing.
- Use merchant branding only from trusted stored data.
- Do not include internal identifiers that are not needed by the recipient.
- Avoid exposing raw database IDs, internal status values, or operational metadata.

Failure handling expectations:
- transient provider failures should return a retryable normalized failure
- permanent validation failures should return a non-retryable normalized failure
- the worker remains responsible for recording the normalized outcome on `delivery_events`

## Provider Result Mapping
The Resend provider should map raw provider responses into a provider-agnostic result shape.

Expected normalized success fields:
- `ok = true`
- `provider = resend`
- `provider_message_id`
- `submitted_at` when available

Expected normalized failure fields:
- `ok = false`
- `provider = resend`
- `error_code`
- `error_category`
- `retryable`
- `safe_message`

Suggested category mapping:
- invalid recipient address -> validation / non-retryable
- missing sender authorization -> configuration / non-retryable
- rate limited -> provider / retryable
- timeout or network failure -> transport / retryable
- provider 5xx response -> provider / retryable
- rejected request due to malformed payload -> validation / non-retryable

The worker should persist only the normalized outcome plus a safe provider message identifier. Raw provider payloads should not be stored unless there is a separate approved audit need.

## Privacy and Logging
Privacy rules:
- do not log full recipient email addresses
- do not log full voucher codes
- do not log personal messages in plain text
- do not log provider secrets, webhook secrets, or auth headers

Logging rules:
- mask recipient email addresses
- mask voucher codes
- include `delivery_event_id`, `merchant_id`, provider name, and safe error category in structured logs
- keep user-facing error messages generic
- keep provider-specific details in server logs only when needed for diagnosis and safe to retain

Data minimization:
- send only the fields required to render and deliver the gift-card email
- do not send unnecessary buyer or recipient profile data to the provider

## Testing Strategy
The first implementation should be validated in layers:

1. Unit tests for the Resend provider request builder and normalized result mapping.
2. Unit tests for retryable versus non-retryable error classification.
3. Integration tests that mock Resend responses for success, validation failure, rate limiting, and provider failure.
4. Manual staging tests that verify domain setup, sender identity, email rendering, and webhook delivery status handling.
5. End-to-end delivery worker verification using a real queued email event in a non-production environment.

Testing expectations:
- use provider sandbox or test-safe recipients when available
- verify that logs mask recipient and voucher data
- verify that a successful send writes only the normalized provider identifier and safe delivery metadata
- verify that permanent failures do not loop indefinitely

## Future Work
- implement the actual Resend-backed `DeliveryProvider`
- define the exact normalized provider result TypeScript types
- add webhook signature verification and status reconciliation rules
- add localized email templates for Spanish and English gift-card delivery
- compare Resend against Zoho ZeptoMail on cost, deliverability, support, and operational overhead
- decide later whether buyer receipts or merchant notifications should reuse the same provider implementation
