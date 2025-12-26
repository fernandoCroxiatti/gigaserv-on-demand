-- Create function to detect high severity patterns and notify admins
CREATE OR REPLACE FUNCTION public.detect_high_severity_pattern()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_detection_reason TEXT;
  v_should_alert BOOLEAN := false;
  v_pair_cancellations INTEGER;
  v_provider_patterns INTEGER;
  v_client_patterns INTEGER;
  v_provider_reliability NUMERIC;
  v_client_reliability NUMERIC;
  v_thirty_days_ago TIMESTAMP := NOW() - INTERVAL '30 days';
BEGIN
  -- Only process cancellations after accept
  IF NEW.status != 'canceled' OR OLD.status IN ('idle', 'searching', 'canceled') THEN
    RETURN NEW;
  END IF;

  -- Skip if no client or provider
  IF NEW.cliente_id IS NULL OR NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check 1: 2+ cancellations on same pair within 30 days
  SELECT COUNT(*) INTO v_pair_cancellations
  FROM public.chamados
  WHERE cliente_id = NEW.cliente_id
    AND prestador_id = NEW.prestador_id
    AND status = 'canceled'
    AND cancelled_at >= v_thirty_days_ago
    AND cancelled_at IS NOT NULL;

  IF v_pair_cancellations >= 2 THEN
    v_should_alert := true;
    v_detection_reason := COALESCE(v_detection_reason || '; ', '') || 
      'Cancelamentos recorrentes no par cliente-prestador: ' || v_pair_cancellations || ' nos últimos 30 dias';
  END IF;

  -- Check 2: Recurrence in suspicious_patterns (3+ occurrences for same user)
  SELECT COUNT(*) INTO v_provider_patterns
  FROM public.suspicious_patterns
  WHERE provider_id = NEW.prestador_id
    AND created_at >= v_thirty_days_ago;

  SELECT COUNT(*) INTO v_client_patterns
  FROM public.suspicious_patterns
  WHERE client_id = NEW.cliente_id
    AND created_at >= v_thirty_days_ago;

  IF v_provider_patterns >= 3 OR v_client_patterns >= 3 THEN
    v_should_alert := true;
    v_detection_reason := COALESCE(v_detection_reason || '; ', '') || 
      'Reincidência em padrões suspeitos: prestador=' || v_provider_patterns || ', cliente=' || v_client_patterns;
  END IF;

  -- Check 3: Low reliability score + cancellation
  SELECT reliability_score INTO v_provider_reliability
  FROM public.provider_data
  WHERE user_id = NEW.prestador_id;

  SELECT client_reliability_score INTO v_client_reliability
  FROM public.profiles
  WHERE user_id = NEW.cliente_id;

  IF (v_provider_reliability IS NOT NULL AND v_provider_reliability < 40) OR 
     (v_client_reliability IS NOT NULL AND v_client_reliability < 40) THEN
    v_should_alert := true;
    v_detection_reason := COALESCE(v_detection_reason || '; ', '') || 
      'Baixa pontuação de confiabilidade: prestador=' || COALESCE(v_provider_reliability::TEXT, 'N/A') || 
      ', cliente=' || COALESCE(v_client_reliability::TEXT, 'N/A');
  END IF;

  -- If high severity detected, create alert
  IF v_should_alert THEN
    INSERT INTO public.suspicious_patterns (
      pattern_type,
      client_id,
      provider_id,
      chamado_id,
      severity,
      details
    ) VALUES (
      'high_severity_auto_alert',
      NEW.cliente_id,
      NEW.prestador_id,
      NEW.id,
      'high',
      jsonb_build_object(
        'detection_reason', v_detection_reason,
        'cancellation_reason', NEW.cancellation_reason,
        'cancellation_category', NEW.cancellation_category,
        'time_to_cancel_seconds', NEW.time_to_cancel_seconds,
        'pair_cancellations_30d', v_pair_cancellations,
        'provider_patterns_30d', v_provider_patterns,
        'client_patterns_30d', v_client_patterns,
        'provider_reliability', v_provider_reliability,
        'client_reliability', v_client_reliability,
        'auto_detected', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for high severity detection
DROP TRIGGER IF EXISTS trigger_detect_high_severity ON public.chamados;
CREATE TRIGGER trigger_detect_high_severity
  AFTER UPDATE ON public.chamados
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_high_severity_pattern();