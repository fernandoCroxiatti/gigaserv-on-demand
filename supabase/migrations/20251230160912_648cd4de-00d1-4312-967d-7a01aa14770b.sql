-- Add negotiation tracking fields to chamados table
ALTER TABLE public.chamados
ADD COLUMN IF NOT EXISTS last_proposal_by TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS value_accepted BOOLEAN DEFAULT false;

-- Add comment to explain fields
COMMENT ON COLUMN public.chamados.last_proposal_by IS 'Tracks who made the last value proposal: client or provider';
COMMENT ON COLUMN public.chamados.value_accepted IS 'Indicates if both parties have agreed on the value';