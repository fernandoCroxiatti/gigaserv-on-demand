// Service Worker for GIGA S.O.S - PWA with Push Notifications
// Optimized for Web/PWA mode only (not registered in Capacitor)

const CACHE_NAME = 'gigasos-v3';
const STATIC_CACHE_NAME = 'gigasos-static-v3';

// Assets to cache for offline support (static assets only)
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker v3 activated');
  
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
    ])
  );
});

// Fetch handler - Network first for API/dynamic, Cache first for static assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Skip caching for:
  // - Supabase API calls (always need fresh data)
  // - Stripe calls
  // - Google Maps
  // - External APIs
  const skipCache = 
    url.hostname.includes('supabase') ||
    url.hostname.includes('stripe') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('google.com') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('functions/v1');

  if (skipCache) {
    // Network only for API calls
    return;
  }

  // Check if it's a static asset
  const isStaticAsset = 
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname === '/manifest.json';

  if (isStaticAsset) {
    // Cache first for static assets
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version, but update cache in background
            fetch(event.request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  caches.open(STATIC_CACHE_NAME)
                    .then((cache) => cache.put(event.request, networkResponse));
                }
              })
              .catch(() => {});
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(STATIC_CACHE_NAME)
                  .then((cache) => cache.put(event.request, responseClone));
              }
              return networkResponse;
            });
        })
    );
    return;
  }

  // Network first for HTML/JS (ensures updates are immediate)
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // Only serve from cache if network fails (offline)
        return caches.match(event.request);
      })
  );
});

// Push notification event - handles real web push from server
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  
  let data = {
    title: 'GIGA S.O.S',
    body: 'Você tem uma nova notificação',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'default',
    requireInteraction: false,
    data: {},
    vibrate: [200, 100, 200]
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload:', payload);
      data = { ...data, ...payload };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      try {
        data.body = event.data.text();
      } catch (e2) {
        console.error('[SW] Error reading push text:', e2);
      }
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
    silent: false
  };

  // High priority notifications (chamados)
  if (data.priority === 'high' || data.tag?.includes('chamado')) {
    options.requireInteraction = true;
    options.vibrate = [300, 100, 300, 100, 300];
    options.renotify = true;
  }

  console.log('[SW] Showing notification:', data.title, options);
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - handles deep links
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  let urlToOpen = notificationData.url || '/';
  
  if (event.action) {
    console.log('[SW] Action clicked:', event.action);
    if (event.action === 'view') {
      urlToOpen = notificationData.url || '/';
    } else if (event.action === 'dismiss') {
      return;
    }
  }
  
  if (urlToOpen.startsWith('/')) {
    urlToOpen = self.location.origin + urlToOpen;
  }
  
  console.log('[SW] Opening URL:', urlToOpen);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (let client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: notificationData,
              url: urlToOpen
            });
            
            if ('navigate' in client) {
              client.navigate(urlToOpen);
            }
            
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Push subscription change event
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    }).then((subscription) => {
      console.log('[SW] New subscription:', subscription);
      return clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: subscription.toJSON()
          });
        });
      });
    })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'notification-clicked') {
    event.waitUntil(syncNotificationClicks());
  }
});

async function syncNotificationClicks() {
  console.log('[SW] Syncing notification clicks...');
}

// Message handler for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});
