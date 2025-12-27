// OneSignal Web Push Integration
// App ID: 2ca423ff-e288-4804-92b3-8d64f58fa918

const ONESIGNAL_APP_ID = '2ca423ff-e288-4804-92b3-8d64f58fa918';

// Declare OneSignal types
declare global {
  interface Window {
    OneSignalDeferred: Array<(OneSignal: OneSignalInstance) => void | Promise<void>>;
    OneSignal?: OneSignalInstance;
  }
}

interface OneSignalInstance {
  init: (options: OneSignalInitOptions) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  User: {
    onesignalId: string | null;
    externalId: string | null;
    PushSubscription: {
      id: string | null;
      token: string | null;
      optedIn: boolean;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
    };
    addTag: (key: string, value: string) => void;
    addTags: (tags: Record<string, string>) => void;
    removeTag: (key: string) => void;
    removeTags: (keys: string[]) => void;
    getTags: () => Record<string, string>;
    addEventListener: (event: string, callback: (event: unknown) => void) => void;
  };
  Notifications: {
    permission: boolean;
    permissionNative: 'default' | 'granted' | 'denied';
    requestPermission: () => Promise<void>;
    addEventListener: (event: string, callback: (event: unknown) => void) => void;
    removeEventListener: (event: string, callback: (event: unknown) => void) => void;
  };
  Slidedown: {
    promptPush: (options?: { force?: boolean }) => Promise<void>;
  };
  Debug: {
    setLogLevel: (level: 'trace' | 'debug' | 'info' | 'warn' | 'error') => void;
  };
}

interface OneSignalInitOptions {
  appId: string;
  allowLocalhostAsSecureOrigin?: boolean;
  autoResubscribe?: boolean;
  notifyButton?: {
    enable: boolean;
  };
  welcomeNotification?: {
    disable: boolean;
  };
  promptOptions?: {
    slidedown?: {
      prompts: Array<{
        type: string;
        autoPrompt: boolean;
        text?: {
          actionMessage?: string;
          acceptButton?: string;
          cancelButton?: string;
        };
      }>;
    };
  };
}

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Load OneSignal SDK script
 */
function loadOneSignalScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('onesignal-sdk')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'onesignal-sdk';
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load OneSignal SDK'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize OneSignal SDK
 * Call this once when the app loads
 */
