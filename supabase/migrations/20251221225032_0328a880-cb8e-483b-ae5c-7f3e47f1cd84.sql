DO $$
BEGIN
  -- Allow admins to see notification preferences (needed for admin analytics & targeting)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_preferences'
      AND policyname = 'Admins can view all notification preferences'
  ) THEN
    CREATE POLICY "Admins can view all notification preferences"
    ON public.notification_preferences
    FOR SELECT
    USING (is_admin(auth.uid()));
  END IF;

  -- Allow admins to see notification subscriptions (needed to understand how many devices are subscribed)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_subscriptions'
      AND policyname = 'Admins can view all notification subscriptions'
  ) THEN
    CREATE POLICY "Admins can view all notification subscriptions"
    ON public.notification_subscriptions
    FOR SELECT
    USING (is_admin(auth.uid()));
  END IF;

  -- Allow admins to see notification history (needed for admin reporting)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_history'
      AND policyname = 'Admins can view all notification history'
  ) THEN
    CREATE POLICY "Admins can view all notification history"
    ON public.notification_history
    FOR SELECT
    USING (is_admin(auth.uid()));
  END IF;
END $$;