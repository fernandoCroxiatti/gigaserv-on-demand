-- Insert default max pending fee limit setting
INSERT INTO public.app_settings (key, value, description)
VALUES ('max_pending_fee_limit', '400', 'Limite máximo de pendência de taxa MANUAL_PIX em Reais. Prestadores com saldo devedor acima deste limite são bloqueados.')
ON CONFLICT (key) DO NOTHING;

-- Add unique constraint on CPF for providers
-- First, create a partial unique index that only applies to providers
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_provider_unique 
ON public.profiles (cpf) 
WHERE cpf IS NOT NULL AND cpf != '' AND perfil_principal = 'provider';

-- Add constraint to prevent CPF changes after registration for providers
CREATE OR REPLACE FUNCTION public.prevent_cpf_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only prevent changes for providers with existing CPF
  IF OLD.perfil_principal = 'provider' AND OLD.cpf IS NOT NULL AND OLD.cpf != '' THEN
    IF NEW.cpf IS DISTINCT FROM OLD.cpf THEN
      RAISE EXCEPTION 'CPF não pode ser alterado após o cadastro.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to prevent CPF changes
DROP TRIGGER IF EXISTS prevent_cpf_change_trigger ON public.profiles;
CREATE TRIGGER prevent_cpf_change_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_cpf_change();