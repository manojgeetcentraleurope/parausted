-- Restrict pending purchase cancellation to authenticated merchants only.
--
-- cancel_pending_purchase is still required by the merchant dashboard rejection flow,
-- but anon callers should not be able to execute money-state RPCs at all.
-- The function body may still enforce auth.uid() and merchant ownership, but the
-- permission boundary should also follow least privilege.

REVOKE ALL ON FUNCTION public.cancel_pending_purchase(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_pending_purchase(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_pending_purchase(UUID, TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_pending_purchase(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.cancel_pending_purchase(UUID, TEXT)
IS 'Cancels/rejects a pending offline purchase. Executable by authenticated merchants only.';