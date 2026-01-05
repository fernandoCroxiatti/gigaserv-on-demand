-- Add columns to track auto-finalization of services
ALTER TABLE public.chamados 
ADD COLUMN IF NOT EXISTS auto_finished_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_finish_reason TEXT;

-- Add index to efficiently query pending confirmations
CREATE INDEX IF NOT EXISTS idx_chamados_pending_confirmation 
ON public.chamados (status, provider_finish_requested_at) 
WHERE status = 'pending_client_confirmation';

-- Comment for documentation
COMMENT ON COLUMN public.chamados.auto_finished_at IS 'Timestamp when the service was automatically finished due to client inactivity';
COMMENT ON COLUMN public.chamados.auto_finish_reason IS 'Reason for automatic finalization (e.g., client_timeout)';