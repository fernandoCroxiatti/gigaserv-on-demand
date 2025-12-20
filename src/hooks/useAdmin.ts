import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const lastCheckedUserId = useRef<string | null>(null);

  const checkAdminStatus = useCallback(async () => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      setChecked(true);
      lastCheckedUserId.current = null;
      return;
    }

    // Skip if we already checked for this user
    if (lastCheckedUserId.current === user.id && checked) {
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
        console.log('[useAdmin] Admin check result:', { hasAdminRole, data, userId: user.id });
        setIsAdmin(hasAdminRole);
      }
      lastCheckedUserId.current = user.id;
    } catch (err) {
      console.error('[useAdmin] Error checking admin status:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }, [user, authLoading, checked]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // Reset when user changes
  useEffect(() => {
    if (user?.id !== lastCheckedUserId.current) {
      setChecked(false);
      setIsAdmin(false);
    }
  }, [user?.id]);

  // Keep loading true until auth finishes AND we've checked admin status
  const effectiveLoading = authLoading || !checked;

  return { isAdmin, loading: effectiveLoading, refetch: checkAdminStatus };
}
