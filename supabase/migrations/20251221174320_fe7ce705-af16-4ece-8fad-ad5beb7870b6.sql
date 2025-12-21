-- ============================================
-- ANTI-FRAUD VALIDATION FUNCTIONS
-- ============================================

-- 1. Function to check if a credential is blocked
CREATE OR REPLACE FUNCTION public.is_credential_blocked(
  _credential_type text,
  _credential_value text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_credentials
    WHERE credential_type = _credential_type
      AND credential_value = _credential_value
  )
$$;

-- 2. Function to check if device_id is already registered to another blocked provider
CREATE OR REPLACE FUNCTION public.is_device_blocked(_device_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_credentials
    WHERE credential_type = 'device_id'
      AND credential_value = _device_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.provider_data
    WHERE device_id = _device_id
      AND (permanently_blocked = true OR fraud_flagged = true)
  )
$$;

-- 3. Function to check if provider exceeds debt limit
CREATE OR REPLACE FUNCTION public.check_provider_debt_limit(_user_id uuid)
RETURNS TABLE(
  is_over_limit boolean,
  current_debt numeric,
  max_limit numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_debt numeric;
  _max_limit numeric;
BEGIN
  SELECT COALESCE(pending_fee_balance, 0), COALESCE(max_debt_limit, 400.00)
  INTO _current_debt, _max_limit
  FROM public.provider_data
  WHERE user_id = _user_id;

  RETURN QUERY SELECT 
    COALESCE(_current_debt >= _max_limit, false) as is_over_limit,
    COALESCE(_current_debt, 0) as current_debt,
    COALESCE(_max_limit, 400.00) as max_limit;
END;
$$;

-- 4. Function to check if provider can accept new chamados
CREATE OR REPLACE FUNCTION public.can_provider_accept_chamados(_user_id uuid)
RETURNS TABLE(
  can_accept boolean,
  block_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _provider record;
  _debt_check record;
BEGIN
  -- Get provider data
  SELECT * INTO _provider
  FROM public.provider_data
  WHERE user_id = _user_id;

  -- Check if provider exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::boolean, 'provider_not_found'::text;
    RETURN;
  END IF;

  -- Check if permanently blocked
  IF _provider.permanently_blocked THEN
    RETURN QUERY SELECT false::boolean, 'permanently_blocked'::text;
    RETURN;
  END IF;

  -- Check if fraud flagged
  IF _provider.fraud_flagged THEN
    RETURN QUERY SELECT false::boolean, 'fraud_flagged'::text;
    RETURN;
  END IF;

  -- Check if financially blocked
  IF _provider.financial_blocked THEN
    RETURN QUERY SELECT false::boolean, 'financial_blocked'::text;
    RETURN;
  END IF;

  -- Check if over debt limit
  SELECT * INTO _debt_check FROM public.check_provider_debt_limit(_user_id);
  IF _debt_check.is_over_limit THEN
    RETURN QUERY SELECT false::boolean, 'over_debt_limit'::text;
    RETURN;
  END IF;

  -- Check if blocked by admin
  IF _provider.is_blocked THEN
    RETURN QUERY SELECT false::boolean, 'admin_blocked'::text;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true::boolean, NULL::text;
END;
$$;

-- 5. Function to block a provider and their credentials
CREATE OR REPLACE FUNCTION public.block_provider_for_fraud(
  _provider_user_id uuid,
  _reason text,
  _admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _provider record;
  _profile record;
BEGIN
  -- Get provider data
  SELECT * INTO _provider FROM public.provider_data WHERE user_id = _provider_user_id;
  SELECT * INTO _profile FROM public.profiles WHERE user_id = _provider_user_id;

  -- Mark provider as permanently blocked
  UPDATE public.provider_data
  SET 
    permanently_blocked = true,
    permanently_blocked_at = now(),
    permanently_blocked_by = _admin_id,
    permanently_blocked_reason = _reason,
    fraud_flagged = true,
    fraud_reason = _reason,
    fraud_flagged_at = now(),
    fraud_flagged_by = _admin_id,
    is_online = false
  WHERE user_id = _provider_user_id;

  -- Block CPF
  IF _profile.cpf IS NOT NULL THEN
    INSERT INTO public.blocked_credentials (credential_type, credential_value, original_user_id, block_reason, blocked_by)
    VALUES ('cpf', _profile.cpf, _provider_user_id, _reason, _admin_id)
    ON CONFLICT (credential_type, credential_value) DO UPDATE SET block_reason = _reason, blocked_by = _admin_id;
  END IF;

  -- Block email
  IF _profile.email IS NOT NULL THEN
    INSERT INTO public.blocked_credentials (credential_type, credential_value, original_user_id, block_reason, blocked_by)
    VALUES ('email', _profile.email, _provider_user_id, _reason, _admin_id)
    ON CONFLICT (credential_type, credential_value) DO UPDATE SET block_reason = _reason, blocked_by = _admin_id;
  END IF;

  -- Block phone
  IF _profile.phone IS NOT NULL THEN
    INSERT INTO public.blocked_credentials (credential_type, credential_value, original_user_id, block_reason, blocked_by)
    VALUES ('phone', _profile.phone, _provider_user_id, _reason, _admin_id)
    ON CONFLICT (credential_type, credential_value) DO UPDATE SET block_reason = _reason, blocked_by = _admin_id;
  END IF;

  -- Block device_id
  IF _provider.device_id IS NOT NULL THEN
    INSERT INTO public.blocked_credentials (credential_type, credential_value, original_user_id, block_reason, blocked_by)
    VALUES ('device_id', _provider.device_id, _provider_user_id, _reason, _admin_id)
    ON CONFLICT (credential_type, credential_value) DO UPDATE SET block_reason = _reason, blocked_by = _admin_id;
  END IF;

  -- Block vehicle_plate
  IF _provider.vehicle_plate IS NOT NULL THEN
    INSERT INTO public.blocked_credentials (credential_type, credential_value, original_user_id, block_reason, blocked_by)
    VALUES ('vehicle_plate', _provider.vehicle_plate, _provider_user_id, _reason, _admin_id)
    ON CONFLICT (credential_type, credential_value) DO UPDATE SET block_reason = _reason, blocked_by = _admin_id;
  END IF;

  -- Block pix_key
  IF _provider.pix_key IS NOT NULL THEN
    INSERT INTO public.blocked_credentials (credential_type, credential_value, original_user_id, block_reason, blocked_by)
    VALUES ('pix_key', _provider.pix_key, _provider_user_id, _reason, _admin_id)
    ON CONFLICT (credential_type, credential_value) DO UPDATE SET block_reason = _reason, blocked_by = _admin_id;
  END IF;

  -- Log to fraud history
  INSERT INTO public.fraud_history (user_id, action, details, performed_by)
  VALUES (
    _provider_user_id,
    'blocked_for_fraud',
    jsonb_build_object(
      'reason', _reason,
      'cpf', _profile.cpf,
      'email', _profile.email,
      'phone', _profile.phone,
      'device_id', _provider.device_id,
      'vehicle_plate', _provider.vehicle_plate,
      'pending_balance', _provider.pending_fee_balance
    ),
    _admin_id
  );
END;
$$;

-- 6. Function to unblock a provider
CREATE OR REPLACE FUNCTION public.unblock_provider(
  _provider_user_id uuid,
  _admin_id uuid,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Unblock provider
  UPDATE public.provider_data
  SET 
    permanently_blocked = false,
    permanently_blocked_at = NULL,
    permanently_blocked_by = NULL,
    permanently_blocked_reason = NULL,
    fraud_flagged = false,
    fraud_reason = NULL,
    fraud_flagged_at = NULL,
    fraud_flagged_by = NULL,
    is_blocked = false,
    block_reason = NULL,
    blocked_at = NULL,
    blocked_by = NULL,
    financial_blocked = false,
    financial_block_reason = NULL
  WHERE user_id = _provider_user_id;

  -- Remove from blocked_credentials
  DELETE FROM public.blocked_credentials
  WHERE original_user_id = _provider_user_id;

  -- Log to fraud history
  INSERT INTO public.fraud_history (user_id, action, details, performed_by)
  VALUES (
    _provider_user_id,
    'unblocked',
    jsonb_build_object('notes', _notes),
    _admin_id
  );
END;
$$;

-- 7. Function to automatically block provider when over debt limit
CREATE OR REPLACE FUNCTION public.auto_block_over_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if pending_fee_balance exceeds max_debt_limit
  IF NEW.pending_fee_balance >= COALESCE(NEW.max_debt_limit, 400.00) THEN
    NEW.financial_blocked := true;
    NEW.financial_block_reason := 'Limite de pendência excedido: R$ ' || NEW.pending_fee_balance::text;
    NEW.is_online := false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-blocking
DROP TRIGGER IF EXISTS trigger_auto_block_over_limit ON public.provider_data;
CREATE TRIGGER trigger_auto_block_over_limit
BEFORE UPDATE OF pending_fee_balance ON public.provider_data
FOR EACH ROW
EXECUTE FUNCTION public.auto_block_over_limit();