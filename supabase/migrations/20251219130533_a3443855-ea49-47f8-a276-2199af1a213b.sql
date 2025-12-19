-- Add navigation phase and route data to chamados for synced navigation
ALTER TABLE public.chamados
ADD COLUMN IF NOT EXISTS navigation_phase TEXT DEFAULT 'going_to_vehicle',
ADD COLUMN IF NOT EXISTS route_polyline TEXT,
ADD COLUMN IF NOT EXISTS route_distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS route_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS provider_arrived_at_vehicle BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS provider_arrived_at_destination BOOLEAN DEFAULT FALSE;

-- Create index for real-time navigation queries
CREATE INDEX IF NOT EXISTS idx_chamados_in_service ON public.chamados(status) WHERE status = 'in_service';

-- Comment on columns
COMMENT ON COLUMN public.chamados.navigation_phase IS 'Current navigation phase: going_to_vehicle or going_to_destination';
COMMENT ON COLUMN public.chamados.route_polyline IS 'Encoded polyline from Directions API (calculated once per phase)';
COMMENT ON COLUMN public.chamados.route_distance_meters IS 'Total route distance in meters';
COMMENT ON COLUMN public.chamados.route_duration_seconds IS 'Estimated route duration in seconds';