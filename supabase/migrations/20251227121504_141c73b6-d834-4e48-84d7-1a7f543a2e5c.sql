-- Create table for scheduled notifications
CREATE TABLE public.scheduled_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('providers', 'clients', 'all')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recipients_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  data JSONB
);

-- Enable RLS
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can manage scheduled notifications
CREATE POLICY "Admins can view scheduled notifications"
  ON public.scheduled_notifications
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert scheduled notifications"
  ON public.scheduled_notifications
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update scheduled notifications"
  ON public.scheduled_notifications
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete scheduled notifications"
  ON public.scheduled_notifications
  FOR DELETE
  USING (is_admin(auth.uid()));

-- Allow service role to manage (for edge functions)
CREATE POLICY "Service role can manage scheduled notifications"
  ON public.scheduled_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for efficient querying of pending notifications
CREATE INDEX idx_scheduled_notifications_status_scheduled 
  ON public.scheduled_notifications (status, scheduled_at) 
  WHERE status = 'pending';

-- Create trigger for updated_at
CREATE TRIGGER update_scheduled_notifications_updated_at
  BEFORE UPDATE ON public.scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();