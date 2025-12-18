-- Drop the problematic policy that creates circular dependency
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Create a new policy that allows users to see their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Keep admin policy for viewing ALL roles (for admin management)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));