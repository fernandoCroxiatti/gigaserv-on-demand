-- Add Stripe Connect fields to provider_data
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS stripe_onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_provider_data_stripe_account_id ON public.provider_data(stripe_account_id);

-- Update chamados table to track payment details
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS stripe_application_fee_amount NUMERIC;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP WITH TIME ZONE;