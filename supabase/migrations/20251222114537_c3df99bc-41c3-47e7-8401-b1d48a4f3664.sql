-- ============================================
-- SECURITY FIX 1: Restrict app_settings public access
-- ============================================

-- Drop the overly permissive policy that allows public read
DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;

-- Create restricted policy for authenticated users only (non-sensitive settings)
CREATE POLICY "Authenticated users can read non-sensitive settings"
ON app_settings FOR SELECT
TO authenticated
USING (
  key NOT IN ('pix_config', 'stripe_config', 'admin_secrets')
);

-- Admins can read ALL settings including sensitive ones
CREATE POLICY "Admins can read all settings"
ON app_settings FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- ============================================
-- SECURITY FIX 2: Add admin validation to SECURITY DEFINER functions
-- ============================================

-- Fix block_provider_for_fraud - add caller validation
CREATE OR REPLACE FUNCTION public.block_provider_for_fraud(_provider_user_id uuid, _reason text, _admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _provider record;
  _profile record;
BEGIN
  -- CRITICAL: Verify caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can block providers';
  END IF;
  
  -- Verify _admin_id matches caller
  IF _admin_id != auth.uid() THEN
    RAISE EXCEPTION 'admin_id must match authenticated user';
  END IF;

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

-- Fix unblock_provider - add caller validation
CREATE OR REPLACE FUNCTION public.unblock_provider(_provider_user_id uuid, _admin_id uuid, _notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CRITICAL: Verify caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can unblock providers';
  END IF;
  
  -- Verify _admin_id matches caller
  IF _admin_id != auth.uid() THEN
    RAISE EXCEPTION 'admin_id must match authenticated user';
  END IF;

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