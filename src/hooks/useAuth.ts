import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Singleton to cache auth state across hook instances
let cachedUser: User | null = null;
let cachedSession: Session | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Flag to prevent session revalidation after intentional logout
let isLoggingOut = false;

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
        // CRITICAL: Ignore auth state changes during logout to prevent reactivation
        if (isLoggingOut) {
          console.log('[useAuth] Ignoring auth state change during logout:', event);
          return;
        }

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
        // Don't set session if we're logging out
        if (isLoggingOut) return;

        cachedSession = session;
        cachedUser = session?.user ?? null;
        isInitialized = true;
        
        if (mountedRef.current) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      });
    } else if (isInitialized && !isLoggingOut) {
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
    console.log('[useAuth] Starting logout...');
    
    // Set flag BEFORE any async operations to prevent race conditions
    isLoggingOut = true;
    
    // Clear cached state immediately
    cachedUser = null;
    cachedSession = null;
    
    // Update local state immediately
    setUser(null);
    setSession(null);
    
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      console.log('[useAuth] Logout completed');
    } catch (error) {
      console.error('[useAuth] Logout error:', error);
    } finally {
      // Reset flag after a delay to allow any pending auth events to be ignored
      setTimeout(() => {
        isLoggingOut = false;
        console.log('[useAuth] Logout flag reset');
      }, 1000);
    }
  };

  return { user, session, loading, signOut };
}
