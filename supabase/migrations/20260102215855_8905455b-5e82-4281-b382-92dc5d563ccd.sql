-- Create provider_vehicles table for multiple vehicles per provider
CREATE TABLE public.provider_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  vehicle_type TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on plate per provider (same plate can't be registered twice for same provider)
CREATE UNIQUE INDEX idx_provider_vehicles_plate_provider ON public.provider_vehicles(provider_id, UPPER(REPLACE(plate, '-', '')));

-- Create index for fast lookups
CREATE INDEX idx_provider_vehicles_provider_id ON public.provider_vehicles(provider_id);
CREATE INDEX idx_provider_vehicles_primary ON public.provider_vehicles(provider_id, is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE public.provider_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Providers can manage their own vehicles
CREATE POLICY "Providers can view their own vehicles"
ON public.provider_vehicles
FOR SELECT
TO authenticated
USING (auth.uid() = provider_id);

CREATE POLICY "Providers can insert their own vehicles"
ON public.provider_vehicles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can update their own vehicles"
ON public.provider_vehicles
FOR UPDATE
TO authenticated
USING (auth.uid() = provider_id);

CREATE POLICY "Providers can delete their own vehicles"
ON public.provider_vehicles
FOR DELETE
TO authenticated
USING (auth.uid() = provider_id);

-- Admins can view all vehicles
CREATE POLICY "Admins can view all vehicles"
ON public.provider_vehicles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Create trigger to update updated_at
CREATE TRIGGER update_provider_vehicles_updated_at
BEFORE UPDATE ON public.provider_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for vehicles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_vehicles;