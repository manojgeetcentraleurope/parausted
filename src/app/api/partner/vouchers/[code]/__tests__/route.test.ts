import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartnerKey } from '@/lib/partner/auth';
import type { RateLimitDecision } from '@/lib/security/rate-limit';

const parseBearerTokenMock = vi.fn();
const resolvePartnerKeyMock = vi.fn();
const touchPartnerKeyMock = vi.fn();
const checkRateLimitMock = vi.fn();
const recordSecurityEventMock = vi.fn();
const buildRateLimitKeyMock = vi.fn();
const fingerprintSensitiveTokenMock = vi.fn();
const getClientIpFromHeadersMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/lib/partner/auth', () => ({
  parseBearerToken: parseBearerTokenMock,
  resolvePartnerKey: resolvePartnerKeyMock,
  touchPartnerKey: touchPartnerKeyMock,
}));

vi.mock('@/lib/security/rate-limit', () => ({
  buildRateLimitKey: buildRateLimitKeyMock,
  checkRateLimit: checkRateLimitMock,
  resolveRetryAfterSeconds: (
    decision: { retryAfterSeconds: number },
    fallback: number,
  ) => (decision.retryAfterSeconds > 0 ? decision.retryAfterSeconds : fallback),
}));

vi.mock('@/lib/security/security-events', () => ({
  recordSecurityEvent: recordSecurityEventMock,
}));

vi.mock('@/lib/security/hash', () => ({
  fingerprintSensitiveToken: fingerprintSensitiveTokenMock,
}));

vi.mock('@/lib/security/client-ip', () => ({
  getClientIpFromHeaders: getClientIpFromHeadersMock,
}));

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdminClient: { rpc: rpcMock },
}));

const routeModulePromise = import('../route');

function createPartnerKey(overrides: Partial<PartnerKey> = {}): PartnerKey {
  return {
    id: 'partner-key-1',
    merchantId: 'merchant-1',
    label: 'Primary key',
    tokenPrefix: 'pu_partner_1234',
    scopes: ['voucher:read', 'voucher:redeem'],
    ...overrides,
  };
}

function createRateLimitDecision(
  overrides: Partial<RateLimitDecision> = {},
): RateLimitDecision {
  return {
    allowed: true,
    count: 1,
    limit: 120,
    retryAfterSeconds: 0,
    enforced: true,
    ...overrides,
  };
}

function createRequest(authorization = 'Bearer partner-token'): Request {
  return new Request('https://example.test/api/partner/vouchers/PU-123', {
    headers: authorization ? { authorization } : undefined,
  });
}

async function invokeGet(request: Request, code = 'PU-123'): Promise<Response> {
  const { GET } = await routeModulePromise;
  return GET(request as never, { params: Promise.resolve({ code }) });
}

describe('GET /api/partner/vouchers/[code]', () => {
  beforeEach(() => {
    parseBearerTokenMock.mockReturnValue('partner-token');
    resolvePartnerKeyMock.mockResolvedValue(createPartnerKey());
    checkRateLimitMock.mockResolvedValue(createRateLimitDecision());
    buildRateLimitKeyMock.mockImplementation((scope: string, identifier: string) => `${scope}:${identifier}`);
    fingerprintSensitiveTokenMock.mockReturnValue('fingerprint:partner-token');
    getClientIpFromHeadersMock.mockReturnValue('127.0.0.1');
    recordSecurityEventMock.mockResolvedValue(undefined);
    touchPartnerKeyMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        eligible: true,
        voucher_code: 'PU-123',
        balance_cents: 5000,
        status: 'delivered',
        expires_at: '2027-07-13T00:00:00+00:00',
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return eligible voucher data without recipient PII', async () => {
    const response = await invokeGet(createRequest());

    expect(rpcMock).toHaveBeenCalledWith('verify_voucher_for_merchant', {
      p_merchant_id: 'merchant-1',
      p_voucher_code: 'PU-123',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      eligible: true,
      voucherCode: 'PU-123',
      balanceCents: 5000,
      status: 'delivered',
      expiresAt: '2027-07-13T00:00:00+00:00',
    });
  });

  it('should reject a missing bearer token', async () => {
    parseBearerTokenMock.mockReturnValue(null);

    const response = await invokeGet(createRequest(''));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'unauthorized' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('should reject a key without voucher read scope', async () => {
    resolvePartnerKeyMock.mockResolvedValue(createPartnerKey({ scopes: ['voucher:redeem'] }));

    const response = await invokeGet(createRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'forbidden' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('should reject malformed voucher codes before calling the RPC', async () => {
    const response = await invokeGet(createRequest(), 'invalid code');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'invalid_or_not_found',
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('should return the same generic response for an ineligible voucher', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { success: false, error: 'invalid_or_not_found' },
      error: null,
    });

    const response = await invokeGet(createRequest());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'invalid_or_not_found',
    });
  });

  it('should rate limit by partner key before voucher lookup', async () => {
    checkRateLimitMock.mockResolvedValueOnce(
      createRateLimitDecision({ allowed: false, retryAfterSeconds: 45 }),
    );

    const response = await invokeGet(createRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('45');
    await expect(response.json()).resolves.toEqual({ success: false, error: 'rate_limited' });
    expect(recordSecurityEventMock).toHaveBeenCalledOnce();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
