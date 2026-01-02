-- Add expiration fields to internal_notifications
ALTER TABLE public.internal_notifications
ADD COLUMN IF NOT EXISTS expira_em timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS acao_pendente boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS acao_tipo text DEFAULT NULL;

-- Create index for expiration queries
CREATE INDEX IF NOT EXISTS idx_internal_notifications_expira_em 
ON public.internal_notifications(expira_em) 
WHERE expira_em IS NOT NULL;

-- Create function to auto-set expiration on insert/update
CREATE OR REPLACE FUNCTION public.set_notification_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set expiration if not a pending action notification and expira_em is null
  IF NEW.acao_pendente = false AND NEW.expira_em IS NULL AND NEW.publicada = true THEN
    -- Set expiration to 24 hours from publication
    NEW.expira_em := COALESCE(NEW.publicada_em, now()) + interval '24 hours';
  END IF;
  
  -- For pending action notifications, set longer expiration (30 days) if not set
  IF NEW.acao_pendente = true AND NEW.expira_em IS NULL AND NEW.publicada = true THEN
    NEW.expira_em := COALESCE(NEW.publicada_em, now()) + interval '30 days';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-expiration
DROP TRIGGER IF EXISTS set_notification_expiration_trigger ON public.internal_notifications;
CREATE TRIGGER set_notification_expiration_trigger
BEFORE INSERT OR UPDATE ON public.internal_notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_notification_expiration();