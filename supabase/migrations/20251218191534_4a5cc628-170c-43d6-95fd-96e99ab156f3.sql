-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- RLS policies for user_roles - only admins can manage
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Create app_settings table for app configuration
CREATE TABLE public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for app_settings
CREATE POLICY "Anyone can read app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can update app settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can insert app settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Create settings_history table for audit trail
CREATE TABLE public.settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    changed_by UUID REFERENCES auth.users(id) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on settings_history
ALTER TABLE public.settings_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for settings_history
CREATE POLICY "Admins can view settings history"
ON public.settings_history
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert settings history"
ON public.settings_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Create admin_logs table for admin activity audit
CREATE TABLE public.admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on admin_logs
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_logs
CREATE POLICY "Admins can view admin logs"
ON public.admin_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert admin logs"
ON public.admin_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Add columns to profiles for admin management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS block_reason TEXT;

-- Add columns to provider_data for admin management
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id);
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS block_reason TEXT;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN DEFAULT false;
ALTER TABLE public.provider_data ADD COLUMN IF NOT EXISTS payout_enabled BOOLEAN DEFAULT true;

-- Insert default app settings
INSERT INTO public.app_settings (key, value, description)
VALUES ('app_commission_percentage', '{"value": 15}', 'Porcentagem de comissão do app sobre cada corrida')
ON CONFLICT (key) DO NOTHING;

-- Add commission tracking to chamados
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC DEFAULT 15;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS commission_amount NUMERIC;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS provider_amount NUMERIC;

-- Create trigger to track settings changes
CREATE OR REPLACE FUNCTION public.log_settings_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.settings_history (setting_key, old_value, new_value, changed_by)
  VALUES (NEW.key, OLD.value, NEW.value, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_settings_update
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_settings_change();

-- Assign admin role to existing user 15988218568@gigasos.app
-- First, we need to get the user_id from profiles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.profiles
WHERE email = '15988218568@gigasos.app'
ON CONFLICT (user_id, role) DO NOTHING;