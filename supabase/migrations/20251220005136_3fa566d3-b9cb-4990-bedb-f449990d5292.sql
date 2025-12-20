-- Create table for storing provider payouts from Stripe
CREATE TABLE public.provider_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payout_id TEXT NOT NULL UNIQUE,
  stripe_account_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT NOT NULL DEFAULT 'brl',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_transit, paid, failed, canceled
  arrival_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  failure_code TEXT,
  failure_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.provider_payouts ENABLE ROW LEVEL SECURITY;

-- Providers can only view their own payouts
CREATE POLICY "Providers can view their own payouts"
  ON public.provider_payouts
  FOR SELECT
  USING (auth.uid() = provider_id);

-- Create index for faster lookups
CREATE INDEX idx_provider_payouts_provider_id ON public.provider_payouts(provider_id);
CREATE INDEX idx_provider_payouts_stripe_payout_id ON public.provider_payouts(stripe_payout_id);

-- Add trigger for updated_at
CREATE TRIGGER update_provider_payouts_updated_at
  BEFORE UPDATE ON public.provider_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for provider_payouts
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_payouts;