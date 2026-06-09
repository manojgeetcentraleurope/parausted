-- Restrict anonymous execution of the voucher issuance RPC.
-- The function already validates auth.uid(), but SECURITY DEFINER money-flow RPCs
-- should also have explicit EXECUTE permissions.

REVOKE ALL ON FUNCTION public.confirm_purchase_and_issue_voucher(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_purchase_and_issue_voucher(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_and_issue_voucher(UUID) TO authenticated;