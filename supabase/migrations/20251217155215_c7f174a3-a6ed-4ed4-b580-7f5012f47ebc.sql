-- Create reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID REFERENCES public.chamados(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID NOT NULL,
  reviewed_id UUID NOT NULL,
  reviewer_type public.user_profile_type NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  tags TEXT[] DEFAULT '{}',
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  UNIQUE (chamado_id, reviewer_type)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Users can view reviews about themselves
CREATE POLICY "Users can view their own reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (reviewed_id = auth.uid());

-- Users can view reviews they created
CREATE POLICY "Users can view reviews they created"
ON public.reviews
FOR SELECT
TO authenticated
USING (reviewer_id = auth.uid());

-- Users can create reviews for chamados they participated in
CREATE POLICY "Users can create reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (reviewer_id = auth.uid());

-- Function to update provider rating after a review
CREATE OR REPLACE FUNCTION public.update_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating DECIMAL;
  total_reviews INTEGER;
BEGIN
  -- Only update if the reviewed user is a provider
  IF NEW.reviewer_type = 'client' THEN
    -- Calculate new average rating
    SELECT AVG(rating)::DECIMAL, COUNT(*) 
    INTO avg_rating, total_reviews
    FROM public.reviews
    WHERE reviewed_id = NEW.reviewed_id AND reviewer_type = 'client';
    
    -- Update provider_data
    UPDATE public.provider_data
    SET 
      rating = COALESCE(avg_rating, 5.0),
      total_services = COALESCE(total_reviews, 0)
    WHERE user_id = NEW.reviewed_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update provider rating
CREATE TRIGGER update_provider_rating_trigger
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_provider_rating();