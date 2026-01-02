-- Fix function search path for security
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
$$ LANGUAGE plpgsql
SET search_path = public;