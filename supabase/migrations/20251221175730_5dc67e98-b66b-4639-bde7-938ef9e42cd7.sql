-- Add terms version tracking to provider_data
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS terms_accepted_version text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS terms_version_required text DEFAULT '2024-12-21';

-- Create constant for current terms version
CREATE OR REPLACE FUNCTION public.get_current_terms_version()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT '2024-12-21'::text;
$$;

-- Function to check if provider has accepted current terms
CREATE OR REPLACE FUNCTION public.provider_needs_terms_acceptance(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _accepted_version text;
  _current_version text;
BEGIN
  _current_version := public.get_current_terms_version();
  
  SELECT terms_accepted_version INTO _accepted_version
  FROM public.provider_data
  WHERE user_id = _user_id;
  
  -- If no record or version doesn't match current, needs acceptance
  IF _accepted_version IS NULL OR _accepted_version != _current_version THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to record terms acceptance
CREATE OR REPLACE FUNCTION public.accept_terms(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.provider_data
  SET 
    terms_accepted = true,
    terms_accepted_at = now(),
    terms_accepted_version = public.get_current_terms_version()
  WHERE user_id = _user_id;
  
  -- Log acceptance in fraud_history for audit
  INSERT INTO public.fraud_history (user_id, action, details, performed_by)
  VALUES (
    _user_id,
    'terms_accepted',
    jsonb_build_object(
      'version', public.get_current_terms_version(),
      'accepted_at', now()
    ),
    _user_id
  );
END;
$$;