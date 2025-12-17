-- Fix: offline providers couldn't load their own provider_data due to missing SELECT policy
-- This prevented the "Ficar online" button from working.

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.provider_data ENABLE ROW LEVEL SECURITY;

-- Replace overly restrictive/insufficient SELECT policy
DROP POLICY IF EXISTS "Anyone can view online providers" ON public.provider_data;

-- 1) Authenticated users can view providers that are online (for client map/search)
CREATE POLICY "Anyone can view online providers"
ON public.provider_data
FOR SELECT
TO authenticated
USING (is_online = true);

-- 2) Providers can always view their own provider_data (even when offline)
CREATE POLICY "Providers can view own provider data"
ON public.provider_data
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_provider(auth.uid())
);
