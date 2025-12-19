-- Add stripe_status column for proper status tracking
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS stripe_status TEXT DEFAULT 'not_configured'
CHECK (stripe_status IN ('not_configured', 'pending', 'verified', 'restricted'));