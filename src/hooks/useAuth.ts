import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Singleton to cache auth state across hook instances
let cachedUser: User | null = null;
let cachedSession: Session | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Flag to prevent session revalidation after intentional logout
let isLoggingOut = false;

// Cleanup callbacks registered by other hooks
const cleanupCallbacks: Set<() => void> = new Set();

/**
 * Register a cleanup callback to be called on logout.
 * Use this in hooks that need to stop intervals/listeners when user logs out.
 */
export function registerLogoutCleanup(callback: () => void): () => void {
  cleanupCallbacks.add(callback);
  return () => {
    cleanupCallbacks.delete(callback);
  };
}

/**
 * Check if the app is currently in logout state.
 * Hooks should check this before starting new operations.
 */
export function isLoggingOutState(): boolean {
  return isLoggingOut;
}

/**
 * Get all registered cleanup callbacks (for logoutService)
 */
export function getCleanupCallbacks(): Set<() => void> {
  return cleanupCallbacks;
}

/**
 * Force clear all auth state (for immediate logout)
 */
export function forceClearAuthState(): void {
  isLoggingOut = true;
  cachedUser = null;
  cachedSession = null;
  initPromise = null;
  isInitialized = false;
}

/**
 * Reset logout flag (called after logout completes)
 */
export function resetLogoutFlag(): void {
  isLoggingOut = false;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [loading, setLoading] = useState(!isInitialized);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // If logging out, immediately set loading to false and clear state
    if (isLoggingOut) {
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

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
        if (isLoggingOut) {
          setLoading(false);
          return;
        }

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

  const signOut = useCallback(async () => {
    console.log('[useAuth] Starting logout...');
    
    // Set flag BEFORE any async operations to prevent race conditions
    isLoggingOut = true;
    
    // Clear cached state immediately to prevent loading screens
    cachedUser = null;
    cachedSession = null;
    initPromise = null;
    isInitialized = true; // Keep as true to avoid loading state
    
    // Update local state immediately - this prevents "Carregando" screen
    setUser(null);
    setSession(null);
    setLoading(false);
    
    // Execute all registered cleanup callbacks
    console.log(`[useAuth] Executing ${cleanupCallbacks.size} cleanup callbacks...`);
    cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (err) {
        console.warn('[useAuth] Cleanup callback error:', err);
      }
    });
    
    try {
      // Sign out from Supabase with timeout
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn('[useAuth] SignOut timeout - forcing completion');
          resolve();
        }, 5000); // 5 second timeout
      });
      
      await Promise.race([signOutPromise, timeoutPromise]);
      console.log('[useAuth] Logout completed');
    } catch (error) {
      console.error('[useAuth] Logout error:', error);
      // Continue anyway - local state is already cleared
    } finally {
      // Reset flag after a delay to allow any pending auth events to be ignored
      setTimeout(() => {
        isLoggingOut = false;
        console.log('[useAuth] Logout flag reset');
      }, 500);
    }
  }, []);

  return { user, session, loading, signOut };
}
