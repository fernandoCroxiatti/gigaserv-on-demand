-- Add fee exemption field to provider_data (for promotional period)
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS fee_exemption_until timestamp with time zone DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.provider_data.fee_exemption_until IS 'Date until which provider has fee exemption (promotional period)';

-- Add first coupon tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_service_coupon_used boolean DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.first_service_coupon_used IS 'Whether the first service coupon was used by this client';