const STORAGE_PREFIX = 'gigasos:notif_perm_asked:v1';

function keyForUser(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function hasAskedNotificationPermission(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(keyForUser(userId)) === '1';
  } catch {
    return false;
  }
}

export function markAskedNotificationPermission(userId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyForUser(userId), '1');
  } catch {
    // ignore
  }
}

/**
 * Permission prompts generally cannot be triggered inside iframes.
 */
export function canRequestNotificationsInThisContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  // Must be top-level browsing context (PWA/TWA are top-level)
  if (window.top && window.top !== window.self) return false;
  return true;
}
