// Service Worker for GIGA S.O.S Push Notifications with Web Push support

const CACHE_NAME = 'gigasos-v2';

// Install event - activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2...');
  self.skipWaiting();
});

// Activate event - claim all clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker v2 activated');
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
    ])
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
      // Try as text
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
  
  // Get deep link URL from notification data
  const notificationData = event.notification.data || {};
  let urlToOpen = notificationData.url || '/';
  
  // Handle action buttons if present
  if (event.action) {
    console.log('[SW] Action clicked:', event.action);
    // Handle specific actions
    if (event.action === 'view') {
      urlToOpen = notificationData.url || '/';
    } else if (event.action === 'dismiss') {
      return; // Just close the notification
    }
  }
  
  // Ensure URL is absolute
  if (urlToOpen.startsWith('/')) {
    urlToOpen = self.location.origin + urlToOpen;
  }
  
  console.log('[SW] Opening URL:', urlToOpen);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open at our origin
        for (let client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Send message to existing window with deep link data
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: notificationData,
              url: urlToOpen
            });
            
            // Navigate the existing window to the deep link
            if ('navigate' in client) {
              client.navigate(urlToOpen);
            }
            
            return client.focus();
          }
        }
        
        // If no window is open, open a new one with the deep link
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

// Push subscription change event (when subscription expires or changes)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    // Re-subscribe and update the server
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    }).then((subscription) => {
      console.log('[SW] New subscription:', subscription);
      // Notify the main app to update the subscription on the server
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

// Background sync for analytics
self.addEventListener('sync', (event) => {
  if (event.tag === 'notification-clicked') {
    event.waitUntil(syncNotificationClicks());
  }
});

async function syncNotificationClicks() {
  console.log('[SW] Syncing notification clicks...');
}
