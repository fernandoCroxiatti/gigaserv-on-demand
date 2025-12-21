-- Add fields for tracking direct payment receipt confirmation
ALTER TABLE public.chamados
ADD COLUMN IF NOT EXISTS direct_payment_receipt_confirmed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS direct_payment_confirmed_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.chamados.direct_payment_receipt_confirmed IS 'Indicates if provider confirmed receiving direct payment from client';
COMMENT ON COLUMN public.chamados.direct_payment_confirmed_at IS 'Timestamp when provider confirmed receiving direct payment';