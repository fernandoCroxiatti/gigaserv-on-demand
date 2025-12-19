-- Add admin RLS policies for proper platform management
-- These policies use the existing is_admin() function

-- =====================================================
-- PROFILES TABLE - Admin access for user management
-- =====================================================
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- =====================================================
-- PROVIDER_DATA TABLE - Admin access for provider management
-- =====================================================
CREATE POLICY "Admins can view all provider data"
ON public.provider_data
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update any provider data"
ON public.provider_data
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- =====================================================
-- CHAMADOS TABLE - Admin access for service management
-- =====================================================
CREATE POLICY "Admins can view all chamados"
ON public.chamados
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update any chamado"
ON public.chamados
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete chamados"
ON public.chamados
FOR DELETE
USING (public.is_admin(auth.uid()));

-- =====================================================
-- CHAT_MESSAGES TABLE - Admin access for dispute resolution
-- =====================================================
CREATE POLICY "Admins can view all chat messages"
ON public.chat_messages
FOR SELECT
USING (public.is_admin(auth.uid()));

-- =====================================================
-- REVIEWS TABLE - Admin access for content moderation
-- =====================================================
CREATE POLICY "Admins can update reviews"
ON public.reviews
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete reviews"
ON public.reviews
FOR DELETE
USING (public.is_admin(auth.uid()));