-- Fix internal notifications RLS policy to use canonical audience values
-- and target REGISTERED profiles (not active session)

DROP POLICY IF EXISTS "Users can view published notifications for their profile" ON public.internal_notifications;

CREATE POLICY "Users can view published notifications for their registered profiles"
ON public.internal_notifications
FOR SELECT
TO authenticated
USING (
  publicada = true
  AND (
    publico = 'todos'
    OR (
      publico = 'clientes'
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.perfil_principal = 'client'
      )
    )
    OR (
      publico = 'prestadores'
      AND EXISTS (
        SELECT 1
        FROM public.provider_data pd
        WHERE pd.user_id = auth.uid()
      )
    )
  )
);