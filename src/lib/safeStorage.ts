// Safe wrappers for localStorage/sessionStorage in Android WebView/Capacitor
// Only allows access AFTER the app is mounted to avoid early WebView crashes.

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const APP_MOUNTED_FLAG = '__APP_MOUNTED__';

function isMounted(): boolean {
  return typeof window !== 'undefined' && (window as any)[APP_MOUNTED_FLAG] === true;
}

function getStorage(kind: 'local' | 'session'): StorageLike | null {
  if (!isMounted()) return null;

  try {
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    // Probe access (some WebViews throw even on getItem)
    const k = '__probe__';
    storage.setItem(k, '1');
    storage.removeItem(k);
    return storage;
  } catch {
    return null;
  }
}

export const safeLocalStorage = {
  getItem(key: string): string | null {
    return getStorage('local')?.getItem(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      getStorage('local')?.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem(key: string): void {
    try {
      getStorage('local')?.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    return getStorage('session')?.getItem(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      getStorage('session')?.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem(key: string): void {
    try {
      getStorage('session')?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
