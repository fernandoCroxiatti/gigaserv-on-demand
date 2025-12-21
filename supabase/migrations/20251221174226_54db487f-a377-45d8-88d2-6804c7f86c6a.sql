-- ============================================
-- ANTI-FRAUD SYSTEM MIGRATION
-- ============================================

-- 1. Create enum for block reasons
DO $$ BEGIN
  CREATE TYPE public.block_reason_type AS ENUM (
    'divida',
    'fraude',
    'duplicidade',
    'dispositivo_bloqueado',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create blocked_credentials table for tracking blocked sensitive data
CREATE TABLE IF NOT EXISTS public.blocked_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_type text NOT NULL CHECK (credential_type IN ('cpf', 'email', 'phone', 'pix_key', 'vehicle_plate', 'device_id')),
  credential_value text NOT NULL,
  original_user_id uuid REFERENCES auth.users(id),
  block_reason text NOT NULL,
  blocked_at timestamp with time zone DEFAULT now(),
  blocked_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(credential_type, credential_value)
);

-- 3. Add device_id and fraud-related columns to provider_data
ALTER TABLE public.provider_data
ADD COLUMN IF NOT EXISTS device_id text,
ADD COLUMN IF NOT EXISTS device_id_registered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS fraud_flagged boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fraud_reason text,
ADD COLUMN IF NOT EXISTS fraud_flagged_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS fraud_flagged_by uuid,
ADD COLUMN IF NOT EXISTS max_debt_limit numeric DEFAULT 400.00,
ADD COLUMN IF NOT EXISTS permanently_blocked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS permanently_blocked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS permanently_blocked_by uuid,
ADD COLUMN IF NOT EXISTS permanently_blocked_reason text;

-- 4. Add pix_key column to provider_data for fraud detection
ALTER TABLE public.provider_data
ADD COLUMN IF NOT EXISTS pix_key text,
ADD COLUMN IF NOT EXISTS pix_key_type text CHECK (pix_key_type IN ('cpf', 'email', 'phone', 'random', 'cnpj') OR pix_key_type IS NULL);

-- 5. Create index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_provider_data_device_id ON public.provider_data(device_id);

-- 6. Create index for blocked credentials lookups
CREATE INDEX IF NOT EXISTS idx_blocked_credentials_type_value ON public.blocked_credentials(credential_type, credential_value);
CREATE INDEX IF NOT EXISTS idx_blocked_credentials_value ON public.blocked_credentials(credential_value);

-- 7. Enable RLS on blocked_credentials
ALTER TABLE public.blocked_credentials ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies for blocked_credentials (admin only)
CREATE POLICY "Admins can view blocked credentials"
ON public.blocked_credentials FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert blocked credentials"
ON public.blocked_credentials FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update blocked credentials"
ON public.blocked_credentials FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete blocked credentials"
ON public.blocked_credentials FOR DELETE
USING (is_admin(auth.uid()));

-- 9. Service role policy for automated blocking
CREATE POLICY "Service role can manage blocked credentials"
ON public.blocked_credentials FOR ALL
USING (true)
WITH CHECK (true);

-- 10. Create fraud_history table for immutable audit trail
CREATE TABLE IF NOT EXISTS public.fraud_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  performed_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on fraud_history
ALTER TABLE public.fraud_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for fraud_history (read-only for admins, insert only)
CREATE POLICY "Admins can view fraud history"
ON public.fraud_history FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can insert fraud history"
ON public.fraud_history FOR INSERT
WITH CHECK (true);

-- No update or delete policies - immutable history