-- Allow clients to read services that are referenced in their own commissions.
-- Needed so that commission queries (useMyCommissions, useCommissionTrackingDetail)
-- can JOIN services!service_id and return service title and pricing to the client.
--
-- Uses a SECURITY DEFINER helper to avoid nested RLS evaluation: a plain EXISTS
-- on commissions inside a services policy causes auth.uid() to return NULL in
-- Supabase's nested RLS context.
CREATE OR REPLACE FUNCTION public.client_has_commission_for_service(p_service_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.commissions
    WHERE service_id = p_service_id
      AND client_id = (SELECT auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.client_has_commission_for_service(uuid) TO authenticated;

CREATE POLICY "cliente lee servicios de sus comisiones"
  ON public.services FOR SELECT
  TO authenticated
  USING (public.client_has_commission_for_service(id));
