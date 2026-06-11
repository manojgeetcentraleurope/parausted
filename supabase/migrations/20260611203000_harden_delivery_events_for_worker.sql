-- Harden delivery_events for future worker-owned provider delivery.
--
-- This migration does not send delivery messages.
-- It prepares the delivery queue for safe retries, locking,
-- scheduled delivery, and provider idempotency.

ALTER TABLE public.delivery_events
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_by TEXT,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Existing rows should be eligible for processing unless already terminal.
-- queued_at remains the audit timestamp for when delivery was originally queued.
UPDATE public.delivery_events
SET next_attempt_at = COALESCE(next_attempt_at, queued_at)
WHERE status = 'queued'
  AND next_attempt_at IS NULL;

-- Stable provider idempotency key.
-- Future provider adapters may pass this to providers that support idempotency.
UPDATE public.delivery_events
SET idempotency_key = COALESCE(idempotency_key, 'delivery:' || id::TEXT)
WHERE idempotency_key IS NULL;

ALTER TABLE public.delivery_events
ADD CONSTRAINT delivery_events_attempt_count_non_negative
CHECK (attempt_count >= 0);

ALTER TABLE public.delivery_events
ADD CONSTRAINT delivery_events_max_attempts_positive
CHECK (max_attempts > 0);

ALTER TABLE public.delivery_events
ADD CONSTRAINT delivery_events_attempt_count_not_above_max
CHECK (attempt_count <= max_attempts);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_events_idempotency_key
ON public.delivery_events(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_events_worker_queue
ON public.delivery_events(next_attempt_at, queued_at)
WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_delivery_events_locked
ON public.delivery_events(locked_at)
WHERE locked_at IS NOT NULL;

COMMENT ON COLUMN public.delivery_events.attempt_count
IS 'Number of provider delivery attempts made by the delivery worker.';

COMMENT ON COLUMN public.delivery_events.max_attempts
IS 'Maximum provider delivery attempts before the event should remain failed.';

COMMENT ON COLUMN public.delivery_events.next_attempt_at
IS 'Earliest time a worker may attempt this delivery. Supports scheduled delivery and retry backoff.';

COMMENT ON COLUMN public.delivery_events.last_attempt_at
IS 'Timestamp of the most recent provider delivery attempt.';

COMMENT ON COLUMN public.delivery_events.locked_at
IS 'Timestamp when a worker locked this event for processing. Used to prevent concurrent sends.';

COMMENT ON COLUMN public.delivery_events.locked_by
IS 'Worker identifier that locked this event for processing.';

COMMENT ON COLUMN public.delivery_events.idempotency_key
IS 'Stable key for deduplicating provider send attempts.';
