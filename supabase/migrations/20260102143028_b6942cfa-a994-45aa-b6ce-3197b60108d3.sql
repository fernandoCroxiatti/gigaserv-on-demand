-- Add destaque field to internal_notifications table
ALTER TABLE public.internal_notifications 
ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false;

-- Add index for faster lookup of highlight notifications
CREATE INDEX IF NOT EXISTS idx_internal_notifications_destaque 
ON public.internal_notifications (destaque) 
WHERE destaque = true AND publicada = true;