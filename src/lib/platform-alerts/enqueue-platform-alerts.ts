import 'server-only';

import { supabaseAdminClient } from '@/lib/supabase/admin';

import type {
  CriticalFraudFlagRow,
  EnqueuePlatformAlertsOptions,
  EnqueuePlatformAlertsResult,
  PlatformAlertPayload,
} from './types';

const ALERT_RULE_CODE = 'external_refund_after_redemption';
const SOURCE_TYPE = 'fraud_flag';
const RUNBOOK_PATH = 'docs/operations/payment/refund-conflict-support-runbook.md' as const;

const DEFAULT_LIMIT = 25;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

const UNIQUE_VIOLATION_CODE = '23505';

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(limit)));
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function buildPayload(flag: CriticalFraudFlagRow): PlatformAlertPayload {
  const evidence = asRecord(flag.evidence);

  return {
    fraud_flag_id: flag.id,
    rule_code: flag.rule_code,
    severity: flag.severity,
    purchase_id: flag.purchase_id,
    merchant_id: flag.merchant_id,
    reference_code: safeString(evidence.reference_code),
    refund_id: safeString(evidence.refund_id),
    payment_intent_id: safeString(evidence.payment_intent_id),
    charge_id: safeString(evidence.charge_id),
    refund_amount_cents: safeNumber(evidence.refund_amount_cents),
    currency: safeString(evidence.currency),
    refund_status: safeString(evidence.refund_status),
    voucher_status: safeString(evidence.voucher_status),
    redemption_count: safeNumber(evidence.redemption_count),
    fraud_flag_created_at: flag.created_at,
    runbook_path: RUNBOOK_PATH,
  };
}

async function fetchExistingAlertSourceIds(): Promise<string[]> {
  const { data, error } = await supabaseAdminClient
    .from('platform_alerts')
    .select('source_id')
    .eq('source_type', SOURCE_TYPE)
    .eq('alert_type', ALERT_RULE_CODE);

  if (error) {
    throw new Error(
      `enqueuePlatformAlerts: failed to load existing alert source ids: ${error.message}`,
    );
  }

  return (data ?? []).map((row) => row.source_id as string);
}

/**
 * Inserts one platform alert for a fraud flag.
 * Returns 'enqueued' on insert, 'skipped' if the dedup unique index rejects it.
 */
async function insertAlert(flag: CriticalFraudFlagRow): Promise<'enqueued' | 'skipped'> {
  const { error } = await supabaseAdminClient.from('platform_alerts').insert({
    alert_type: flag.rule_code,
    severity: flag.severity,
    source_type: SOURCE_TYPE,
    source_id: flag.id,
    reference_code: safeString(asRecord(flag.evidence).reference_code),
    payload: buildPayload(flag),
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return 'skipped';
    }
    throw new Error(`enqueuePlatformAlerts: failed to insert alert: ${error.message}`);
  }

  return 'enqueued';
}

/**
 * Server-only scanner that enqueues platform/admin alerts for critical
 * external_refund_after_redemption fraud flags. Idempotent via the
 * platform_alerts (source_type, source_id, alert_type) unique index.
 */
export async function enqueuePlatformAlerts(
  options?: EnqueuePlatformAlertsOptions,
): Promise<EnqueuePlatformAlertsResult> {
  const limit = clampLimit(options?.limit);

  const existingSourceIds = await fetchExistingAlertSourceIds();

  let query = supabaseAdminClient
    .from('fraud_flags')
    .select('id, rule_code, severity, purchase_id, merchant_id, evidence, created_at')
    .eq('status', 'open')
    .eq('severity', 'critical')
    .eq('rule_code', ALERT_RULE_CODE);

  if (existingSourceIds.length > 0) {
    query = query.not('id', 'in', `(${existingSourceIds.join(',')})`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`enqueuePlatformAlerts: failed to query fraud_flags: ${error.message}`);
  }

  const flags = (data ?? []) as CriticalFraudFlagRow[];

  let enqueued = 0;
  let skippedExisting = 0;

  for (const flag of flags) {
    const outcome = await insertAlert(flag);
    if (outcome === 'enqueued') {
      enqueued += 1;
    } else {
      skippedExisting += 1;
    }
  }

  return {
    scanned: flags.length,
    enqueued,
    skippedExisting,
  };
}
