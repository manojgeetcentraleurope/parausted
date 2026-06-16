import 'server-only';

import { maskEmail } from '@/lib/utils/mask-email';
import { supabaseAdminClient } from '@/lib/supabase/admin';

import { UNKNOWN_CLIENT_IP } from './client-ip';

export type SecurityEventSeverity = 'info' | 'warning' | 'critical';
export type SecurityEventAutoAction = 'blocked' | 'captcha' | 'flagged' | 'none';

export type SecurityEventInput = {
  /** Stable event type string, e.g. 'rate_limit_purchase'. */
  eventType: string;
  /** Endpoint or action name, e.g. 'createPurchaseAction'. */
  endpoint: string;
  severity: SecurityEventSeverity;
  /** Derived client IP. Defaults to the unknown sentinel when omitted. */
  ipAddress?: string;
  userAgent?: string;
  /** Tenant id when known. Never trusted from client input. */
  merchantId?: string;
  /** Raw email — masked here before persistence. Never store the raw value. */
  email?: string;
  autoAction?: SecurityEventAutoAction;
  /**
   * Structured, non-sensitive context. Callers MUST pre-redact: pass hashed
   * voucher codes (see hashSensitiveToken), never raw codes, secrets, tokens,
   * or full emails.
   */
  details?: Record<string, unknown>;
};

/**
 * Best-effort writes a row to `security_events` using the service-role client.
 *
 * Safety contract:
 * - Never throws. A logging failure must not crash or alter the main request.
 * - Masks emails before storage (PII minimisation).
 * - Persists `details` as-is, so callers are responsible for ensuring no raw
 *   voucher codes, secrets, bearer tokens, or full emails are included.
 *
 * Intended for throttle/abuse signals once flows are wired in slice 8b.10b.
 */
export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const { error } = await supabaseAdminClient.from('security_events').insert({
      event_type: input.eventType,
      endpoint: input.endpoint,
      severity: input.severity,
      ip_address: input.ipAddress ?? UNKNOWN_CLIENT_IP,
      user_agent: input.userAgent ?? null,
      merchant_id: input.merchantId ?? null,
      email: input.email ? maskEmail(input.email) : null,
      auto_action: input.autoAction ?? null,
      details: input.details ?? null,
    });

    if (error) {
      console.error('[security-events] insert failed', {
        eventType: input.eventType,
        message: error.message,
      });
    }
  } catch (err) {
    console.error('[security-events] unexpected failure', {
      eventType: input.eventType,
      message: err instanceof Error ? err.message : 'unknown',
    });
  }
}
