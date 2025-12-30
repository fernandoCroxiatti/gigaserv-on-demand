-- Create table for address history
CREATE TABLE public.address_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  address TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  place_id TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on user_id + place_id to avoid duplicates
CREATE UNIQUE INDEX idx_address_history_user_place ON public.address_history(user_id, place_id) WHERE place_id IS NOT NULL;

-- Create index for efficient queries
CREATE INDEX idx_address_history_user_last_used ON public.address_history(user_id, last_used_at DESC);

-- Enable RLS
ALTER TABLE public.address_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own address history
CREATE POLICY "Users can view their own address history"
ON public.address_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own address history
CREATE POLICY "Users can insert their own address history"
ON public.address_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own address history
CREATE POLICY "Users can update their own address history"
ON public.address_history
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own address history
CREATE POLICY "Users can delete their own address history"
ON public.address_history
FOR DELETE
USING (auth.uid() = user_id);