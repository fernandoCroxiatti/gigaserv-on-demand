-- Update handle_new_user function to accept perfil_principal from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, phone, perfil_principal, cpf, active_profile)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'Usuário'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE(NEW.raw_user_meta_data ->> 'perfil_principal', 'client'),
    NEW.raw_user_meta_data ->> 'cpf',
    COALESCE(NEW.raw_user_meta_data ->> 'perfil_principal', 'client')
  );
  
  -- If registering as provider, also create provider_data
  IF COALESCE(NEW.raw_user_meta_data ->> 'perfil_principal', 'client') = 'provider' THEN
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