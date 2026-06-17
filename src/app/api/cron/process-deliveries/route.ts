import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { processQueuedDeliveries } from '@/lib/delivery/delivery-orchestrator';
import { isDeliveryWorkerMode } from '@/lib/delivery/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 50;
const DEFAULT_BATCH_SIZE = 5;

function validateResendWorkerConfig():
  | { ok: true }
  | { ok: false; error: 'resend_not_configured' | 'resend_test_recipient_required' } {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    return { ok: false, error: 'resend_not_configured' };
  }

  const realRecipientAllowed = process.env.RESEND_ALLOW_REAL_RECIPIENTS === 'true';
  const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();

  if (!realRecipientAllowed && !testRecipient) {
    return { ok: false, error: 'resend_test_recipient_required' };
  }

  return { ok: true };
}

function resolveBatchSize(): number {
  let batchSize = DEFAULT_BATCH_SIZE;

  // Prefer cron-specific batch size; fall back to shared env var.
  const cronBatch = parseInt(process.env.DELIVERY_WORKER_CRON_BATCH_SIZE ?? '', 10);
  if (!isNaN(cronBatch)) {
    batchSize = cronBatch;
  } else {
    const envBatch = parseInt(process.env.DELIVERY_WORKER_BATCH_SIZE ?? '', 10);
    if (!isNaN(envBatch)) {
      batchSize = envBatch;
    }
  }

  return Math.min(Math.max(batchSize, MIN_BATCH_SIZE), MAX_BATCH_SIZE);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const enabled = process.env.DELIVERY_WORKER_ENABLED;
  const secret = process.env.CRON_SECRET;
  const mode = process.env.DELIVERY_WORKER_MODE;

  if (enabled !== 'true') {
    return NextResponse.json({ ok: false, error: 'worker_disabled' }, { status: 503 });
  }

  if (!secret) {
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (!mode || !isDeliveryWorkerMode(mode)) {
    return NextResponse.json({ ok: false, error: 'unsupported_worker_mode' }, { status: 400 });
  }

  if (mode === 'resend') {
    const resendConfig = validateResendWorkerConfig();

    if (!resendConfig.ok) {
      return NextResponse.json({ ok: false, error: resendConfig.error }, { status: 503 });
    }
  }

  const batchSize = resolveBatchSize();
  const workerId = randomUUID();

  const summary = await processQueuedDeliveries({ workerId, batchSize, mode });

  return NextResponse.json({ ok: true, mode, ...summary });
}