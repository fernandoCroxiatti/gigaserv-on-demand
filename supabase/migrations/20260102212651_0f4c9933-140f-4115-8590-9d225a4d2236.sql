-- Tighten internal_notifications audience isolation
-- Goal: A notification posted to 'clientes' must NEVER be visible to registered providers.

BEGIN;

DROP POLICY IF EXISTS "Users can view published notifications for their registered profiles" ON public.internal_notifications;

CREATE POLICY "Users can view published notifications for their registered profiles"
ON public.internal_notifications
FOR SELECT
TO authenticated
USING (
  publicada = true
  AND (
    -- Everyone
    publico = 'todos'

    -- Clients ONLY (exclude any registered provider)
    OR (
      publico = 'clientes'
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.perfil_principal = 'client'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.provider_data pd
        WHERE pd.user_id = auth.uid()
      )
    )

    -- Providers
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

COMMIT;