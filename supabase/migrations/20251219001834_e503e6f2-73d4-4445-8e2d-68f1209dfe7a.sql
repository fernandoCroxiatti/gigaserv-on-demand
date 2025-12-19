-- Update trigger function to include vehicle_plate when creating provider_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
DECLARE
  _perfil_principal text;
  _services_offered service_type[];
  _vehicle_plate text;
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
  
  -- If registering as provider, also create provider_data with selected services
  IF _perfil_principal = 'provider' THEN
    -- Parse services_offered from JSON array in metadata
    SELECT COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(
          COALESCE(NEW.raw_user_meta_data -> 'services_offered', '["guincho"]'::jsonb)
        )::service_type
      ),
      ARRAY['guincho']::service_type[]
    ) INTO _services_offered;

    -- Get vehicle_plate from metadata (optional)
    _vehicle_plate := NEW.raw_user_meta_data ->> 'vehicle_plate';

    INSERT INTO public.provider_data (user_id, is_online, radar_range, services_offered, vehicle_plate)
    VALUES (
      NEW.id,
      false,
      15,
      _services_offered,
      _vehicle_plate
    );
  END IF;
  
  RETURN NEW;
END;
$$;