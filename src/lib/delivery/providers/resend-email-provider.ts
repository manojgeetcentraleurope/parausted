import 'server-only';

import { Resend } from 'resend';

import { buildGiftCardDeliveryEmail } from '../email-template';
import type { DeliveryContext } from '../types';
import type { DeliveryProvider, DeliveryProviderResult } from './types';

type ResendErrorLike = {
  name: string;
  statusCode: number | null;
};

function buildProviderResponse(options: {
  realRecipientAllowed: boolean;
  sentToTestRecipient: boolean;
  errorCode?: string;
  statusCode?: number | null;
}): Record<string, unknown> {
  return {
    provider: 'resend',
    mode: 'resend',
    realRecipientAllowed: options.realRecipientAllowed,
    sentToTestRecipient: options.sentToTestRecipient,
    ...(options.errorCode ? { errorCode: options.errorCode } : {}),
    ...(options.statusCode !== undefined && options.statusCode !== null
      ? { statusCode: options.statusCode }
      : {}),
  };
}

function mapResendFailure(error: ResendErrorLike): {
  failureReason: string;
  retryable: boolean;
  retryAfterSeconds?: number;
} {
  switch (error.name) {
    case 'missing_api_key':
    case 'restricted_api_key':
    case 'invalid_api_key':
    case 'invalid_from_address':
    case 'invalid_access':
    case 'security_error':
      return {
        failureReason: 'resend_not_configured',
        retryable: false,
      };
    case 'daily_quota_exceeded':
    case 'monthly_quota_exceeded':
    case 'rate_limit_exceeded':
    case 'concurrent_idempotent_requests':
    case 'application_error':
    case 'internal_server_error':
      return {
        failureReason: 'resend_send_failed',
        retryable: true,
        retryAfterSeconds: 300,
      };
    case 'validation_error':
    case 'invalid_parameter':
    case 'missing_required_field':
    case 'invalid_attachment':
    case 'invalid_idempotency_key':
    case 'invalid_idempotent_request':
    case 'invalid_region':
    case 'not_found':
    case 'method_not_allowed':
      return {
        failureReason: 'resend_send_failed',
        retryable: false,
      };
    default:
      if (error.statusCode === 429 || (error.statusCode !== null && error.statusCode >= 500)) {
        return {
          failureReason: 'resend_send_failed',
          retryable: true,
          retryAfterSeconds: 300,
        };
      }

      return {
        failureReason: 'unexpected_provider_error',
        retryable: true,
        retryAfterSeconds: 300,
      };
  }
}

export class ResendEmailProvider implements DeliveryProvider {
  async send(input: DeliveryContext): Promise<DeliveryProviderResult> {
    if (input.channel !== 'email') {
      return {
        success: false,
        failureReason: 'unsupported_channel',
        retryable: false,
      };
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
    const replyToEmail = process.env.RESEND_REPLY_TO_EMAIL?.trim();
    const realRecipientAllowed = process.env.RESEND_ALLOW_REAL_RECIPIENTS === 'true';
    const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();
    const sentToTestRecipient = !realRecipientAllowed;

    if (!apiKey || !fromEmail) {
      return {
        success: false,
        failureReason: 'resend_not_configured',
        retryable: false,
        providerResponse: buildProviderResponse({
          realRecipientAllowed,
          sentToTestRecipient,
        }),
      };
    }

    if (sentToTestRecipient && !testRecipient) {
      return {
        success: false,
        failureReason: 'resend_test_recipient_required',
        retryable: false,
        providerResponse: buildProviderResponse({
          realRecipientAllowed,
          sentToTestRecipient,
        }),
      };
    }

    const recipient = realRecipientAllowed ? input.recipientContact : testRecipient!;
    const message = buildGiftCardDeliveryEmail(input);
    const resend = new Resend(apiKey);

    try {
      const response = await resend.emails.send(
        {
          from: fromEmail,
          to: recipient,
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(replyToEmail ? { replyTo: replyToEmail } : {}),
        },
        {
          idempotencyKey: input.idempotencyKey,
        },
      );

      if (response.error) {
        const failure = mapResendFailure(response.error);

        return {
          success: false,
          failureReason: failure.failureReason,
          retryable: failure.retryable,
          retryAfterSeconds: failure.retryAfterSeconds,
          providerResponse: buildProviderResponse({
            realRecipientAllowed,
            sentToTestRecipient,
            errorCode: response.error.name,
            statusCode: response.error.statusCode,
          }),
        };
      }

      return {
        success: true,
        providerMessageId: response.data.id,
        providerResponse: buildProviderResponse({
          realRecipientAllowed,
          sentToTestRecipient,
        }),
      };
    } catch {
      return {
        success: false,
        failureReason: 'unexpected_provider_error',
        retryable: true,
        retryAfterSeconds: 300,
        providerResponse: buildProviderResponse({
          realRecipientAllowed,
          sentToTestRecipient,
        }),
      };
    }
  }
}
