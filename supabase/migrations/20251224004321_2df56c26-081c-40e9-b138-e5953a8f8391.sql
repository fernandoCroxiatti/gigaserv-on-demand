-- Drop the restrictive policy that prevents providers from releasing chamados
DROP POLICY IF EXISTS "Providers can accept searching chamados" ON public.chamados;

-- Create a new policy that allows providers to accept chamados (set themselves as prestador)
CREATE POLICY "Providers can accept searching chamados"
ON public.chamados
FOR UPDATE
USING (
  status = 'searching' 
  AND is_provider(auth.uid())
)
WITH CHECK (
  prestador_id = auth.uid() 
  AND status = 'negotiating'
);

-- Create a new policy that allows assigned providers to release/cancel chamados
-- This allows the provider to update the chamado including setting prestador_id to null
CREATE POLICY "Providers can release their assigned chamados"
ON public.chamados
FOR UPDATE
USING (
  prestador_id = auth.uid() 
  AND is_provider(auth.uid())
  AND status IN ('searching', 'accepted', 'negotiating', 'awaiting_payment')
)
WITH CHECK (
  -- Allow setting prestador_id to null (releasing the chamado)
  (prestador_id IS NULL AND status = 'searching')
  OR
  -- Or keep the provider assigned with valid status transitions
  (prestador_id = auth.uid())
);