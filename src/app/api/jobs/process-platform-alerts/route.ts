import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { processPlatformAlerts } from '@/lib/platform-alerts/platform-alert-orchestrator';
import { isPlatformAlertWorkerMode } from '@/lib/platform-alerts/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 50;
const DEFAULT_BATCH_SIZE = 5;

function validateResendWorkerConfig():
  | { ok: true }
  | {
      ok: false;
      error:
        | 'resend_not_configured'
        | 'resend_test_recipient_required'
        | 'platform_alert_recipient_not_configured';
    } {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    return { ok: false, error: 'resend_not_configured' };
  }

  const realRecipientAllowed = process.env.RESEND_ALLOW_REAL_RECIPIENTS === 'true';

  if (!realRecipientAllowed) {
    const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();
    if (!testRecipient) {
      return { ok: false, error: 'resend_test_recipient_required' };
    }
    return { ok: true };
  }

  const platformAlertTo = process.env.PLATFORM_ALERT_TO?.trim();
  if (!platformAlertTo) {
    return { ok: false, error: 'platform_alert_recipient_not_configured' };
  }

  return { ok: true };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const enabled = process.env.PLATFORM_ALERT_WORKER_ENABLED;
  const secret = process.env.PLATFORM_ALERT_WORKER_SECRET;
  const mode = process.env.PLATFORM_ALERT_WORKER_MODE;

  if (enabled !== 'true') {
    return NextResponse.json({ ok: false, error: 'worker_disabled' }, { status: 503 });
  }

  if (!secret) {
    return NextResponse.json({ ok: false, error: 'worker_not_configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (!mode || !isPlatformAlertWorkerMode(mode)) {
    return NextResponse.json({ ok: false, error: 'unsupported_worker_mode' }, { status: 400 });
  }

  if (mode === 'resend') {
    const resendConfig = validateResendWorkerConfig();

    if (!resendConfig.ok) {
      return NextResponse.json({ ok: false, error: resendConfig.error }, { status: 503 });
    }
  }

  // Parse batch size: env overrides default; request body can override env.
  let batchSize = DEFAULT_BATCH_SIZE;

  const envBatch = parseInt(process.env.PLATFORM_ALERT_WORKER_BATCH_SIZE ?? '', 10);
  if (!isNaN(envBatch)) {
    batchSize = envBatch;
  }

  try {
    const body: unknown = await request.json();
    if (body !== null && typeof body === 'object' && 'batchSize' in body) {
      const bodyBatch = Number((body as Record<string, unknown>).batchSize);
      if (!isNaN(bodyBatch)) {
        batchSize = bodyBatch;
      }
    }
  } catch {
    // No body or non-JSON body — use env/default batch size.
  }

  batchSize = Math.min(Math.max(batchSize, MIN_BATCH_SIZE), MAX_BATCH_SIZE);

  const workerId = randomUUID();

  const summary = await processPlatformAlerts({ workerId, batchSize, mode });

  return NextResponse.json({ ok: true, mode, ...summary });
}
