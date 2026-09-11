import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { parseBearerToken, resolvePartnerKey, touchPartnerKey } from '@/lib/partner/auth';
import { voucherCodeSchema } from '@/lib/redemptions/schema';
import { getClientIpFromHeaders } from '@/lib/security/client-ip';
import { fingerprintSensitiveToken } from '@/lib/security/hash';
import { buildRateLimitKey, checkRateLimit, resolveRetryAfterSeconds } from '@/lib/security/rate-limit';
import { recordSecurityEvent } from '@/lib/security/security-events';
import { supabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_SCOPE = 'voucher:read';
const RATE_LIMIT = 120;
const RATE_WINDOW_SECONDS = 60;

interface VerifyRpcResult {
  success: boolean;
  error?: string;
  eligible?: boolean;
  voucher_code?: string;
  balance_cents?: number;
  status?: string;
  expires_at?: string;
}

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const clientIp = getClientIpFromHeaders(request.headers);
  const token = parseBearerToken(request.headers.get('authorization'));

  if (token === null) {
    await recordSecurityEvent({
      eventType: 'partner_auth_missing',
      endpoint: 'partner_voucher_verify',
      severity: 'warning',
      ipAddress: clientIp,
      autoAction: 'blocked',
    });
    return errorResponse('unauthorized', 401);
  }

  const partnerKey = await resolvePartnerKey(token);
  if (partnerKey === null) {
    await recordSecurityEvent({
      eventType: 'partner_auth_invalid',
      endpoint: 'partner_voucher_verify',
      severity: 'warning',
      ipAddress: clientIp,
      autoAction: 'blocked',
      details: { token_fingerprint: fingerprintSensitiveToken(token) },
    });
    return errorResponse('unauthorized', 401);
  }

  if (!partnerKey.scopes.includes(REQUIRED_SCOPE)) {
    await recordSecurityEvent({
      eventType: 'partner_scope_denied',
      endpoint: 'partner_voucher_verify',
      severity: 'warning',
      merchantId: partnerKey.merchantId,
      ipAddress: clientIp,
      autoAction: 'blocked',
      details: { key_prefix: partnerKey.tokenPrefix, required_scope: REQUIRED_SCOPE },
    });
    return errorResponse('forbidden', 403);
  }

  const rateLimitDecision = await checkRateLimit(
    buildRateLimitKey('partner_voucher_verify', partnerKey.id),
    RATE_LIMIT,
    RATE_WINDOW_SECONDS,
  );
  if (rateLimitDecision.enforced && !rateLimitDecision.allowed) {
    await recordSecurityEvent({
      eventType: 'rate_limit_partner_voucher_verify',
      endpoint: 'partner_voucher_verify',
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

  const { code } = await params;
  const codeResult = voucherCodeSchema.safeParse(code);
  if (!codeResult.success) {
    return errorResponse('invalid_or_not_found', 404);
  }

  const { data, error } = await supabaseAdminClient.rpc('verify_voucher_for_merchant', {
    p_merchant_id: partnerKey.merchantId,
    p_voucher_code: codeResult.data,
  });

  await touchPartnerKey(partnerKey.id);

  if (error) {
    console.error('[partner_voucher_verify] RPC error', { message: error.message });
    return errorResponse('invalid_or_not_found', 404);
  }

  const result = data as VerifyRpcResult;
  if (!result.success || !result.eligible) {
    return errorResponse('invalid_or_not_found', 404);
  }

  return NextResponse.json({
    success: true,
    eligible: true,
    voucherCode: result.voucher_code,
    balanceCents: result.balance_cents,
    status: result.status,
    expiresAt: result.expires_at,
  });
}
