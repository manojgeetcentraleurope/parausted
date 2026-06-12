import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { processQueuedDeliveries } from '@/lib/delivery/delivery-orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 50;
const DEFAULT_BATCH_SIZE = 5;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const enabled = process.env.DELIVERY_WORKER_ENABLED;
  const secret = process.env.DELIVERY_WORKER_SECRET;
  const mode = process.env.DELIVERY_WORKER_MODE;

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

  if (mode !== 'dry_run') {
    return NextResponse.json({ ok: false, error: 'unsupported_worker_mode' }, { status: 400 });
  }

  // Parse batch size: env overrides default; request body can override env.
  let batchSize = DEFAULT_BATCH_SIZE;

  const envBatch = parseInt(process.env.DELIVERY_WORKER_BATCH_SIZE ?? '', 10);
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

  const summary = await processQueuedDeliveries({ workerId, batchSize, mode: 'dry_run' });

  return NextResponse.json({ ok: true, mode: 'dry_run', ...summary });
}
