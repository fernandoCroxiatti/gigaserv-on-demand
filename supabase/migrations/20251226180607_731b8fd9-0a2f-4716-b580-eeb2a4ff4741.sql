-- ============================================
-- PLATFORM INTEGRITY SYSTEM (Fixed precision)
-- Implements fraud prevention without blocking legitimate user actions
-- ============================================

-- 1. Add reliability metrics to provider_data
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS cancellations_after_accept INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_accepted_services INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_completed_services INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reliability_score NUMERIC(5,2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS last_reliability_update TIMESTAMP WITH TIME ZONE;

-- 2. Add reliability metrics for clients in profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS client_cancellations_after_accept INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_total_services INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_completed_services INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_reliability_score NUMERIC(5,2) DEFAULT 100.00;

-- 3. Add cancellation reason and tracking to chamados
ALTER TABLE public.chamados
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_category TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by UUID,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS time_to_cancel_seconds INTEGER;

-- 4. Create suspicious patterns table for admin review
CREATE TABLE IF NOT EXISTS public.suspicious_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL,
  client_id UUID,
  provider_id UUID,
  chamado_id UUID REFERENCES public.chamados(id),
  details JSONB,
  severity TEXT DEFAULT 'low',
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  action_taken TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on suspicious_patterns
ALTER TABLE public.suspicious_patterns ENABLE ROW LEVEL SECURITY;

-- Only admins can access suspicious_patterns
CREATE POLICY "Admins can view suspicious patterns"
  ON public.suspicious_patterns
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert suspicious patterns"
  ON public.suspicious_patterns
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update suspicious patterns"
  ON public.suspicious_patterns
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- 5. Create client-provider pair tracking table
CREATE TABLE IF NOT EXISTS public.service_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  total_services INTEGER DEFAULT 1,
  completed_services INTEGER DEFAULT 0,
  cancelled_services INTEGER DEFAULT 0,
  last_service_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  flagged_for_review BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(client_id, provider_id)
);

-- Enable RLS on service_pairs
ALTER TABLE public.service_pairs ENABLE ROW LEVEL SECURITY;

-- Only admins can view service pairs
CREATE POLICY "Admins can view service pairs"
  ON public.service_pairs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- System can insert/update service pairs
CREATE POLICY "System can manage service pairs"
  ON public.service_pairs
  FOR ALL
  USING (true);

-- 6. Function to update reliability metrics
CREATE OR REPLACE FUNCTION public.update_reliability_metrics()
RETURNS TRIGGER AS $$
DECLARE
  v_time_diff INTEGER;
BEGIN
  -- Only process status changes to finished or canceled
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Track service completion
  IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
    -- Update provider metrics
    IF NEW.prestador_id IS NOT NULL THEN
      UPDATE public.provider_data
      SET total_completed_services = COALESCE(total_completed_services, 0) + 1,
          reliability_score = LEAST(100, COALESCE(reliability_score, 100) + 0.5),
          last_reliability_update = now()
      WHERE user_id = NEW.prestador_id;
    END IF;
    
    -- Update client metrics
    IF NEW.cliente_id IS NOT NULL THEN
      UPDATE public.profiles
      SET client_completed_services = COALESCE(client_completed_services, 0) + 1,
          client_reliability_score = LEAST(100, COALESCE(client_reliability_score, 100) + 0.5)
      WHERE user_id = NEW.cliente_id;
    END IF;
    
    -- Update service pair
    IF NEW.cliente_id IS NOT NULL AND NEW.prestador_id IS NOT NULL THEN
      INSERT INTO public.service_pairs (client_id, provider_id, completed_services, last_service_at)
      VALUES (NEW.cliente_id, NEW.prestador_id, 1, now())
      ON CONFLICT (client_id, provider_id) 
      DO UPDATE SET 
        completed_services = service_pairs.completed_services + 1,
        last_service_at = now();
    END IF;
  END IF;
  
  -- Track cancellation after accept
  IF NEW.status = 'canceled' AND OLD.status NOT IN ('idle', 'searching', 'canceled') THEN
    v_time_diff := EXTRACT(EPOCH FROM (now() - NEW.created_at))::INTEGER;
    
    -- Set cancellation metadata
    NEW.time_to_cancel_seconds := v_time_diff;
    NEW.cancelled_at := now();
    
    -- Update provider metrics if they were assigned
    IF NEW.prestador_id IS NOT NULL THEN
      UPDATE public.provider_data
      SET cancellations_after_accept = COALESCE(cancellations_after_accept, 0) + 1,
          reliability_score = GREATEST(0, COALESCE(reliability_score, 100) - 2),
          last_reliability_update = now()
      WHERE user_id = NEW.prestador_id;
    END IF;
    
    -- Update client metrics
    IF NEW.cliente_id IS NOT NULL THEN
      UPDATE public.profiles
      SET client_cancellations_after_accept = COALESCE(client_cancellations_after_accept, 0) + 1,
          client_reliability_score = GREATEST(0, COALESCE(client_reliability_score, 100) - 2)
      WHERE user_id = NEW.cliente_id;
    END IF;
    
    -- Update service pair
    IF NEW.cliente_id IS NOT NULL AND NEW.prestador_id IS NOT NULL THEN
      INSERT INTO public.service_pairs (client_id, provider_id, cancelled_services, last_service_at)
      VALUES (NEW.cliente_id, NEW.prestador_id, 1, now())
      ON CONFLICT (client_id, provider_id) 
      DO UPDATE SET 
        cancelled_services = service_pairs.cancelled_services + 1,
        last_service_at = now();
    END IF;
    
    -- Detect quick cancellation pattern (within 3 minutes of accept)
    IF v_time_diff < 180 AND NEW.prestador_id IS NOT NULL THEN
      INSERT INTO public.suspicious_patterns (
        pattern_type,
        client_id,
        provider_id,
        chamado_id,
        severity,
        details
      ) VALUES (
        'quick_cancellation',
        NEW.cliente_id,
        NEW.prestador_id,
        NEW.id,
        'medium',
        jsonb_build_object(
          'seconds_to_cancel', v_time_diff,
          'cancellation_reason', NEW.cancellation_reason
        )
      );
    END IF;
  END IF;
  
  -- Track when provider accepts a service
  IF NEW.status = 'negotiating' AND OLD.status = 'searching' AND NEW.prestador_id IS NOT NULL THEN
    UPDATE public.provider_data
    SET total_accepted_services = COALESCE(total_accepted_services, 0) + 1
    WHERE user_id = NEW.prestador_id;
    
    -- Update service pair total
    IF NEW.cliente_id IS NOT NULL THEN
      INSERT INTO public.service_pairs (client_id, provider_id, total_services, last_service_at)
      VALUES (NEW.cliente_id, NEW.prestador_id, 1, now())
      ON CONFLICT (client_id, provider_id) 
      DO UPDATE SET 
        total_services = service_pairs.total_services + 1,
        last_service_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for reliability metrics
