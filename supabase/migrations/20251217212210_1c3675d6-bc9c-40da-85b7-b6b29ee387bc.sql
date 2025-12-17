-- Update handle_new_user function to use services_offered from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _perfil_principal text;
  _services_offered service_type[];
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

    INSERT INTO public.provider_data (user_id, is_online, radar_range, services_offered)
    VALUES (
      NEW.id,
      false,
      15,
      _services_offered
    );
  END IF;
  
  RETURN NEW;
END;
$function$;