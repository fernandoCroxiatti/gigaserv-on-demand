import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const ACTIVITY_UPDATE_INTERVAL_MS = 60_000; // Update every 1 minute
const ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'];

export function useActivityTracker() {
  const { user } = useAuth();
  const lastUpdateRef = useRef<number>(0);
  const isUpdatingRef = useRef(false);
  const [profileType, setProfileType] = useState<string | null>(null);

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
    if (!user || !profileType || isUpdatingRef.current) return;

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

  useEffect(() => {
    if (!user || !profileType) return;

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
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    }, ACTIVITY_UPDATE_INTERVAL_MS);

    // Update when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, profileType, updateActivity]);
}
