-- Drop unused database views that expose data without proper RLS protection
-- These views are not used by the application code (verified by code search)

-- Drop chamados_searching view
DROP VIEW IF EXISTS public.chamados_searching CASCADE;

-- Drop profiles_public view  
DROP VIEW IF EXISTS public.profiles_public CASCADE;

-- Drop provider_public_info view
DROP VIEW IF EXISTS public.provider_public_info CASCADE;