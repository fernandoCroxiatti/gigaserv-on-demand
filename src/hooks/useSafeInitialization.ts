import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { safeLocalStorage } from '@/lib/safeStorage';

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
 */
export function useSafeInitialization() {
  const [state, setState] = useState<SafeInitializationState>({
    phase: 'splash',
    isNative: false,
    selectedProfile: null,
    error: null,
  });

  // Phase 1: Show splash briefly, then welcome screen
  // NO API calls, NO auth checks, NO location - just static UI
  useEffect(() => {
    let mounted = true;

    const showWelcomeScreen = async () => {
      try {
        // Brief splash screen display
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!mounted) return;

        // Check if we're in a native app environment
        const isNative = Capacitor.isNativePlatform();

        setState(prev => ({
          ...prev,
          isNative,
          phase: 'initializing',
        }));

        // Brief delay for native bridge stability
        await new Promise(resolve => setTimeout(resolve, isNative ? 200 : 50));

        if (!mounted) return;

        // ALWAYS show welcome/presentation screen first
        setState(prev => ({
          ...prev,
          phase: 'profile_select',
        }));
      } catch (error) {
        console.error('[SafeInit] Initialization error:', error);
        if (mounted) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error : new Error('Unknown initialization error'),
            phase: 'profile_select',
          }));
        }
      }
    };

    showWelcomeScreen();

    return () => {
      mounted = false;
    };
  }, []);

  // Called when user clicks "Começar" - ONLY then start auth check
  const selectProfile = useCallback((profile: 'client' | 'provider') => {
    safeLocalStorage.setItem('selectedProfile', profile);

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

  // Reset to welcome screen (for logout or error recovery)
  const resetToProfileSelection = useCallback(() => {
    safeLocalStorage.removeItem('selectedProfile');

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
