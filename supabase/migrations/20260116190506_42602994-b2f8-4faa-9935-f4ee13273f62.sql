-- Add new payment status columns for card authorization flow
ALTER TABLE public.chamados
ADD COLUMN IF NOT EXISTS payment_authorized_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_captured_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_canceled_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient querying of authorized payments
CREATE INDEX IF NOT EXISTS idx_chamados_payment_authorized_at ON public.chamados(payment_authorized_at) WHERE payment_authorized_at IS NOT NULL;

-- Update payment_status enum comment for clarity
COMMENT ON COLUMN public.chamados.payment_status IS 'Payment status: pending, authorized (card hold), paid_stripe (captured), paid_mock, failed, refunded, canceled';