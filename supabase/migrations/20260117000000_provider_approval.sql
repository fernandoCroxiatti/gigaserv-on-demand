-- Create provider_approval_status enum
CREATE TYPE public.provider_approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Add approval columns to provider_data
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS approval_status provider_approval_status DEFAULT 'pending';
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS cnh_url TEXT;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create storage bucket for provider documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-documents', 'provider-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage.objects in provider-documents
CREATE POLICY "Providers can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'provider-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Providers can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'provider-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can view all provider documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'provider-documents' AND public.is_admin(auth.uid()));

-- Update RLS for provider_data to restrict is_online
-- We need to modify the existing policy or add a constraint
-- Existing policy: "Providers can update own data"
-- We should add a check that they can't set is_online = true if not approved.

CREATE OR REPLACE FUNCTION public.check_provider_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_online = true AND NEW.approval_status != 'approved' THEN
    RAISE EXCEPTION 'Provider must be approved to go online';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_provider_approval_before_online
  BEFORE UPDATE ON public.provider_data
  FOR EACH ROW
  EXECUTE FUNCTION public.check_provider_approval();
