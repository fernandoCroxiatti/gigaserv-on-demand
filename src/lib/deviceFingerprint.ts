import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { safeLocalStorage } from '@/lib/safeStorage';

const DEVICE_ID_KEY = 'giga_device_id';

let cachedDeviceId: string | null = null;

/**
 * Generate a persistent device fingerprint.
 * Uses FingerprintJS for browser fingerprinting, combined with localStorage persistence.
 * This helps identify the same device across sessions.
 */
export async function getDeviceId(): Promise<string> {
  // Return cached value if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  // Check localStorage first (safe wrapper)
  const storedId = safeLocalStorage.getItem(DEVICE_ID_KEY);
  if (storedId) {
    cachedDeviceId = storedId;
    return storedId;
  }

  try {
    // Generate new fingerprint
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    
    // Combine visitor ID with some additional entropy
    const visitorId = result.visitorId;
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    
    // Create a unique device ID
    const deviceId = `${visitorId}-${timestamp}-${randomPart}`;
    
    // Store persistently (safe wrapper)
    safeLocalStorage.setItem(DEVICE_ID_KEY, deviceId);
    cachedDeviceId = deviceId;
    
    return deviceId;
  } catch (error) {
    console.error('[DeviceFingerprint] Error generating fingerprint:', error);
    
    // Fallback: generate a simpler ID if FingerprintJS fails
    const fallbackId = `fallback-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`;
    safeLocalStorage.setItem(DEVICE_ID_KEY, fallbackId);
    cachedDeviceId = fallbackId;
    
    return fallbackId;
  }
}

/**
 * Get the pure fingerprint (visitor ID) without persistence.
 * Useful for checking if the same browser is being used.
 */
export async function getBrowserFingerprint(): Promise<string> {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  } catch (error) {
    console.error('[DeviceFingerprint] Error getting browser fingerprint:', error);
    return '';
  }
}

/**
 * Clear the stored device ID (for testing purposes only).
 */
export function clearDeviceId(): void {
  safeLocalStorage.removeItem(DEVICE_ID_KEY);
  cachedDeviceId = null;
}
