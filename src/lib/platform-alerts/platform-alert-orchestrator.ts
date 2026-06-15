import 'server-only';

import { supabaseAdminClient } from '@/lib/supabase/admin';

import { AdminAlertMailer } from './admin-alert-mailer';
import { enqueuePlatformAlerts } from './enqueue-platform-alerts';
import type {
  AlertSeverity,
  ClaimedPlatformAlert,
  PlatformAlertEmailInput,
  PlatformAlertPayload,
  PlatformAlertWorkerMode,
  PlatformAlertWorkerSummary,
  ProcessPlatformAlertResult,
} from './types';

const LOCK_TIMEOUT_SECONDS = 900;
const DEFAULT_RETRY_AFTER_SECONDS = 300;
const DEFAULT_RUNBOOK_PATH =
  'docs/operations/payment/refund-conflict-support-runbook.md';

const ALERT_SEVERITIES: readonly AlertSeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function coerceSeverity(value: string): AlertSeverity {
  return ALERT_SEVERITIES.includes(value as AlertSeverity)
    ? (value as AlertSeverity)
    : 'critical';
}

/**
 * Defensively narrows the JSONB payload from a claimed alert into the safe,
 * whitelisted PlatformAlertPayload shape. Unknown fields are dropped.
 */
function coercePayload(value: unknown, severity: AlertSeverity): PlatformAlertPayload {
  const record = asRecord(value);
  const runbookPath = safeString(record.runbook_path) ?? DEFAULT_RUNBOOK_PATH;

  return {
    fraud_flag_id: safeString(record.fraud_flag_id) ?? '',
    rule_code: safeString(record.rule_code) ?? '',
    severity: coerceSeverity(safeString(record.severity) ?? severity),
    purchase_id: safeString(record.purchase_id),
    merchant_id: safeString(record.merchant_id),
    reference_code: safeString(record.reference_code),
    refund_id: safeString(record.refund_id),
    payment_intent_id: safeString(record.payment_intent_id),
    charge_id: safeString(record.charge_id),
    refund_amount_cents: safeNumber(record.refund_amount_cents),
    currency: safeString(record.currency),
    refund_status: safeString(record.refund_status),
    voucher_status: safeString(record.voucher_status),
    redemption_count: safeNumber(record.redemption_count),
    fraud_flag_created_at: safeString(record.fraud_flag_created_at) ?? '',
    runbook_path:
      runbookPath as PlatformAlertPayload['runbook_path'],
  };
}

function buildEmailInput(alert: ClaimedPlatformAlert): PlatformAlertEmailInput {
  const severity = coerceSeverity(alert.severity);
  const payload = coercePayload(alert.payload, severity);

  return {
    alertId: alert.platform_alert_id,
    alertType: alert.alert_type,
    severity,
    referenceCode: alert.reference_code,
    payload,
    createdAt: payload.fraud_flag_created_at,
    runbookPath: payload.runbook_path,
  };
}

const DRY_RUN_PROVIDER_RESPONSE: Record<string, unknown> = {
  provider: 'dry_run',
  mode: 'platform_alert',
  sent: false,
};

/**
 * Server-only orchestrator for the platform/admin alert worker.
 * Enqueues critical fraud-flag alerts, claims a batch, and either dry-runs or
 * sends each via AdminAlertMailer. Idempotent and isolated from the Stripe
 * webhook and voucher delivery pipeline.
 */
