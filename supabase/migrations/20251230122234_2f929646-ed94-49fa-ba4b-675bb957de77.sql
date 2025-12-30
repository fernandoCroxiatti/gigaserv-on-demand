-- Add last_activity field to profiles table for clients
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_activity timestamp with time zone DEFAULT now();

-- Add last_activity field to provider_data table for providers
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS last_activity timestamp with time zone DEFAULT now();

-- Create index for efficient queries on last_activity
CREATE INDEX IF NOT EXISTS idx_profiles_last_activity ON public.profiles(last_activity);
CREATE INDEX IF NOT EXISTS idx_provider_data_last_activity ON public.provider_data(last_activity);

-- Update RLS to allow users to update their own last_activity (already covered by existing policies)