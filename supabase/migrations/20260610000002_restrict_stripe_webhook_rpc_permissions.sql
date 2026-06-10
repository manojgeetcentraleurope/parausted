-- Explicitly revoke EXECUTE on the Stripe webhook RPC from anon and authenticated roles.
-- Supabase default privileges re-grant EXECUTE to these roles even after REVOKE FROM PUBLIC.
-- Only service_role (the trusted admin/webhook caller) should be able to execute this function.

REVOKE ALL ON FUNCTION public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT) FROM authenticated;
