-- Create secure views to expose only necessary data

-- 1. Create a secure view for public provider info (no sensitive data)
CREATE OR REPLACE VIEW public.provider_public_info AS
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

-- Grant access to authenticated users
GRANT SELECT ON public.provider_public_info TO authenticated;

-- 2. Create a secure view for chamados visible to searching providers (no financial data)
CREATE OR REPLACE VIEW public.chamados_searching AS
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

-- Grant access to authenticated users (providers will use is_provider check in code)
GRANT SELECT ON public.chamados_searching TO authenticated;

-- 3. Create a secure view for basic profile info (for matching purposes)
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  user_id,
  name,
  avatar_url,
  perfil_principal,
  active_profile
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;