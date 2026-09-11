import 'server-only';

import { hashSensitiveToken } from '@/lib/security/hash';
import { supabaseAdminClient } from '@/lib/supabase/admin';

// ─── Types ────────────────────────────────────────────────────────

export interface PartnerKey {
  id: string;
  merchantId: string;
  label: string;
  tokenPrefix: string;
  scopes: string[];
}

interface PartnerKeyRow {
  id: string;
  merchant_id: string;
  label: string;
  token_prefix: string;
  scopes: string[] | null;
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Extracts a bearer token from an `Authorization` header value.
 *
 * Returns the raw token, or `null` when the header is missing or malformed.
 */
export function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Resolves a raw partner API token to its owning merchant.
 *
 * Tokens are stored only as SHA-256 hashes, so the lookup hashes the incoming
 * value and matches by hash on an active key. Returns `null` for any unknown,
 * revoked, or malformed token. The merchant id is derived here, server-side —
 * it is never accepted from the client.
 */
export async function resolvePartnerKey(rawToken: string): Promise<PartnerKey | null> {
  const tokenHash = hashSensitiveToken(rawToken);
  if (tokenHash === null) {
    return null;
  }

  const { data, error } = await supabaseAdminClient
    .from('partner_api_keys')
    .select('id, merchant_id, label, token_prefix, scopes')
    .eq('token_hash', tokenHash)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle<PartnerKeyRow>();

  if (error || data === null) {
    return null;
  }

  const { data: merchant, error: merchantError } = await supabaseAdminClient
    .from('merchants')
    .select('id')
    .eq('id', data.merchant_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (merchantError || merchant === null) {
    return null;
  }

  return {
    id: data.id,
    merchantId: data.merchant_id,
    label: data.label,
    tokenPrefix: data.token_prefix,
    scopes: data.scopes ?? [],
  };
}

/**
 * Best-effort update of a key's `last_used_at`. Never throws — redemption must
 * not fail because usage telemetry could not be written.
 */
export async function touchPartnerKey(keyId: string): Promise<void> {
  try {
    await supabaseAdminClient
      .from('partner_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyId);
  } catch {
    // Intentionally swallowed: telemetry must never block the main flow.
  }
}
