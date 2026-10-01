const CACHE_NAME = 'ets2026-pwa-v1.0.1';

const STATIC_ASSETS = [
  '/',
  '/mi-credencial',
  '/pwa-operador',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo cachear peticiones GET y evitar llamadas a /api/ para que no interfieran con lógica de backend
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// ============================================================================
// EVENTO PUSH: Recepción de Notificaciones Web Push en Segundo Plano
// ============================================================================
self.addEventListener('push', (event) => {
  let data = {
    title: '1er Congreso ETS 2026',
    body: 'Novedades y avisos oficiales del congreso.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/',
    tag: 'congreso-alerta',
    urgente: false,
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch (_) {
      data.body = event.data.text() || data.body;
    }
  }

  const esUrgente = Boolean(data.urgente || data.data?.urgente);

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || (esUrgente ? 'congreso-urgente' : 'congreso-general'),
    renotify: true,
    requireInteraction: esUrgente,
    data: {
      url: data.url || '/',
      urgente: esUrgente,
    },
    vibrate: esUrgente ? [300, 100, 300, 100, 300] : [200, 100, 200],
    actions: [
      { action: 'open', title: 'Ver Notificación' },
      { action: 'dismiss', title: 'Descartar' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ============================================================================
// EVENTO NOTIFICATIONCLICK: Apertura de Ventana o Foco al Tocar la Alerta
// ============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una pestaña abierta con esa URL o el origen, enfocarla
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl) || targetUrl === '/') {
            return client.focus();
          }
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
