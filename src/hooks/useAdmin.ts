import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);

  const checkAdminStatus = useCallback(async () => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      setChecked(true);
      return;
    }

    try {
      setLoading(true);
      console.log('[useAdmin] Checking admin status for user:', user.id);
      
      // Query user_roles directly (RLS allows users to read their own roles)
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('[useAdmin] Error checking admin status:', error);
        setIsAdmin(false);
      } else {
        const hasAdminRole = data !== null;
        console.log('[useAdmin] Admin check result:', { hasAdminRole, data });
        setIsAdmin(hasAdminRole);
      }
    } catch (err) {
      console.error('[useAdmin] Error checking admin status:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }, [user, authLoading]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // Keep loading true until auth finishes AND we've checked admin status
  const effectiveLoading = authLoading || !checked;

  return { isAdmin, loading: effectiveLoading, refetch: checkAdminStatus };
}
