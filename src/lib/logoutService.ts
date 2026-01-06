/**
 * LOGOUT SERVICE - Centralized logout logic
 * 
 * Handles all cleanup operations for a clean logout:
 * 1. Stops all realtime channels
 * 2. Clears all cached state
 * 3. Executes signOut with timeout protection
 * 4. Forces redirect to login
 * 
 * NEVER blocks the UI - always completes within 5 seconds max
 */

import { supabase } from '@/integrations/supabase/client';

// Maximum time to wait for signOut before forcing local logout
const SIGNOUT_TIMEOUT_MS = 5000;

// Flag to prevent multiple simultaneous logouts
let isLoggingOut = false;

/**
 * Check if logout is in progress
 */
export function isLogoutInProgress(): boolean {
  return isLoggingOut;
}

/**
 * Remove all realtime channels immediately
 */
async function removeAllRealtimeChannels(): Promise<void> {
  try {
    const channels = supabase.getChannels();
    console.log(`[LogoutService] Removing ${channels.length} realtime channels`);
    
    // Remove all channels in parallel with a short timeout
    await Promise.race([
      Promise.all(channels.map(channel => supabase.removeChannel(channel))),
      new Promise(resolve => setTimeout(resolve, 1000)) // Max 1 second for channel cleanup
    ]);
    
    console.log('[LogoutService] All channels removed');
  } catch (error) {
    console.warn('[LogoutService] Error removing channels:', error);
    // Continue with logout even if channel cleanup fails
  }
}

/**
 * Clear all local storage and session data
 */
function clearLocalData(): void {
  try {
    // Clear Supabase-related storage
    const keysToRemove = [
      'supabase.auth.token',
      'selectedProfile',
      'sb-twyzhndqxynbhgmqshuz-auth-token',
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore storage errors
      }
    });
    
    // Clear session storage as well
    try {
      sessionStorage.clear();
    } catch (e) {
      // Ignore
    }
    
    console.log('[LogoutService] Local data cleared');
  } catch (error) {
    console.warn('[LogoutService] Error clearing local data:', error);
  }
}

/**
 * Execute signOut with timeout protection
 */
async function executeSignOutWithTimeout(): Promise<void> {
  const signOutPromise = supabase.auth.signOut();
  
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn('[LogoutService] SignOut timeout - forcing local logout');
      resolve();
    }, SIGNOUT_TIMEOUT_MS);
  });
  
  try {
    await Promise.race([signOutPromise, timeoutPromise]);
    console.log('[LogoutService] SignOut completed');
  } catch (error) {
    console.warn('[LogoutService] SignOut error:', error);
    // Continue anyway - local cleanup is more important
  }
}

/**
 * Main logout function - orchestrates all cleanup
 * 
 * @param navigate - React Router navigate function
 * @param cleanupCallbacks - Array of cleanup functions from hooks
 */
export async function performLogout(
  navigate: (path: string) => void,
  cleanupCallbacks?: Set<() => void>
): Promise<void> {
  // Prevent multiple simultaneous logouts
  if (isLoggingOut) {
    console.log('[LogoutService] Logout already in progress');
    return;
  }
  
  isLoggingOut = true;
  console.log('[LogoutService] Starting logout...');
  
  try {
    // Step 1: Navigate immediately (don't wait for anything)
    // This gives instant feedback to the user
    navigate('/auth');
    
    // Step 2: Execute cleanup callbacks (from hooks like useChamadoQueue, useProviderOnlineSync)
    if (cleanupCallbacks && cleanupCallbacks.size > 0) {
      console.log(`[LogoutService] Executing ${cleanupCallbacks.size} cleanup callbacks`);
      cleanupCallbacks.forEach(callback => {
        try {
          callback();
        } catch (err) {
          console.warn('[LogoutService] Cleanup callback error:', err);
        }
      });
    }
    
    // Step 3: Remove all realtime channels (parallel with signOut)
    // Step 4: Execute signOut with timeout
    // Do these in parallel for speed
    await Promise.all([
      removeAllRealtimeChannels(),
      executeSignOutWithTimeout(),
    ]);
    
    // Step 5: Clear local data
    clearLocalData();
    
    console.log('[LogoutService] Logout completed successfully');
  } catch (error) {
    console.error('[LogoutService] Logout error:', error);
    // Even on error, clear local data and continue
    clearLocalData();
  } finally {
    // Reset flag after a short delay to allow pending operations to complete
    setTimeout(() => {
      isLoggingOut = false;
      console.log('[LogoutService] Logout flag reset');
    }, 500);
  }
}
