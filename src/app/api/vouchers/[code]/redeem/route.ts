import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { redeemVoucherFull } from '@/lib/redemptions/redeem-voucher';
import { redeemRequestSchema, voucherCodeSchema } from '@/lib/redemptions/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Maps the redemption outcome to an HTTP status. Error strings are stable,
// non-sensitive keys consumed by the dashboard UI for localised messaging.
const ERROR_STATUS: Record<string, number> = {
  unauthorized: 401,
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
  unknown: 500,
};

function errorResponse(error: string): NextResponse {
  const status = ERROR_STATUS[error] ?? 500;
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * POST /api/vouchers/[code]/redeem
 *
 * Redeems the full remaining balance of a voucher. Auth, tenant isolation,
 * rate limiting, and atomic balance protection are enforced by the shared
 * redemption helper and the underlying `redeem_voucher_full` RPC.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;

  const codeResult = voucherCodeSchema.safeParse(code);
  if (!codeResult.success) {
    return errorResponse('invalid_code');
  }

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

  const result = await redeemVoucherFull(codeResult.data, bodyResult.data.notes);

  if (!result.success) {
    return errorResponse(result.error ?? 'unknown');
  }

  return NextResponse.json(
    {
      success: true,
      voucherCode: result.voucherCode,
      amountCents: result.amountCents,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter,
      redemptionId: result.redemptionId,
    },
    { status: 200 },
  );
}
