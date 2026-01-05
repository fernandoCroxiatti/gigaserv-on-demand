import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { registerLogoutCleanup, isLoggingOutState } from './useAuth';

const ACTIVITY_UPDATE_INTERVAL_MS = 60_000; // Update every 1 minute
const ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;

export function useActivityTracker() {
  const { user } = useAuth();
  const lastUpdateRef = useRef<number>(0);
  const isUpdatingRef = useRef(false);
  const [profileType, setProfileType] = useState<string | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const isCleanedUpRef = useRef(false);

  // Fetch profile type once
  useEffect(() => {
    if (!user) {
      setProfileType(null);
      return;
    }

    supabase
      .from('profiles')
      .select('perfil_principal')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfileType(data.perfil_principal);
        }
      });
  }, [user?.id]);

  const updateActivity = useCallback(async () => {
    // Skip if logging out or cleaned up
    if (!user || !profileType || isUpdatingRef.current || isLoggingOutState() || isCleanedUpRef.current) {
      return;
    }

    const now = Date.now();
    // Throttle updates to at most once per minute
    if (now - lastUpdateRef.current < ACTIVITY_UPDATE_INTERVAL_MS) return;

    isUpdatingRef.current = true;
    lastUpdateRef.current = now;

    try {
      const timestamp = new Date().toISOString();

      // Update profiles table (for clients)
      if (profileType === 'client') {
        await supabase
          .from('profiles')
          .update({ last_activity: timestamp })
          .eq('user_id', user.id);
      }

      // Update provider_data table (for providers)
      if (profileType === 'provider') {
        await supabase
          .from('provider_data')
          .update({ last_activity: timestamp })
          .eq('user_id', user.id);
      }
    } catch (err) {
      console.error('Error updating activity:', err);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [user?.id, profileType]);

  // Cleanup function for logout
  const cleanup = useCallback(() => {
    console.log('[ActivityTracker] Cleanup triggered (logout)');
    isCleanedUpRef.current = true;
    
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    
    ACTIVITY_EVENTS.forEach((event) => {
      window.removeEventListener(event, updateActivity);
    });
  }, [updateActivity]);

  // Register cleanup callback for logout
  useEffect(() => {
    const unregister = registerLogoutCleanup(cleanup);
    return unregister;
  }, [cleanup]);

  useEffect(() => {
    if (!user || !profileType) return;
    
    isCleanedUpRef.current = false;

    // Update on mount
    updateActivity();

    // Update on user activity events (throttled)
    const handleActivity = () => {
      updateActivity();
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Also update periodically while the tab is active
    intervalIdRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && !isLoggingOutState()) {
        updateActivity();
      }
    }, ACTIVITY_UPDATE_INTERVAL_MS);

    // Update when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isLoggingOutState()) {
        updateActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, profileType, updateActivity]);
}
