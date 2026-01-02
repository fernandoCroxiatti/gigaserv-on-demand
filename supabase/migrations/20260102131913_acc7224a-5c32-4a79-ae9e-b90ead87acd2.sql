-- Create internal notifications table
CREATE TABLE public.internal_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  imagem_url TEXT,
  publico TEXT NOT NULL DEFAULT 'ambos' CHECK (publico IN ('cliente', 'prestador', 'ambos')),
  publicada BOOLEAN NOT NULL DEFAULT false,
  criada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  publicada_em TIMESTAMP WITH TIME ZONE,
  criada_por UUID REFERENCES auth.users(id)
);

-- Create notification reads table
CREATE TABLE public.internal_notification_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notificacao_id UUID NOT NULL REFERENCES public.internal_notifications(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  lida_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notificacao_id, usuario_id)
);

-- Enable RLS
ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notification_reads ENABLE ROW LEVEL SECURITY;

-- RLS policies for internal_notifications
CREATE POLICY "Admins can manage internal notifications"
ON public.internal_notifications
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can view published notifications for their profile"
ON public.internal_notifications
FOR SELECT
USING (
  publicada = true AND (
    publico = 'ambos' OR
    (publico = 'cliente' AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND perfil_principal = 'client'
    )) OR
    (publico = 'prestador' AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND perfil_principal = 'provider'
    ))
  )
);

-- RLS policies for internal_notification_reads
CREATE POLICY "Users can read their own notification reads"
ON public.internal_notification_reads
FOR SELECT
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert their own notification reads"
ON public.internal_notification_reads
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Admins can view all notification reads"
ON public.internal_notification_reads
FOR SELECT
USING (is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_internal_notifications_publicada ON public.internal_notifications(publicada, publico);
CREATE INDEX idx_internal_notifications_criada_em ON public.internal_notifications(criada_em DESC);
CREATE INDEX idx_internal_notification_reads_usuario ON public.internal_notification_reads(usuario_id);
CREATE INDEX idx_internal_notification_reads_notificacao ON public.internal_notification_reads(notificacao_id);