import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { parseBearerToken, resolvePartnerKey, touchPartnerKey } from '@/lib/partner/auth';
import { redeemRequestSchema, voucherCodeSchema } from '@/lib/redemptions/schema';
import { getClientIpFromHeaders } from '@/lib/security/client-ip';
import { fingerprintSensitiveToken, hashSensitiveToken } from '@/lib/security/hash';
import { buildRateLimitKey, checkRateLimit, resolveRetryAfterSeconds } from '@/lib/security/rate-limit';
import { recordSecurityEvent } from '@/lib/security/security-events';
import { supabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Scope a partner token must hold to redeem.
const REQUIRED_SCOPE = 'voucher:redeem';

// Per-key throttle: 60 redemption attempts per minute.
const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 60;
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

// Maps the redemption outcome to an HTTP status. Error strings are stable,
// non-sensitive keys; the partner maps them to their own UI messaging.
const ERROR_STATUS: Record<string, number> = {
  unauthorized: 401,
  forbidden: 403,
  rate_limited: 429,
  invalid_code: 400,
  invalid_request: 400,
  not_found: 404,
  already_redeemed: 409,
  expired: 409,
  voided: 409,
  exchanged: 409,
  not_redeemable: 409,
  already_processed: 409,
  idempotency_conflict: 409,
  invalid_amount: 400,
  amount_exceeds_balance: 409,
  unknown: 500,
};

interface RedeemRpcResult {
  success: boolean;
  error?: string;
  redemption_id?: string;
  voucher_code?: string;
  amount_cents?: number;
  balance_before?: number;
  balance_after?: number;
  status?: string;
  idempotent_replay?: boolean;
}

function derivePartnerRedeemIdempotencyKey(
  merchantId: string,
  rawHeaderKey: string | null,
  partnerReference: string | undefined,
): string | null {
  const headerKey = rawHeaderKey?.trim();
  if (headerKey && headerKey.length > 0) {
    return hashSensitiveToken(`${merchantId}:hdr:${headerKey}`);
  }

  if (partnerReference) {
    return hashSensitiveToken(`${merchantId}:ref:${partnerReference}`);
  }

  return null;
}

function errorResponse(error: string): NextResponse {
  const status = ERROR_STATUS[error] ?? 500;
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * POST /api/partner/vouchers/[code]/redeem
 *
 * Machine-to-machine (M2M) full-balance voucher redemption for trusted partner
 * systems. Authenticated by a bearer partner API token (not a merchant browser
 * session). The token resolves to exactly one merchant server-side; the client
 * never supplies a merchant id. Tenant isolation, atomic balance protection,
 * and append-only redemption/audit writes are enforced by the underlying
 * `redeem_voucher_full_for_merchant` RPC.
 *
 * Optional `Idempotency-Key` header makes retries safe. If no header is
 * provided, callers may send `partnerReference` in the JSON body and the route
 * derives a tenant-scoped internal key from it. Same key + same voucher
 * replays the prior result; same key + different voucher yields a conflict.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const clientIp = getClientIpFromHeaders(request.headers);

  // 1. Authenticate the partner token.
  const token = parseBearerToken(request.headers.get('authorization'));
  if (token === null) {
    await recordSecurityEvent({
      eventType: 'partner_auth_missing',
      endpoint: 'partner_redeem',
      severity: 'warning',
      ipAddress: clientIp,
      autoAction: 'blocked',
    });
    return errorResponse('unauthorized');
  }

  const partnerKey = await resolvePartnerKey(token);
  if (partnerKey === null) {
    await recordSecurityEvent({
      eventType: 'partner_auth_invalid',
      endpoint: 'partner_redeem',
      severity: 'warning',
      ipAddress: clientIp,
      autoAction: 'blocked',
      details: { token_fingerprint: fingerprintSensitiveToken(token) },
    });
    return errorResponse('unauthorized');
  }

  // 2. Authorize the required scope.
  if (!partnerKey.scopes.includes(REQUIRED_SCOPE)) {
    await recordSecurityEvent({
      eventType: 'partner_scope_denied',
      endpoint: 'partner_redeem',
      severity: 'warning',
      merchantId: partnerKey.merchantId,
      ipAddress: clientIp,
      autoAction: 'blocked',
      details: { key_prefix: partnerKey.tokenPrefix, required_scope: REQUIRED_SCOPE },
    });
    return errorResponse('forbidden');
  }

  // 3. Rate limit per key.
  const rateLimitDecision = await checkRateLimit(
    buildRateLimitKey('partner_redemption', partnerKey.id),
    RATE_LIMIT,
    RATE_WINDOW_SECONDS,
  );
  if (rateLimitDecision.enforced && !rateLimitDecision.allowed) {
    await recordSecurityEvent({
      eventType: 'rate_limit_partner_redemption',
      endpoint: 'partner_redeem',
      severity: 'warning',
      merchantId: partnerKey.merchantId,
      ipAddress: clientIp,
      autoAction: 'blocked',
      details: {
        key_prefix: partnerKey.tokenPrefix,
        count: rateLimitDecision.count,
        limit: rateLimitDecision.limit,
      },
    });
    return NextResponse.json(
      { success: false, error: 'rate_limited' },
      {
        status: 429,
        headers: {
          'Retry-After': String(resolveRetryAfterSeconds(rateLimitDecision, RATE_WINDOW_SECONDS)),
        },
      },
    );
  }

  // 4. Validate the voucher code from the URL.
  const { code } = await params;
  const codeResult = voucherCodeSchema.safeParse(code);
  if (!codeResult.success) {
    return errorResponse('invalid_code');
  }

  // 5. Validate the request body.
  let rawBody: unknown = {};
  try {
    const text = await request.text();
    rawBody = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return errorResponse('invalid_request');
  }

  const bodyResult = redeemRequestSchema.safeParse(rawBody);
  if (!bodyResult.success) {
    return errorResponse('invalid_request');
  }

  const rawIdempotencyKey = request.headers.get('idempotency-key');
  if (rawIdempotencyKey !== null && rawIdempotencyKey.trim().length === 0) {
    return errorResponse('invalid_request');
  }
  if (rawIdempotencyKey !== null && rawIdempotencyKey.trim().length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return errorResponse('invalid_request');
  }

  const idempotencyKey = derivePartnerRedeemIdempotencyKey(
    partnerKey.merchantId,
    rawIdempotencyKey,
    bodyResult.data.partnerReference,
  );
  const retrySafe = idempotencyKey !== null;

  // 6. Redeem via the service-role RPC, passing the server-resolved merchant id.
  //    A supplied amount redeems part of the balance; its absence redeems the
  //    full remaining balance. Both paths share tenant scope, atomic locking,
  //    append-only writes, and idempotency semantics.
  const amountCents = bodyResult.data.amountCents;
  const { data, error } =
    amountCents === undefined
      ? await supabaseAdminClient.rpc('redeem_voucher_full_for_merchant', {
          p_merchant_id: partnerKey.merchantId,
          p_voucher_code: codeResult.data,
          p_notes: bodyResult.data.notes ?? null,
          p_actor_id: `partner_api:${partnerKey.tokenPrefix}`,
          p_idempotency_key: idempotencyKey,
        })
      : await supabaseAdminClient.rpc('redeem_voucher_partial_for_merchant', {
          p_merchant_id: partnerKey.merchantId,
          p_voucher_code: codeResult.data,
          p_amount_cents: amountCents,
          p_notes: bodyResult.data.notes ?? null,
          p_actor_id: `partner_api:${partnerKey.tokenPrefix}`,
          p_idempotency_key: idempotencyKey,
        });

  await touchPartnerKey(partnerKey.id);

  if (error) {
    console.error('[partner_redeem] RPC error', { message: error.message });
    return errorResponse('unknown');
  }

  const result = data as RedeemRpcResult;
  if (!result.success) {
    return errorResponse(result.error ?? 'unknown');
  }

  return NextResponse.json(
    {
      success: true,
      voucherCode: result.voucher_code,
      amountCents: result.amount_cents,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
      status: result.status,
      redemptionId: result.redemption_id,
      replay: result.idempotent_replay === true,
      retrySafe,
    },
    { status: 200 },
  );
}