DROP TRIGGER IF EXISTS trigger_update_reliability_metrics ON public.chamados;
CREATE TRIGGER trigger_update_reliability_metrics
  BEFORE UPDATE ON public.chamados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reliability_metrics();

-- 7. Function to detect recurring client-provider pairs
CREATE OR REPLACE FUNCTION public.detect_suspicious_pairs()
RETURNS TRIGGER AS $$
DECLARE
  v_cancel_rate NUMERIC;
BEGIN
  -- Only check completed pairs
  IF NEW.total_services < 3 THEN
    RETURN NEW;
  END IF;
  
  -- Calculate cancellation rate
  v_cancel_rate := NEW.cancelled_services::NUMERIC / NULLIF(NEW.total_services, 0);
  
  -- Flag if high cancellation rate (over 50% after 3+ services)
  IF v_cancel_rate > 0.5 AND NOT NEW.flagged_for_review THEN
    NEW.flagged_for_review := true;
    
    INSERT INTO public.suspicious_patterns (
      pattern_type,
      client_id,
      provider_id,
      severity,
      details
    ) VALUES (
      'high_cancellation_pair',
      NEW.client_id,
      NEW.provider_id,
      'high',
      jsonb_build_object(
        'total_services', NEW.total_services,
        'cancelled_services', NEW.cancelled_services,
        'cancellation_rate', v_cancel_rate
      )
    );
  END IF;
  
  -- Flag recurring pair with no completions
  IF NEW.total_services >= 5 AND NEW.completed_services = 0 THEN
    INSERT INTO public.suspicious_patterns (
      pattern_type,
      client_id,
      provider_id,
      severity,
      details
    ) VALUES (
      'recurring_pair_no_completion',
      NEW.client_id,
      NEW.provider_id,
      'high',
      jsonb_build_object(
        'total_services', NEW.total_services,
        'completed_services', NEW.completed_services
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for suspicious pair detection
DROP TRIGGER IF EXISTS trigger_detect_suspicious_pairs ON public.service_pairs;
CREATE TRIGGER trigger_detect_suspicious_pairs
  BEFORE UPDATE ON public.service_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_suspicious_pairs();

-- 8. Enable realtime for suspicious_patterns (for admin notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.suspicious_patterns;

-- 9. Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_suspicious_patterns_reviewed ON public.suspicious_patterns(reviewed, created_at);
CREATE INDEX IF NOT EXISTS idx_service_pairs_flagged ON public.service_pairs(flagged_for_review);
CREATE INDEX IF NOT EXISTS idx_chamados_cancellation ON public.chamados(cancelled_at, cancellation_category);