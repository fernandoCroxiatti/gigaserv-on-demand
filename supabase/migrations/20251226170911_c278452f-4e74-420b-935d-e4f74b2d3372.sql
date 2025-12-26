-- Add password recovery tracking fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password_recovery_last_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS password_recovery_count integer DEFAULT 0;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_password_recovery ON public.profiles(phone, password_recovery_last_at);