-- Add vehicle_plate column to provider_data table
ALTER TABLE public.provider_data 
ADD COLUMN IF NOT EXISTS vehicle_plate text;