-- Fix views to use SECURITY INVOKER instead of SECURITY DEFINER

-- Recreate views with SECURITY INVOKER
DROP VIEW IF EXISTS public.provider_public_info;
DROP VIEW IF EXISTS public.chamados_searching;
DROP VIEW IF EXISTS public.profiles_public;

-- 1. Create a secure view for public provider info with SECURITY INVOKER
CREATE VIEW public.provider_public_info 
WITH (security_invoker = true) AS
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
FROM public.provider_data pd
JOIN public.profiles p ON pd.user_id = p.user_id
WHERE pd.is_online = true 
  AND pd.is_blocked = false
  AND p.perfil_principal = 'provider';

GRANT SELECT ON public.provider_public_info TO authenticated;

-- 2. Create a secure view for chamados with SECURITY INVOKER
CREATE VIEW public.chamados_searching 
WITH (security_invoker = true) AS
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
FROM public.chamados
WHERE status = 'searching';

GRANT SELECT ON public.chamados_searching TO authenticated;

-- 3. Create a secure view for basic profile info with SECURITY INVOKER
CREATE VIEW public.profiles_public 
WITH (security_invoker = true) AS
SELECT 
  user_id,
  name,
  avatar_url,
  perfil_principal,
  active_profile
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;