import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Singleton to cache auth state across hook instances
let cachedUser: User | null = null;
let cachedSession: Session | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [loading, setLoading] = useState(!isInitialized);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        cachedSession = newSession;
        cachedUser = newSession?.user ?? null;
        isInitialized = true;
        
        if (mountedRef.current) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
        }
      }
    );

    // Only fetch session once globally
    if (!initPromise) {
      initPromise = supabase.auth.getSession().then(({ data: { session } }) => {
        cachedSession = session;
        cachedUser = session?.user ?? null;
        isInitialized = true;
        
        if (mountedRef.current) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      });
    } else if (isInitialized) {
      // Already initialized, just use cached values
      setSession(cachedSession);
      setUser(cachedUser);
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    cachedUser = null;
    cachedSession = null;
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
