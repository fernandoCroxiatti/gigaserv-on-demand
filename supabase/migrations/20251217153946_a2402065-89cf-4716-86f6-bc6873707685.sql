-- Allow providers to accept chamados that are in 'searching' status
-- This is needed because prestador_id is null when accepting, so the existing UPDATE policy fails

CREATE POLICY "Providers can accept searching chamados"
ON public.chamados
FOR UPDATE
TO authenticated
USING (
  status = 'searching'::chamado_status 
  AND public.is_provider(auth.uid())
)
WITH CHECK (
  prestador_id = auth.uid()
  AND status = 'negotiating'::chamado_status
);