-- Add unique constraint on CPF for profiles table
-- First, create a partial unique index to ensure unique non-null CPF values
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique_idx ON public.profiles (cpf) 
WHERE cpf IS NOT NULL AND cpf != '';

-- Add a comment to document the constraint
COMMENT ON INDEX profiles_cpf_unique_idx IS 'Ensures CPF is unique across all profiles when provided';