-- Add scheduling column to internal_notifications
ALTER TABLE public.internal_notifications
ADD COLUMN agendada_para TIMESTAMP WITH TIME ZONE,
ADD COLUMN status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'agendada', 'publicada'));

-- Update existing published notifications
UPDATE public.internal_notifications 
SET status = 'publicada' 
WHERE publicada = true;

-- Create index for scheduled notifications query
CREATE INDEX idx_internal_notifications_agendada 
ON public.internal_notifications(agendada_para, status) 
WHERE status = 'agendada';