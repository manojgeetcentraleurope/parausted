import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PartnerKey } from '@/lib/partner/auth';
import type { RateLimitDecision } from '@/lib/security/rate-limit';

const parseBearerTokenMock = vi.fn();
const resolvePartnerKeyMock = vi.fn();
const touchPartnerKeyMock = vi.fn();
const checkRateLimitMock = vi.fn();
const recordSecurityEventMock = vi.fn();
const buildRateLimitKeyMock = vi.fn();
const hashSensitiveTokenMock = vi.fn();
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
}));

vi.mock('@/lib/security/security-events', () => ({
  recordSecurityEvent: recordSecurityEventMock,
}));

vi.mock('@/lib/security/hash', () => ({
  fingerprintSensitiveToken: fingerprintSensitiveTokenMock,
  hashSensitiveToken: hashSensitiveTokenMock,
}));

vi.mock('@/lib/security/client-ip', () => ({
  getClientIpFromHeaders: getClientIpFromHeadersMock,
}));

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdminClient: {
    rpc: rpcMock,
  },
}));

const routeModulePromise = import('../route');

function createPartnerKey(overrides: Partial<PartnerKey> = {}): PartnerKey {
  return {
    id: 'partner-key-1',
    merchantId: 'merchant-1',
    label: 'Primary key',
    tokenPrefix: 'pk_live_1234',
    scopes: ['voucher:redeem'],
    ...overrides,
  };
}

function createRateLimitDecision(
  overrides: Partial<RateLimitDecision> = {},
): RateLimitDecision {
  return {
    allowed: true,
    count: 1,
    limit: 60,
    retryAfterSeconds: 0,
    enforced: true,
    ...overrides,
  };
}

function createRequest(options?: {
  authorization?: string;
  idempotencyKey?: string;
  body?: unknown;
}): Request {
  const headers = new Headers();

  if (options?.authorization) {
    headers.set('authorization', options.authorization);
  }

  if (options?.idempotencyKey !== undefined) {
    headers.set('idempotency-key', options.idempotencyKey);
  }

  const body = options?.body === undefined ? undefined : JSON.stringify(options.body);

  return new Request('https://example.test/api/partner/vouchers/PU-123/redeem', {
    method: 'POST',
    headers,
    body,
  });
}

async function invokePost(request: Request): Promise<Response> {
  const { POST } = await routeModulePromise;

  return POST(request as never, {
    params: Promise.resolve({ code: 'PU-123' }),
  });
}

describe('POST /api/partner/vouchers/[code]/redeem', () => {
  beforeEach(() => {
    parseBearerTokenMock.mockReturnValue('partner-token');
    resolvePartnerKeyMock.mockResolvedValue(createPartnerKey());
    checkRateLimitMock.mockResolvedValue(createRateLimitDecision());
    buildRateLimitKeyMock.mockImplementation((scope: string, identifier: string) => `${scope}:${identifier}`);
    hashSensitiveTokenMock.mockImplementation((value: string) => `hash:${value}`);
    fingerprintSensitiveTokenMock.mockImplementation((value: string) => `fingerprint:${value}`);
    getClientIpFromHeadersMock.mockReturnValue('127.0.0.1');
    recordSecurityEventMock.mockResolvedValue(undefined);
    touchPartnerKeyMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        voucher_code: 'PU-123',
        amount_cents: 2500,
        balance_before: 2500,
        balance_after: 0,
        redemption_id: 'redemption-1',
        idempotent_replay: false,
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization is missing', async () => {
    parseBearerTokenMock.mockReturnValue(null);

    const response = await invokePost(createRequest({ body: {} }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'unauthorized' });
    expect(recordSecurityEventMock).toHaveBeenCalledOnce();
    expect(resolvePartnerKeyMock).not.toHaveBeenCalled();
  });

  it('returns 400 when Idempotency-Key is blank', async () => {
    const response = await invokePost(
      createRequest({
        authorization: 'Bearer partner-token',
        idempotencyKey: '   ',
        body: {},
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'invalid_request' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns 400 when Idempotency-Key is longer than 255 characters', async () => {
    const response = await invokePost(
      createRequest({
        authorization: 'Bearer partner-token',
        idempotencyKey: 'x'.repeat(256),
        body: {},
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'invalid_request' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns 400 when partnerReference is invalid', async () => {
    const response = await invokePost(
      createRequest({
        authorization: 'Bearer partner-token',
        body: { partnerReference: 'booking/1001' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'invalid_request' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('maps idempotency_conflict to HTTP 409', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'idempotency_conflict',
      },
      error: null,
    });

    const response = await invokePost(
      createRequest({
        authorization: 'Bearer partner-token',
        body: { partnerReference: 'booking:1001' },
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'idempotency_conflict',
    });
  });

  it('derives a retry-safe idempotency key from partnerReference and surfaces replay', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        success: true,
        voucher_code: 'PU-123',
        amount_cents: 2500,
        balance_before: 2500,
        balance_after: 0,
        redemption_id: 'redemption-1',
        idempotent_replay: true,
      },
      error: null,
    });

    const response = await invokePost(
      createRequest({
        authorization: 'Bearer partner-token',
        body: { partnerReference: 'booking:1001' },
      }),
    );

    expect(rpcMock).toHaveBeenCalledWith('redeem_voucher_full_for_merchant', {
      p_merchant_id: 'merchant-1',
      p_voucher_code: 'PU-123',
      p_notes: null,
      p_actor_id: 'partner_api:pk_live_1234',
      p_idempotency_key: 'hash:merchant-1:ref:booking:1001',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      voucherCode: 'PU-123',
      amountCents: 2500,
      balanceBefore: 2500,
      balanceAfter: 0,
      redemptionId: 'redemption-1',
      replay: true,
      retrySafe: true,
    });
  });

  it('prefers Idempotency-Key over partnerReference', async () => {
    const response = await invokePost(
      createRequest({
        authorization: 'Bearer partner-token',
        idempotencyKey: 'header-key-1',
        body: { partnerReference: 'booking:1001' },
      }),
    );

    expect(hashSensitiveTokenMock).toHaveBeenCalledWith('merchant-1:hdr:header-key-1');
    expect(hashSensitiveTokenMock).not.toHaveBeenCalledWith('merchant-1:ref:booking:1001');
    expect(rpcMock).toHaveBeenCalledWith('redeem_voucher_full_for_merchant', {
      p_merchant_id: 'merchant-1',
      p_voucher_code: 'PU-123',
      p_notes: null,
      p_actor_id: 'partner_api:pk_live_1234',
      p_idempotency_key: 'hash:merchant-1:hdr:header-key-1',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      retrySafe: true,
      replay: false,
    });
  });

  it('returns retrySafe=false when neither Idempotency-Key nor partnerReference is provided', async () => {
    const response = await invokePost(
      createRequest({
        authorization: 'Bearer partner-token',
        body: {},
      }),
    );

    expect(rpcMock).toHaveBeenCalledWith('redeem_voucher_full_for_merchant', {
      p_merchant_id: 'merchant-1',
      p_voucher_code: 'PU-123',
      p_notes: null,
      p_actor_id: 'partner_api:pk_live_1234',
      p_idempotency_key: null,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      retrySafe: false,
      replay: false,
    });
  });
});