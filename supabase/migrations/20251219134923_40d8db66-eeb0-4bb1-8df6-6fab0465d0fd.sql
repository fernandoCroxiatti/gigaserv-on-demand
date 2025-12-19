-- Fix public views to respect RLS using security_invoker
-- This ensures views inherit RLS from underlying tables

-- Drop existing views
DROP VIEW IF EXISTS public.profiles_public;
DROP VIEW IF EXISTS public.provider_public_info;
DROP VIEW IF EXISTS public.chamados_searching;

-- Recreate profiles_public with security_invoker (only authenticated users)
CREATE VIEW public.profiles_public 
WITH (security_invoker = true)
AS
SELECT 
    user_id,
    name,
    avatar_url,
    perfil_principal,
    active_profile
FROM profiles;

-- Recreate provider_public_info with security_invoker
CREATE VIEW public.provider_public_info
WITH (security_invoker = true)
AS
SELECT 
    pd.user_id,
    pd.is_online,
    pd.radar_range,
    pd.rating,
    pd.total_services,
    pd.current_lat,
    pd.current_lng,
    pd.services_offered,
    p.name,
    p.avatar_url
FROM provider_data pd
JOIN profiles p ON pd.user_id = p.user_id
WHERE pd.is_online = true 
  AND pd.is_blocked = false 
  AND p.perfil_principal = 'provider';

-- Recreate chamados_searching with security_invoker
CREATE VIEW public.chamados_searching
WITH (security_invoker = true)
AS
SELECT 
    id,
    cliente_id,
    tipo_servico,
    status,
    origem_lat,
    origem_lng,
    origem_address,
    destino_lat,
    destino_lng,
    destino_address,
    valor_proposto,
    created_at
FROM chamados
WHERE status = 'searching'::chamado_status;

-- Grant SELECT on views to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.provider_public_info TO authenticated;
GRANT SELECT ON public.chamados_searching TO authenticated;

-- Revoke public access (anon role should not access these)
REVOKE ALL ON public.profiles_public FROM anon;
REVOKE ALL ON public.provider_public_info FROM anon;
REVOKE ALL ON public.chamados_searching FROM anon;

-- Add RLS policy for profiles to allow authenticated users to view basic public info
-- (needed for the profiles_public view to work through security_invoker)
CREATE POLICY "Authenticated users can view public profile info"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add RLS policy for provider_data to allow authenticated users to view online providers
-- (already exists, but let's ensure it covers this case)
-- The existing policy "Authenticated clients can view online providers" should cover this

-- Add comment for documentation
COMMENT ON VIEW public.profiles_public IS 'Public profile info - only accessible to authenticated users via security_invoker';
COMMENT ON VIEW public.provider_public_info IS 'Online provider info - only accessible to authenticated users via security_invoker';
COMMENT ON VIEW public.chamados_searching IS 'Searching chamados - only accessible to authenticated providers via security_invoker';