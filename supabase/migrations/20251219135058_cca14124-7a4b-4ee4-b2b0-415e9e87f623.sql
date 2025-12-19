-- Fix overly permissive profile policy
-- The policy "Authenticated users can view public profile info" was too broad
-- Users should only see profiles through the existing restricted policies

DROP POLICY IF EXISTS "Authenticated users can view public profile info" ON public.profiles;