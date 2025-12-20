-- Create vehicle_type enum
CREATE TYPE public.vehicle_type AS ENUM (
  'carro_passeio',
  'carro_utilitario', 
  'pickup',
  'van',
  'moto',
  'caminhao_toco',
  'caminhao_34',
  'truck',
  'carreta',
  'cavalinho',
  'onibus',
  'micro_onibus',
  'outro'
);

-- Add vehicle_type column to chamados table
ALTER TABLE public.chamados 
ADD COLUMN vehicle_type public.vehicle_type DEFAULT NULL;