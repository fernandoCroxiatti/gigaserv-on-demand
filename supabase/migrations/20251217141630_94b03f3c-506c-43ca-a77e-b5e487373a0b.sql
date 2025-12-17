-- Add perfil_principal column to profiles table
-- This determines the user's main role and cannot be changed after registration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS perfil_principal TEXT NOT NULL DEFAULT 'client' 
CHECK (perfil_principal IN ('client', 'provider'));

-- Add CPF column for providers (optional, only required for providers)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Update provider_data table to enforce that only providers can have provider_data
-- Create a function to validate provider operations
CREATE OR REPLACE FUNCTION public.is_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND perfil_principal = 'provider'
  )
$$;

-- Create a function to validate provider is active (online mode)
CREATE OR REPLACE FUNCTION public.is_provider_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.provider_data pd ON p.user_id = pd.user_id
    WHERE p.user_id = _user_id
      AND p.perfil_principal = 'provider'
      AND p.active_profile = 'provider'
      AND pd.is_online = true
  )
$$;

-- Drop existing policies on provider_data and recreate with stricter rules
DROP POLICY IF EXISTS "Anyone can view online providers" ON public.provider_data;
DROP POLICY IF EXISTS "Providers can insert own data" ON public.provider_data;
DROP POLICY IF EXISTS "Providers can update own data" ON public.provider_data;

-- Only users with perfil_principal = 'provider' can view provider data
CREATE POLICY "Anyone can view online providers" 
ON public.provider_data 
FOR SELECT 
USING (is_online = true);

-- Only users with perfil_principal = 'provider' can insert their own data
CREATE POLICY "Providers can insert own data" 
ON public.provider_data 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND public.is_provider(auth.uid())
);

-- Only users with perfil_principal = 'provider' can update their own data
CREATE POLICY "Providers can update own data" 
ON public.provider_data 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND public.is_provider(auth.uid())
);

-- Update chamados policies to ensure only providers can accept chamados
DROP POLICY IF EXISTS "Involved users can update chamados" ON public.chamados;

CREATE POLICY "Involved users can update chamados" 
ON public.chamados 
FOR UPDATE 
USING (
  (auth.uid() = cliente_id) 
  OR (auth.uid() = prestador_id AND public.is_provider(auth.uid()))
);

-- Create policy to ensure only active providers can be assigned to chamados
-- This validates that when prestador_id is set, the user is a valid provider
CREATE OR REPLACE FUNCTION public.validate_chamado_prestador()
RETURNS TRIGGER AS $$
BEGIN
  -- If prestador_id is being set, validate it's a provider
  IF NEW.prestador_id IS NOT NULL AND NEW.prestador_id != OLD.prestador_id THEN
    IF NOT public.is_provider(NEW.prestador_id) THEN
      RAISE EXCEPTION 'User is not a registered provider';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to validate prestador on chamados
DROP TRIGGER IF EXISTS validate_chamado_prestador_trigger ON public.chamados;
CREATE TRIGGER validate_chamado_prestador_trigger
  BEFORE UPDATE ON public.chamados
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chamado_prestador();