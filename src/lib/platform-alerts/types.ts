import 'server-only';

/**
 * Severity values shared by fraud_flags and platform_alerts.
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Minimal fraud_flag shape consumed by the enqueue scanner.
 * evidence is untyped JSONB and must be read defensively.
 */
export interface CriticalFraudFlagRow {
  id: string;
  rule_code: string;
  severity: AlertSeverity;
  purchase_id: string | null;
  merchant_id: string | null;
  evidence: unknown;
  created_at: string;
}

/**
 * Safe, whitelisted operational payload stored on platform_alerts.payload.
 * NEVER contains raw evidence, PII, voucher codes, or raw Stripe payloads.
 */
export interface PlatformAlertPayload {
  fraud_flag_id: string;
  rule_code: string;
  severity: AlertSeverity;
  purchase_id: string | null;
  merchant_id: string | null;
  reference_code: string | null;
  refund_id: string | null;
  payment_intent_id: string | null;
  charge_id: string | null;
  refund_amount_cents: number | null;
  currency: string | null;
  refund_status: string | null;
  voucher_status: string | null;
  redemption_count: number | null;
  fraud_flag_created_at: string;
  runbook_path: 'docs/operations/payment/refund-conflict-support-runbook.md';
}

/**
 * Result summary returned by enqueuePlatformAlerts.
 */
export interface EnqueuePlatformAlertsResult {
  scanned: number;
  enqueued: number;
  skippedExisting: number;
}

export interface EnqueuePlatformAlertsOptions {
  limit?: number;
}

/**
 * Input consumed by the admin alert email template and mailer.
 * Contains only safe, whitelisted operational fields. NEVER buyer/recipient
 * PII, voucher codes, raw evidence, or raw Stripe payloads.
 */
export interface PlatformAlertEmailInput {
  alertId: string;
  alertType: string;
  severity: AlertSeverity;
  referenceCode: string | null;
  payload: PlatformAlertPayload;
  createdAt: string;
  /** Absolute runbook URL, when configured via env. */
  runbookUrl?: string | null;
  /** Repository-relative runbook path fallback. */
  runbookPath?: string | null;
}

/**
 * Rendered admin alert email content.
 */
export interface RenderedPlatformAlertEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Result returned by AdminAlertMailer.send.
 */
export type AdminAlertMailerResult =
  | {
      success: true;
      providerMessageId?: string;
      providerResponse?: Record<string, unknown>;
    }
  | {
      success: false;
      failureReason: string;
      retryable: boolean;
      retryAfterSeconds?: number;
      providerResponse?: Record<string, unknown>;
    };

/**
 * Worker modes for the platform alert orchestrator.
 * Kept separate from the delivery worker mode to avoid coupling.
 */
export const PLATFORM_ALERT_WORKER_MODES = ['dry_run', 'resend'] as const;

export type PlatformAlertWorkerMode = (typeof PLATFORM_ALERT_WORKER_MODES)[number];

export function isPlatformAlertWorkerMode(
  value: string,
): value is PlatformAlertWorkerMode {
  return PLATFORM_ALERT_WORKER_MODES.includes(value as PlatformAlertWorkerMode);
}

/**
 * Row shape returned by the claim_queued_platform_alerts RPC.
 * payload is JSONB and must be narrowed defensively.
 */
export interface ClaimedPlatformAlert {
  platform_alert_id: string;
  alert_type: string;
  severity: string;
  source_type: string;
  source_id: string;
  reference_code: string | null;
  payload: unknown;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string;
  locked_at: string;
  locked_by: string;
}

/**
 * Per-alert outcome from the platform alert worker.
 */
export interface ProcessPlatformAlertResult {
  platformAlertId: string;
  ok: boolean;
  status: 'sent' | 'failed' | 'retry_scheduled';
  providerMessageId?: string;
  error?: string;
}

/**
 * Summary returned by processPlatformAlerts.
 */
export interface PlatformAlertWorkerSummary {
  enqueued: number;
  claimed: number;
  processed: number;
  sent: number;
  failed: number;
  retryScheduled: number;
  results: ProcessPlatformAlertResult[];
}
