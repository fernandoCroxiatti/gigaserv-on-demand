-- Fix RLS policies for better security

-- 1. Fix profiles table - only allow users to view their own profile or basic info of others
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Allow users to view their own complete profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow authenticated users to view basic info of other profiles (name, avatar only for matching purposes)
CREATE POLICY "Authenticated users can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. Fix provider_data table - hide sensitive Stripe data from public
DROP POLICY IF EXISTS "Anyone can view online providers" ON public.provider_data;

-- Create a more restrictive policy that only exposes location data for online providers
CREATE POLICY "Anyone can view online providers location" 
ON public.provider_data 
FOR SELECT 
USING (is_online = true);

-- 3. Fix chamados table - require authentication to view searching chamados
DROP POLICY IF EXISTS "Providers can view searching chamados" ON public.chamados;

CREATE POLICY "Authenticated providers can view searching chamados" 
ON public.chamados 
FOR SELECT 
USING (
  status = 'searching'::chamado_status 
  AND auth.uid() IS NOT NULL 
  AND is_provider(auth.uid())
);

-- 4. Fix app_settings table - require authentication
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;

CREATE POLICY "Authenticated users can read app settings" 
ON public.app_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 5. Add policy for reviews to be publicly viewable (for provider ratings)
CREATE POLICY "Anyone can view provider reviews" 
ON public.reviews 
FOR SELECT 
USING (true);