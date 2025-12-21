-- Enum para tipo de taxa
CREATE TYPE public.fee_type AS ENUM ('STRIPE', 'MANUAL_PIX');

-- Enum para status financeiro
CREATE TYPE public.financial_status AS ENUM ('PAGO', 'DEVENDO', 'AGUARDANDO_APROVACAO');

-- Tabela de taxas do prestador
CREATE TABLE public.provider_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL,
  service_value NUMERIC NOT NULL,
  fee_percentage NUMERIC NOT NULL,
  fee_amount NUMERIC NOT NULL,
  fee_type fee_type NOT NULL,
  status financial_status NOT NULL DEFAULT 'DEVENDO',
  payment_declared_at TIMESTAMP WITH TIME ZONE,
  payment_approved_at TIMESTAMP WITH TIME ZONE,
  payment_approved_by UUID,
  payment_rejected_at TIMESTAMP WITH TIME ZONE,
  payment_rejected_by UUID,
  payment_proof_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chamado_id, provider_id)
);

-- Adicionar campos de status financeiro ao provider_data
ALTER TABLE public.provider_data 
  ADD COLUMN IF NOT EXISTS financial_status financial_status DEFAULT 'PAGO',
  ADD COLUMN IF NOT EXISTS pending_fee_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS financial_block_reason TEXT;

-- Adicionar configurações PIX ao app_settings (será inserido abaixo)
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'pix_config',
  '{"key_type": "random", "key": "", "recipient_name": "GIGA S.O.S", "bank_name": ""}',
  'Configuração da chave PIX para pagamento de taxas'
) ON CONFLICT (key) DO NOTHING;

-- Enable RLS on provider_fees
ALTER TABLE public.provider_fees ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para provider_fees
-- Prestadores podem ver suas próprias taxas
CREATE POLICY "Providers can view their own fees"
ON public.provider_fees
FOR SELECT
USING (auth.uid() = provider_id);

-- Prestadores podem atualizar apenas para declarar pagamento
CREATE POLICY "Providers can declare payment"
ON public.provider_fees
FOR UPDATE
USING (auth.uid() = provider_id)
WITH CHECK (
  auth.uid() = provider_id 
  AND status = 'AGUARDANDO_APROVACAO'
);

-- Admins podem ver todas as taxas
CREATE POLICY "Admins can view all fees"
ON public.provider_fees
FOR SELECT
USING (is_admin(auth.uid()));

-- Admins podem atualizar qualquer taxa
CREATE POLICY "Admins can update any fee"
ON public.provider_fees
FOR UPDATE
USING (is_admin(auth.uid()));

-- Admins podem inserir taxas
CREATE POLICY "Admins can insert fees"
ON public.provider_fees
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Service role pode inserir (para edge functions)
CREATE POLICY "Service role can insert fees"
ON public.provider_fees
FOR INSERT
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_provider_fees_updated_at
BEFORE UPDATE ON public.provider_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campo de método de pagamento direto aos chamados
ALTER TABLE public.chamados
  ADD COLUMN IF NOT EXISTS direct_payment_to_provider BOOLEAN DEFAULT false;

-- Enable realtime for provider_fees
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_fees;