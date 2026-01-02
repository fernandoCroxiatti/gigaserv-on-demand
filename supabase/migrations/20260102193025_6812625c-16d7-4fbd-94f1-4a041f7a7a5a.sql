-- Add individual fee configuration fields to provider_data
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS custom_fee_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_fee_percentage numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_fee_fixed numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.provider_data.custom_fee_enabled IS 'Se true, usa taxas personalizadas ao invés da taxa global';
COMMENT ON COLUMN public.provider_data.custom_fee_percentage IS 'Taxa percentual personalizada (ex: 15 para 15%)';
COMMENT ON COLUMN public.provider_data.custom_fee_fixed IS 'Taxa fixa personalizada em BRL';