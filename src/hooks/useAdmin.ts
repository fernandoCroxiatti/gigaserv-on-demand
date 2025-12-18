import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAdminStatus() {
      if (!user) {
        if (!mounted) return;
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Query user_roles directly (RLS allows users to read their own roles)
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .limit(1);

        if (!mounted) return;

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin((data?.length ?? 0) > 0);
      } catch (err) {
        if (!mounted) return;
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    checkAdminStatus();

    return () => {
      mounted = false;
    };
  }, [user]);

  return { isAdmin, loading };
}
