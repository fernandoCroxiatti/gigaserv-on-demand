-- Fix 4: Add input validation constraints (the functions were already updated successfully)
ALTER TABLE public.chat_messages
ADD CONSTRAINT message_length_limit CHECK (length(message) <= 2000);

ALTER TABLE public.chamados
ADD CONSTRAINT origem_address_length CHECK (length(origem_address) <= 500);

ALTER TABLE public.chamados
ADD CONSTRAINT destino_address_length CHECK (destino_address IS NULL OR length(destino_address) <= 500);