export async function processPlatformAlerts(options: {
  workerId: string;
  batchSize: number;
  mode: PlatformAlertWorkerMode;
}): Promise<PlatformAlertWorkerSummary> {
  const { workerId, batchSize, mode } = options;

  const enqueueResult = await enqueuePlatformAlerts({ limit: batchSize });

  const { data: claimedRows, error: claimError } = await supabaseAdminClient.rpc(
    'claim_queued_platform_alerts',
    {
      p_worker_id: workerId,
      p_batch_size: batchSize,
      p_lock_timeout_seconds: LOCK_TIMEOUT_SECONDS,
    },
  );

  if (claimError) {
    console.error('[platform-alert-orchestrator] Failed to claim alerts', {
      workerId,
      error: claimError.message,
    });
    return {
      enqueued: enqueueResult.enqueued,
      claimed: 0,
      processed: 0,
      sent: 0,
      failed: 1,
      retryScheduled: 0,
      results: [
        { platformAlertId: 'batch', ok: false, status: 'failed', error: 'claim_failed' },
      ],
    };
  }

  const claimed = (claimedRows as ClaimedPlatformAlert[] | null) ?? [];
  const mailer = mode === 'resend' ? new AdminAlertMailer() : null;
  const results: ProcessPlatformAlertResult[] = [];
  let sent = 0;
  let failed = 0;
  let retryScheduled = 0;

  for (const alert of claimed) {
    const platformAlertId = alert.platform_alert_id;

    try {
      if (mode === 'dry_run') {
        const outcome = await markSent(workerId, platformAlertId, null, DRY_RUN_PROVIDER_RESPONSE);
        if (outcome.ok) {
          sent++;
          results.push({ platformAlertId, ok: true, status: 'sent' });
        } else {
          failed++;
          results.push({ platformAlertId, ok: false, status: 'failed', error: outcome.error });
        }
        continue;
      }

      const input = buildEmailInput(alert);
      const sendResult = await mailer!.send(input);

      if (sendResult.success) {
        const outcome = await markSent(
          workerId,
          platformAlertId,
          sendResult.providerMessageId ?? null,
          sendResult.providerResponse ?? null,
        );
        if (outcome.ok) {
          sent++;
          results.push({
            platformAlertId,
            ok: true,
            status: 'sent',
            providerMessageId: sendResult.providerMessageId,
          });
        } else {
          failed++;
          results.push({ platformAlertId, ok: false, status: 'failed', error: outcome.error });
        }
        continue;
      }

      const outcome = await markFailed(workerId, platformAlertId, {
        failureReason: sendResult.failureReason,
        retryable: sendResult.retryable,
        retryAfterSeconds: sendResult.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
        providerResponse: sendResult.providerResponse ?? null,
      });

      if (outcome.status === 'retry_scheduled') {
        retryScheduled++;
        results.push({
          platformAlertId,
          ok: false,
          status: 'retry_scheduled',
          error: sendResult.failureReason,
        });
      } else {
        failed++;
        results.push({
          platformAlertId,
          ok: false,
          status: 'failed',
          error: outcome.status === 'failed' ? sendResult.failureReason : outcome.error,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unexpected_worker_error';
      console.error('[platform-alert-orchestrator] Unexpected error processing alert', {
        platformAlertId,
        error: message,
      });

      const outcome = await markFailed(workerId, platformAlertId, {
        failureReason: 'unexpected_worker_error',
        retryable: true,
        retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS,
        providerResponse: {
          provider: 'platform_alert_worker',
          mode: 'unexpected_error',
        },
      });

      if (outcome.status === 'retry_scheduled') {
        retryScheduled++;
        results.push({
          platformAlertId,
          ok: false,
          status: 'retry_scheduled',
          error: 'unexpected_worker_error',
        });
      } else {
        failed++;
        results.push({
          platformAlertId,
          ok: false,
          status: 'failed',
          error: outcome.status === 'failed' ? 'unexpected_worker_error' : outcome.error,
        });
      }
    }
  }

  return {
    enqueued: enqueueResult.enqueued,
    claimed: claimed.length,
    processed: results.length,
    sent,
    failed,
    retryScheduled,
    results,
  };
}

async function markSent(
  workerId: string,
  platformAlertId: string,
  providerMessageId: string | null,
  providerResponse: Record<string, unknown> | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdminClient.rpc('mark_platform_alert_sent', {
    p_platform_alert_id: platformAlertId,
    p_worker_id: workerId,
    p_provider_message_id: providerMessageId,
    p_provider_response: providerResponse,
  });

  if (error || !(data as { success?: boolean } | null)?.success) {
    console.error('[platform-alert-orchestrator] mark_platform_alert_sent RPC failed', {
      platformAlertId,
      error: error?.message,
    });
    return { ok: false, error: 'mark_sent_failed' };
  }

  return { ok: true };
}

async function markFailed(
  workerId: string,
  platformAlertId: string,
  failure: {
    failureReason: string;
    retryable: boolean;
    retryAfterSeconds: number;
    providerResponse: Record<string, unknown> | null;
  },
): Promise<
  | { status: 'retry_scheduled' }
  | { status: 'failed' }
  | { status: 'mark_failed'; error: string }
> {
  const { data, error } = await supabaseAdminClient.rpc('mark_platform_alert_failed', {
    p_platform_alert_id: platformAlertId,
    p_worker_id: workerId,
    p_failure_reason: failure.failureReason,
    p_retryable: failure.retryable,
    p_retry_after_seconds: failure.retryAfterSeconds,
    p_provider_response: failure.providerResponse,
  });

  const result = data as { success?: boolean; outcome?: string } | null;

  if (error || !result?.success) {
    console.error('[platform-alert-orchestrator] mark_platform_alert_failed RPC failed', {
      platformAlertId,
      error: error?.message,
    });
    return { status: 'mark_failed', error: 'mark_failed_failed' };
  }

  return result.outcome === 'retry_scheduled'
    ? { status: 'retry_scheduled' }
    : { status: 'failed' };
}
