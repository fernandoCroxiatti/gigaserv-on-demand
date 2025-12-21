-- Add column to track when warning notification was sent
ALTER TABLE public.provider_data
ADD COLUMN IF NOT EXISTS pending_fee_warning_sent_at timestamp with time zone DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.provider_data.pending_fee_warning_sent_at IS 'Timestamp of when the 70% limit warning was last sent';

-- Create function to check and return providers needing warning
CREATE OR REPLACE FUNCTION public.get_providers_needing_warning()
RETURNS TABLE (
  user_id uuid,
  pending_balance numeric,
  max_limit numeric,
  percent_used numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pd.user_id,
    COALESCE(pd.pending_fee_balance, 0) as pending_balance,
    COALESCE(pd.max_debt_limit, 400) as max_limit,
    CASE 
      WHEN COALESCE(pd.max_debt_limit, 400) > 0 
      THEN (COALESCE(pd.pending_fee_balance, 0) / COALESCE(pd.max_debt_limit, 400)) * 100
      ELSE 0
    END as percent_used
  FROM public.provider_data pd
  WHERE 
    -- At least 70% of limit
    COALESCE(pd.pending_fee_balance, 0) >= (COALESCE(pd.max_debt_limit, 400) * 0.70)
    -- Not blocked yet (under 100%)
    AND COALESCE(pd.pending_fee_balance, 0) < COALESCE(pd.max_debt_limit, 400)
    -- Not already warned in the last 24 hours
    AND (
      pd.pending_fee_warning_sent_at IS NULL 
      OR pd.pending_fee_warning_sent_at < NOW() - INTERVAL '24 hours'
    )
    -- Not blocked or fraud flagged
    AND COALESCE(pd.permanently_blocked, false) = false
    AND COALESCE(pd.fraud_flagged, false) = false;
END;
$$;