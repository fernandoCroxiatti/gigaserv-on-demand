-- Fix fee calculation: allow the app to read commission setting under RLS

-- Ensure RLS is enabled (already true, but keep idempotent)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Public read (non-sensitive settings like commission percentage)
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Anyone can read app settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Admin-only management
DROP POLICY IF EXISTS "Admins can insert app settings" ON public.app_settings;
CREATE POLICY "Admins can insert app settings"
ON public.app_settings
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
CREATE POLICY "Admins can update app settings"
ON public.app_settings
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete app settings" ON public.app_settings;
CREATE POLICY "Admins can delete app settings"
ON public.app_settings
FOR DELETE
USING (public.is_admin(auth.uid()));
