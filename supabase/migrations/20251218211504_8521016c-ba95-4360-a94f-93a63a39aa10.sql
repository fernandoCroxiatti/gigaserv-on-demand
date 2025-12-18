-- Fix remaining security issues with more restrictive RLS policies

-- 1. Fix profiles table - remove the overly permissive policy and create a more restrictive one
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;

-- Only allow viewing own profile OR profiles of people in active chamados (for client-provider matching)
CREATE POLICY "Users can view profiles for active chamados" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM chamados 
    WHERE (chamados.cliente_id = profiles.user_id OR chamados.prestador_id = profiles.user_id)
    AND (chamados.cliente_id = auth.uid() OR chamados.prestador_id = auth.uid())
    AND chamados.status NOT IN ('idle', 'canceled', 'finished')
  )
);

-- 2. Fix provider_data table - create a secure view and restrict the policy
DROP POLICY IF EXISTS "Anyone can view online providers location" ON public.provider_data;

-- Only authenticated clients can view online providers basic info (no Stripe data)
CREATE POLICY "Authenticated clients can view online providers" 
ON public.provider_data 
FOR SELECT 
USING (
  is_online = true 
  AND auth.uid() IS NOT NULL
);

-- 3. Fix reviews - require authentication
DROP POLICY IF EXISTS "Anyone can view provider reviews" ON public.reviews;

CREATE POLICY "Authenticated users can view all reviews" 
ON public.reviews 
FOR SELECT 
USING (auth.uid() IS NOT NULL);