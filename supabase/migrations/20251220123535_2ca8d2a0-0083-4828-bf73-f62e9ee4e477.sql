-- Add column to track declined provider IDs for a chamado
-- This allows the client to know which providers declined and expand radius
ALTER TABLE public.chamados 
ADD COLUMN IF NOT EXISTS declined_provider_ids TEXT[] DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chamados_declined_providers ON public.chamados USING GIN(declined_provider_ids);