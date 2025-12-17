-- Update handle_new_user to accept both perfil_principal and profile_type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _perfil_principal text;
BEGIN
  -- Check for perfil_principal first, then profile_type as fallback
  _perfil_principal := COALESCE(
    NEW.raw_user_meta_data ->> 'perfil_principal',
    NEW.raw_user_meta_data ->> 'profile_type',
    'client'
  );

  INSERT INTO public.profiles (user_id, name, email, phone, perfil_principal, cpf, active_profile)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'Usuário'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    _perfil_principal,
    NEW.raw_user_meta_data ->> 'cpf',
    _perfil_principal::user_profile_type
  );
  
  -- If registering as provider, also create provider_data
  IF _perfil_principal = 'provider' THEN
    INSERT INTO public.provider_data (user_id, is_online, radar_range, services_offered)
    VALUES (
      NEW.id,
      false,
      15,
      ARRAY['guincho']::service_type[]
    );
  END IF;
  
  RETURN NEW;
END;
$$;