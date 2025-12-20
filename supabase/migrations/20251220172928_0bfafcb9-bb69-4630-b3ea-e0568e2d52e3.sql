-- Table for storing push notification subscriptions
CREATE TABLE public.notification_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Table for notification preferences
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  permission_asked_at TIMESTAMP WITH TIME ZONE,
  permission_granted BOOLEAN DEFAULT false,
  chamado_updates BOOLEAN NOT NULL DEFAULT true,
  promotional BOOLEAN NOT NULL DEFAULT true,
  last_promotional_sent_at TIMESTAMP WITH TIME ZONE,
  last_engagement_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for notification history (to prevent spam)
CREATE TABLE public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clicked_at TIMESTAMP WITH TIME ZONE
);

-- Create index for efficient querying
CREATE INDEX idx_notification_history_user_type ON public.notification_history(user_id, notification_type, sent_at);
CREATE INDEX idx_notification_subscriptions_user ON public.notification_subscriptions(user_id);

-- Enable RLS
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.notification_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.notification_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.notification_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.notification_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for notification_history
CREATE POLICY "Users can view their own notification history"
  ON public.notification_history FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert notifications"
  ON public.notification_history FOR INSERT
  WITH CHECK (true);

-- Enable realtime for preferences updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;