export async function initOneSignal(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[OneSignal] Initializing...');

      // Initialize deferred array
      window.OneSignalDeferred = window.OneSignalDeferred || [];

      // Load SDK script
      await loadOneSignalScript();

      // Wait for SDK to be ready and initialize
      await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred.push(async (OneSignal) => {
          try {
            await OneSignal.init({
              appId: ONESIGNAL_APP_ID,
              allowLocalhostAsSecureOrigin: true,
              autoResubscribe: true,
              notifyButton: {
                enable: false, // We handle our own UI
              },
              welcomeNotification: {
                disable: true, // We send our own welcome notification
              },
              promptOptions: {
                slidedown: {
                  prompts: [
                    {
                      type: 'push',
                      autoPrompt: false, // We control when to prompt
                      text: {
                        actionMessage: 'Ative as notificações para receber alertas de chamadas e atualizações importantes.',
                        acceptButton: 'Permitir',
                        cancelButton: 'Agora não',
                      },
                    },
                  ],
                },
              },
            });

            console.log('[OneSignal] Initialized successfully');
            isInitialized = true;
            resolve();
          } catch (error) {
            console.error('[OneSignal] Init error:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('[OneSignal] Failed to initialize:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Execute code with OneSignal SDK ready
 */
export function withOneSignal<T>(callback: (OneSignal: OneSignalInstance) => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        const result = await callback(OneSignal);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Login user to OneSignal (associate user ID)
 * Call this after successful authentication
 */
export async function oneSignalLogin(userId: string): Promise<void> {
  try {
    await initOneSignal();
    await withOneSignal(async (OneSignal) => {
      console.log('[OneSignal] Logging in user:', userId);
      await OneSignal.login(userId);
      console.log('[OneSignal] User logged in successfully');
    });
  } catch (error) {
    console.error('[OneSignal] Login error:', error);
  }
}

/**
 * Logout user from OneSignal
 * Call this when user signs out
 */
export async function oneSignalLogout(): Promise<void> {
  try {
    await withOneSignal(async (OneSignal) => {
      console.log('[OneSignal] Logging out user');
      await OneSignal.logout();
      console.log('[OneSignal] User logged out successfully');
    });
  } catch (error) {
    console.error('[OneSignal] Logout error:', error);
  }
}

/**
 * Request push notification permission
 * Call this only after user action (first click after login)
 */
export async function requestOneSignalPermission(): Promise<boolean> {
  try {
    await initOneSignal();
    
    return await withOneSignal(async (OneSignal) => {
      console.log('[OneSignal] Requesting permission...');
      
      // Check current permission
      const currentPermission = OneSignal.Notifications.permissionNative;
      console.log('[OneSignal] Current native permission:', currentPermission);
      
      if (currentPermission === 'granted') {
        // Already granted, just opt in
        await OneSignal.User.PushSubscription.optIn();
        console.log('[OneSignal] Already granted, opted in');
        return true;
      }
      
      if (currentPermission === 'denied') {
        console.log('[OneSignal] Permission denied by browser');
        return false;
      }
      
      // Request permission via native browser prompt
      await OneSignal.Notifications.requestPermission();
      
      // Check result
      const newPermission = OneSignal.Notifications.permissionNative;
      const granted = newPermission === 'granted';
      
      if (granted) {
        await OneSignal.User.PushSubscription.optIn();
        console.log('[OneSignal] Permission granted and opted in');
      } else {
        console.log('[OneSignal] Permission not granted');
      }
      
      return granted;
    });
  } catch (error) {
    console.error('[OneSignal] Permission request error:', error);
    return false;
  }
}

/**
 * Check if push notifications are currently permitted
 */
export async function isOneSignalPermissionGranted(): Promise<boolean> {
  try {
    return await withOneSignal((OneSignal) => {
      return OneSignal.Notifications.permission;
    });
  } catch {
    return false;
  }
}

/**
 * Get OneSignal Player ID (subscription ID)
 */
export async function getOneSignalPlayerId(): Promise<string | null> {
  try {
    return await withOneSignal((OneSignal) => {
      return OneSignal.User.PushSubscription.id;
    });
  } catch {
    return null;
  }
}

/**
 * Get OneSignal User ID
 */
export async function getOneSignalUserId(): Promise<string | null> {
  try {
    return await withOneSignal((OneSignal) => {
      return OneSignal.User.onesignalId;
    });
  } catch {
    return null;
  }
}

/**
 * Set user tags for segmentation
 */
export async function setOneSignalTags(tags: Record<string, string>): Promise<void> {
  try {
    await withOneSignal((OneSignal) => {
      OneSignal.User.addTags(tags);
      console.log('[OneSignal] Tags set:', tags);
    });
  } catch (error) {
    console.error('[OneSignal] Error setting tags:', error);
  }
}

/**
 * Add notification event listeners
 */
export async function addOneSignalNotificationListener(
  event: 'click' | 'foregroundWillDisplay' | 'dismiss',
  callback: (event: unknown) => void
): Promise<void> {
  try {
    await withOneSignal((OneSignal) => {
      OneSignal.Notifications.addEventListener(event, callback);
    });
  } catch (error) {
    console.error('[OneSignal] Error adding listener:', error);
  }
}

/**
 * Remove notification event listener
 */
export async function removeOneSignalNotificationListener(
  event: 'click' | 'foregroundWillDisplay' | 'dismiss',
  callback: (event: unknown) => void
): Promise<void> {
  try {
    await withOneSignal((OneSignal) => {
      OneSignal.Notifications.removeEventListener(event, callback);
    });
  } catch (error) {
    console.error('[OneSignal] Error removing listener:', error);
  }
}

/**
 * Enable debug logging
 */
export async function setOneSignalDebug(enabled: boolean): Promise<void> {
  try {
    await withOneSignal((OneSignal) => {
      OneSignal.Debug.setLogLevel(enabled ? 'trace' : 'error');
    });
  } catch (error) {
    console.error('[OneSignal] Error setting debug:', error);
  }
}
