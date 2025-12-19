-- Update handle_new_user function with server-side validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _perfil_principal text;
  _services_offered service_type[];
  _vehicle_plate text;
  _name text;
  _phone text;
  _cpf text;
  _service_item text;
BEGIN
  -- Extract and validate name (required, max 200 chars)
  _name := COALESCE(NEW.raw_user_meta_data ->> 'name', 'Usuário');
  IF length(_name) > 200 THEN
    _name := substring(_name from 1 for 200);
  END IF;
  -- Sanitize name - remove potentially dangerous characters
  _name := regexp_replace(_name, '[<>"\'';&]', '', 'g');

  -- Extract and validate phone (max 20 chars, digits and common separators only)
  _phone := NEW.raw_user_meta_data ->> 'phone';
  IF _phone IS NOT NULL THEN
    IF length(_phone) > 20 THEN
      _phone := substring(_phone from 1 for 20);
    END IF;
    -- Only allow digits, spaces, hyphens, parentheses, plus
    _phone := regexp_replace(_phone, '[^0-9\s\-\(\)\+]', '', 'g');
  END IF;

  -- Extract and validate CPF (must be 11 digits if provided)
  _cpf := NEW.raw_user_meta_data ->> 'cpf';
  IF _cpf IS NOT NULL AND _cpf != '' THEN
    -- Remove non-numeric characters
    _cpf := regexp_replace(_cpf, '[^0-9]', '', 'g');
    -- Validate CPF using existing function
    IF NOT public.validate_cpf(_cpf) THEN
      RAISE EXCEPTION 'CPF inválido fornecido no cadastro';
    END IF;
  END IF;

  -- Check for perfil_principal first, then profile_type as fallback
  _perfil_principal := COALESCE(
    NEW.raw_user_meta_data ->> 'perfil_principal',
    NEW.raw_user_meta_data ->> 'profile_type',
    'client'
  );
  
  -- Validate perfil_principal is a valid value
  IF _perfil_principal NOT IN ('client', 'provider') THEN
    _perfil_principal := 'client';
  END IF;

  INSERT INTO public.profiles (user_id, name, email, phone, perfil_principal, cpf, active_profile)
  VALUES (
    NEW.id, 
    _name,
    NEW.email,
    _phone,
    _perfil_principal,
    _cpf,
    _perfil_principal::user_profile_type
  );
  
  -- If registering as provider, also create provider_data with selected services
  IF _perfil_principal = 'provider' THEN
    -- Parse and validate services_offered from JSON array in metadata
    -- Only allow valid service_type enum values
    BEGIN
      SELECT COALESCE(
        ARRAY(
          SELECT elem::service_type
          FROM jsonb_array_elements_text(
            COALESCE(NEW.raw_user_meta_data -> 'services_offered', '["guincho"]'::jsonb)
          ) AS elem
          WHERE elem IN ('guincho', 'borracharia', 'mecanica', 'chaveiro')
        ),
        ARRAY['guincho']::service_type[]
      ) INTO _services_offered;
    EXCEPTION WHEN OTHERS THEN
      _services_offered := ARRAY['guincho']::service_type[];
    END;
    
    -- Ensure at least one service
    IF array_length(_services_offered, 1) IS NULL OR array_length(_services_offered, 1) = 0 THEN
      _services_offered := ARRAY['guincho']::service_type[];
    END IF;

    -- Get and validate vehicle_plate from metadata (optional, max 10 chars, alphanumeric only)
    _vehicle_plate := NEW.raw_user_meta_data ->> 'vehicle_plate';
    IF _vehicle_plate IS NOT NULL THEN
      IF length(_vehicle_plate) > 10 THEN
        _vehicle_plate := substring(_vehicle_plate from 1 for 10);
      END IF;
      -- Only allow alphanumeric and hyphens
      _vehicle_plate := upper(regexp_replace(_vehicle_plate, '[^A-Za-z0-9\-]', '', 'g'));
    END IF;

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
$function$;