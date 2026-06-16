import 'server-only';

import { createHash } from 'node:crypto';

/**
 * Hashes a sensitive token (e.g. a voucher code) for safe logging.
 *
 * Use this before writing anything code-like to `security_events` or logs.
 * Raw voucher codes must never be persisted in logs. SHA-256 is one-way and
 * sufficient for de-duplicating/correlating abuse signals without leaking the
 * underlying value.
 *
 * Returns a lowercase hex digest, or `null` for empty/blank input.
 */
export function hashSensitiveToken(value: string | null | undefined): string | null {
  const normalised = (value ?? '').trim();
  if (normalised.length === 0) {
    return null;
  }
  return createHash('sha256').update(normalised).digest('hex');
}

/**
 * Produces a short, non-reversible fingerprint of a sensitive token for
 * low-cardinality grouping in `security_events.details`. Derived from the
 * full SHA-256 digest, so it never exposes the original value.
 */
export function fingerprintSensitiveToken(value: string | null | undefined): string | null {
  const digest = hashSensitiveToken(value);
  return digest === null ? null : digest.slice(0, 12);
}