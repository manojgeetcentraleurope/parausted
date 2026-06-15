import 'server-only';

import type {
  PlatformAlertEmailInput,
  PlatformAlertPayload,
  RenderedPlatformAlertEmail,
} from './types';

const DEFAULT_RUNBOOK_PATH =
  'docs/operations/payment/refund-conflict-support-runbook.md';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}

function formatAmount(amountCents: number | null, currency: string | null): string {
  if (amountCents === null) {
    return '—';
  }
  const major = (amountCents / 100).toFixed(2);
  return currency ? `${major} ${currency}` : major;
}

function resolveRunbook(input: PlatformAlertEmailInput): string {
  if (input.runbookUrl && input.runbookUrl.trim() !== '') {
    return input.runbookUrl.trim();
  }
  if (input.runbookPath && input.runbookPath.trim() !== '') {
    return input.runbookPath.trim();
  }
  if (input.payload.runbook_path && input.payload.runbook_path.trim() !== '') {
    return input.payload.runbook_path.trim();
  }
  return DEFAULT_RUNBOOK_PATH;
}

/**
 * Whitelisted, safe operational rows rendered into the admin alert email.
 * Only includes non-PII operational identifiers and amounts.
 */
function buildRows(
  input: PlatformAlertEmailInput,
  runbook: string,
): Array<{ label: string; value: string }> {
  const payload: PlatformAlertPayload = input.payload;

  return [
    { label: 'Alert type / rule code', value: formatValue(input.alertType) },
    { label: 'Severity', value: formatValue(input.severity) },
    { label: 'Reference code', value: formatValue(input.referenceCode) },
    { label: 'Platform alert id', value: formatValue(input.alertId) },
    { label: 'Created at', value: formatValue(input.createdAt) },
    { label: 'Refund id', value: formatValue(payload.refund_id) },
    { label: 'Payment intent id', value: formatValue(payload.payment_intent_id) },
    { label: 'Charge id', value: formatValue(payload.charge_id) },
    {
      label: 'Refund amount',
      value: formatAmount(payload.refund_amount_cents, payload.currency),
    },
    { label: 'Refund status', value: formatValue(payload.refund_status) },
    { label: 'Voucher status', value: formatValue(payload.voucher_status) },
    { label: 'Redemption count', value: formatValue(payload.redemption_count) },
    {
      label: 'Fraud flag created at',
      value: formatValue(payload.fraud_flag_created_at),
    },
    { label: 'Runbook', value: runbook },
  ];
}

/**
 * Builds the internal/admin-only platform alert email.
 * Renders only safe, whitelisted operational fields. NEVER includes buyer or
 * recipient PII, phone numbers, voucher codes, personal messages, raw evidence,
 * raw Stripe payloads, secrets, or merchant PII.
 */
export function buildPlatformAlertEmail(
  input: PlatformAlertEmailInput,
): RenderedPlatformAlertEmail {
  const runbook = resolveRunbook(input);
  const rows = buildRows(input, runbook);

  const subject = `[ParaUsted][${input.severity.toUpperCase()}] ${input.alertType} (${formatValue(
    input.referenceCode,
  )})`;

  const htmlRows = rows
    .map(
      (row) =>
        `<tr><td style="padding: 4px 12px 4px 0; font-weight: bold; vertical-align: top;">${escapeHtml(
          row.label,
        )}</td><td style="padding: 4px 0;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');

  const html = [
    '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">',
    '<p><strong>Internal platform alert — do not forward.</strong></p>',
    `<p>A critical operational alert was raised: <strong>${escapeHtml(
      input.alertType,
    )}</strong>.</p>`,
    '<table style="border-collapse: collapse;">',
    htmlRows,
    '</table>',
    '<p>Follow the linked runbook for handling steps.</p>',
    '</div>',
  ].join('');

  const text = [
    'Internal platform alert — do not forward.',
    '',
    `A critical operational alert was raised: ${input.alertType}.`,
    '',
    ...rows.map((row) => `${row.label}: ${row.value}`),
    '',
    'Follow the linked runbook for handling steps.',
  ].join('\n');

  return { subject, html, text };
}
