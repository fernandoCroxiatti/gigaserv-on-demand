import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Boot phases for safe initialization
 */
export type BootPhase = 
  | 'splash'           // Initial static splash - no logic runs
  | 'initializing'     // Basic JS loaded, checking environment
  | 'profile_select'   // Show profile selection (client/provider)
  | 'auth_check'       // Checking authentication status
  | 'ready';           // App fully ready, all services can run

interface SafeInitializationState {
  phase: BootPhase;
  isNative: boolean;
  selectedProfile: 'client' | 'provider' | null;
  error: Error | null;
}

/**
 * Safe Initialization Hook
 * 
 * Manages a safe boot sequence for Android release builds:
 * 1. Shows static splash (no async operations)
 * 2. Waits for basic environment to be ready
 * 3. Shows profile selection before any auth check
 * 4. Only then proceeds to auth and backend operations
 * 
 * This prevents crashes from:
 * - Accessing native APIs before they're ready
 * - Async operations during app startup
 * - Missing permissions blocking the boot
 */
export function useSafeInitialization() {
  const [state, setState] = useState<SafeInitializationState>({
    phase: 'splash',
    isNative: false,
    selectedProfile: null,
    error: null,
  });

  // Detect if running in native environment
  useEffect(() => {
    let mounted = true;

    const initializeSafely = async () => {
      try {
        // Phase 1: Splash (already showing)
        // Give time for the DOM to be fully ready
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!mounted) return;

        // Check if we're in a native app environment
        const isNative = Capacitor.isNativePlatform();
        
        setState(prev => ({
          ...prev,
          isNative,
          phase: 'initializing',
        }));

        // Phase 2: Brief initialization delay for native bridge
        if (isNative) {
          // On Android, wait a bit longer for WebView to stabilize
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (!mounted) return;

        // Check if user has a stored profile preference
        const storedProfile = localStorage.getItem('selectedProfile');
        
        if (storedProfile === 'client' || storedProfile === 'provider') {
          // User has previously selected, skip profile selection
          setState(prev => ({
            ...prev,
            selectedProfile: storedProfile,
            phase: 'auth_check',
          }));
        } else {
          // No stored preference, show profile selection
          setState(prev => ({
            ...prev,
            phase: 'profile_select',
          }));
        }
      } catch (error) {
        console.error('[SafeInit] Initialization error:', error);
        if (mounted) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error : new Error('Unknown initialization error'),
            phase: 'profile_select', // Fallback to profile selection
          }));
        }
      }
    };

    initializeSafely();

    return () => {
      mounted = false;
    };
  }, []);

  // Select profile and proceed to auth check
  const selectProfile = useCallback((profile: 'client' | 'provider') => {
    try {
      localStorage.setItem('selectedProfile', profile);
    } catch {
      // localStorage might not be available, that's okay
    }
    
    setState(prev => ({
      ...prev,
      selectedProfile: profile,
      phase: 'auth_check',
    }));
  }, []);

  // Mark as ready (called after auth check completes)
  const markReady = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'ready',
    }));
  }, []);

  // Reset to profile selection (for logout or error recovery)
  const resetToProfileSelection = useCallback(() => {
    try {
      localStorage.removeItem('selectedProfile');
    } catch {
      // Ignore localStorage errors
    }
    
    setState(prev => ({
      ...prev,
      selectedProfile: null,
      phase: 'profile_select',
      error: null,
    }));
  }, []);

  return {
    ...state,
    selectProfile,
    markReady,
    resetToProfileSelection,
    isSplashPhase: state.phase === 'splash' || state.phase === 'initializing',
    isProfileSelectPhase: state.phase === 'profile_select',
    isAuthCheckPhase: state.phase === 'auth_check',
    isReady: state.phase === 'ready',
  };
}

export default useSafeInitialization;
