-- Add pending_client_confirmation status to chamado_status enum
ALTER TYPE chamado_status ADD VALUE IF NOT EXISTS 'pending_client_confirmation' AFTER 'in_service';

-- Add column to track when provider requested finish
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS provider_finish_requested_at TIMESTAMP WITH TIME ZONE;