-- Add registration_complete field to provider_data
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS registration_complete boolean DEFAULT false;

-- Add vehicle_type field to provider_data
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS vehicle_type text;

-- Add terms_accepted field to provider_data
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- Add terms_accepted_at field to provider_data
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone;