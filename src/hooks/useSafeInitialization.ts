import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { safeLocalStorage } from '@/lib/safeStorage';

/**
 * Boot phases for safe initialization
 */
export type BootPhase = 
  | 'animated_splash'  // Animated splash screen with icons
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
    phase: 'animated_splash',
    isNative: false,
    selectedProfile: null,
    error: null,
  });

  // Called when animated splash completes
  const onAnimatedSplashComplete = useCallback(() => {
    // Check if we're in a native app environment
    const isNative = Capacitor.isNativePlatform();
    
    setState(prev => ({
      ...prev,
      isNative,
      phase: 'profile_select',
    }));
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
    onAnimatedSplashComplete,
    isAnimatedSplashPhase: state.phase === 'animated_splash',
    isSplashPhase: state.phase === 'splash' || state.phase === 'initializing',
    isProfileSelectPhase: state.phase === 'profile_select',
    isAuthCheckPhase: state.phase === 'auth_check',
    isReady: state.phase === 'ready',
  };
}

export default useSafeInitialization;
