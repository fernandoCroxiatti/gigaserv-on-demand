-- CPF Validation Function and Trigger
-- Validates Brazilian CPF format and checksum on the backend

-- Create CPF validation function
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    cpf_clean TEXT;
    cpf_array INT[];
    sum1 INT := 0;
    sum2 INT := 0;
    remainder1 INT;
    remainder2 INT;
    i INT;
BEGIN
    -- Return true if CPF is null or empty (optional field)
    IF cpf_input IS NULL OR cpf_input = '' THEN
        RETURN TRUE;
    END IF;
    
    -- Remove non-numeric characters
    cpf_clean := regexp_replace(cpf_input, '[^0-9]', '', 'g');
    
    -- CPF must have exactly 11 digits
    IF length(cpf_clean) != 11 THEN
        RETURN FALSE;
    END IF;
    
    -- Check for known invalid CPFs (all same digits)
    IF cpf_clean ~ '^(.)\1{10}$' THEN
        RETURN FALSE;
    END IF;
    
    -- Convert to integer array
    FOR i IN 1..11 LOOP
        cpf_array[i] := substring(cpf_clean, i, 1)::INT;
    END LOOP;
    
    -- Calculate first check digit
    FOR i IN 1..9 LOOP
        sum1 := sum1 + (cpf_array[i] * (11 - i));
    END LOOP;
    
    remainder1 := (sum1 * 10) % 11;
    IF remainder1 = 10 THEN
        remainder1 := 0;
    END IF;
    
    -- Validate first check digit
    IF remainder1 != cpf_array[10] THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate second check digit
    FOR i IN 1..10 LOOP
        sum2 := sum2 + (cpf_array[i] * (12 - i));
    END LOOP;
    
    remainder2 := (sum2 * 10) % 11;
    IF remainder2 = 10 THEN
        remainder2 := 0;
    END IF;
    
    -- Validate second check digit
    IF remainder2 != cpf_array[11] THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Create trigger function to validate CPF on insert/update
CREATE OR REPLACE FUNCTION public.validate_profile_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only validate if CPF is being set or changed
    IF NEW.cpf IS NOT NULL AND NEW.cpf != '' THEN
        IF NOT public.validate_cpf(NEW.cpf) THEN
            RAISE EXCEPTION 'CPF inválido. Por favor, verifique o número informado.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS validate_cpf_trigger ON public.profiles;
CREATE TRIGGER validate_cpf_trigger
    BEFORE INSERT OR UPDATE OF cpf ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_profile_cpf();

-- Add comment for documentation
COMMENT ON FUNCTION public.validate_cpf IS 'Validates Brazilian CPF number format and checksum';
COMMENT ON FUNCTION public.validate_profile_cpf IS 'Trigger function to validate CPF on profile insert/update';