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
