import 'server-only';

import { supabaseAdminClient } from '@/lib/supabase/admin';

import { loadDeliveryContext } from './delivery-context';
import { createDeliveryProvider } from './providers/factory';
import type {
  ClaimedDeliveryEvent,
  DeliveryWorkerMode,
  DeliveryWorkerSummary,
  ProcessDeliveryResult,
} from './types';

const LOCK_TIMEOUT_SECONDS = 900;

export async function processQueuedDeliveries(options: {
  workerId: string;
  batchSize: number;
  mode: DeliveryWorkerMode;
}): Promise<DeliveryWorkerSummary> {
  const { workerId, batchSize, mode } = options;
  const provider = createDeliveryProvider(mode);

  const { data: claimedRows, error: claimError } = await supabaseAdminClient.rpc(
    'claim_queued_delivery_events',
    {
      p_worker_id: workerId,
      p_batch_size: batchSize,
      p_lock_timeout_seconds: LOCK_TIMEOUT_SECONDS,
    },
  );

  if (claimError) {
    console.error('[delivery-orchestrator] Failed to claim delivery events', {
      workerId,
      error: claimError.message,
    });
    return {
      claimed: 0,
      processed: 0,
      sent: 0,
      failed: 1,
      retryScheduled: 0,
      results: [{ deliveryEventId: 'batch', ok: false, status: 'failed', error: 'claim_failed' }],
    };
  }

  const claimed = (claimedRows as ClaimedDeliveryEvent[] | null) ?? [];
  const results: ProcessDeliveryResult[] = [];
  let sent = 0;
  let failed = 0;
  let retryScheduled = 0;

  for (const event of claimed) {
    const deliveryEventId = event.delivery_event_id as string;

    try {
      const context = await loadDeliveryContext(deliveryEventId);

      if (!context) {
        const { data: markData, error: markError } = await supabaseAdminClient.rpc(
          'mark_delivery_event_failed',
          {
            p_delivery_event_id: deliveryEventId,
            p_worker_id: workerId,
            p_failure_reason: 'context_load_failed',
            p_provider_response: null,
            p_retryable: false,
            p_retry_after_seconds: 300,
          },
        );
        if (markError || !(markData as { success?: boolean } | null)?.success) {
          console.error('[delivery-orchestrator] mark_delivery_event_failed RPC failed', {
            deliveryEventId,
            error: markError?.message,
          });
          results.push({ deliveryEventId, ok: false, status: 'failed', error: 'mark_failed_failed' });
        } else {
          results.push({ deliveryEventId, ok: false, status: 'failed', error: 'context_load_failed' });
        }
        failed++;
        continue;
      }

      const providerResult = await provider.send(context);

      if (providerResult.success) {
        const { data: sentData, error: sentError } = await supabaseAdminClient.rpc(
          'mark_delivery_event_sent',
          {
            p_delivery_event_id: deliveryEventId,
            p_worker_id: workerId,
            p_provider_message_id: providerResult.providerMessageId,
            p_provider_response: providerResult.providerResponse,
          },
        );
        if (sentError || !(sentData as { success?: boolean } | null)?.success) {
          console.error('[delivery-orchestrator] mark_delivery_event_sent RPC failed', {
            deliveryEventId,
            error: sentError?.message,
          });
          failed++;
          results.push({ deliveryEventId, ok: false, status: 'failed', error: 'mark_sent_failed' });
        } else {
          sent++;
          results.push({
            deliveryEventId,
            ok: true,
            status: 'sent',
            providerMessageId: providerResult.providerMessageId,
          });
        }
      } else {
        const hasRemainingAttempts = event.attempt_count < event.max_attempts;
        const willRetry = providerResult.retryable && hasRemainingAttempts;

        const { data: failData, error: failError } = await supabaseAdminClient.rpc(
          'mark_delivery_event_failed',
          {
            p_delivery_event_id: deliveryEventId,
            p_worker_id: workerId,
            p_failure_reason: providerResult.failureReason,
            p_provider_response: providerResult.providerResponse ?? null,
            p_retryable: providerResult.retryable,
            p_retry_after_seconds: providerResult.retryAfterSeconds ?? 300,
          },
        );
        if (failError || !(failData as { success?: boolean } | null)?.success) {
          console.error('[delivery-orchestrator] mark_delivery_event_failed RPC failed', {
            deliveryEventId,
            error: failError?.message,
          });
          failed++;
          results.push({ deliveryEventId, ok: false, status: 'failed', error: 'mark_failed_failed' });
        } else if (willRetry) {
          retryScheduled++;
          results.push({
            deliveryEventId,
            ok: false,
            status: 'retry_scheduled',
            error: providerResult.failureReason,
          });
        } else {
          failed++;
          results.push({
            deliveryEventId,
            ok: false,
            status: 'failed',
            error: providerResult.failureReason,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unexpected_worker_error';
      console.error('[delivery-orchestrator] Unexpected error processing event', {
        deliveryEventId,
        error: message,
      });

      try {
        const { data: catchData, error: catchError } = await supabaseAdminClient.rpc(
          'mark_delivery_event_failed',
          {
            p_delivery_event_id: deliveryEventId,
            p_worker_id: workerId,
            p_failure_reason: 'unexpected_worker_error',
            p_provider_response: null,
            p_retryable: false,
            p_retry_after_seconds: 300,
          },
        );
        if (catchError || !(catchData as { success?: boolean } | null)?.success) {
          console.error('[delivery-orchestrator] mark_delivery_event_failed RPC failed in catch', {
            deliveryEventId,
            error: catchError?.message,
          });
          results.push({ deliveryEventId, ok: false, status: 'failed', error: 'mark_failed_failed' });
        } else {
          results.push({ deliveryEventId, ok: false, status: 'failed', error: 'unexpected_worker_error' });
        }
      } catch {
        // Best-effort — lock will expire naturally after LOCK_TIMEOUT_SECONDS.
        results.push({ deliveryEventId, ok: false, status: 'failed', error: 'unexpected_worker_error' });
      }

      failed++;
    }
  }

  return {
    claimed: claimed.length,
    processed: results.length,
    sent,
    failed,
    retryScheduled,
    results,
  };
}
