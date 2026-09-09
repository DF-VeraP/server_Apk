// ==============================================================================
// Service Worker - Nexus Contactos PWA (Soporte Offline & Recarga sin Internet)
// ==============================================================================

const CACHE_NAME = 'nexus-contactos-v1.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/restablecer.html',
  '/css/styles.css',
  '/css/bootstrap-icons.min.css',
  '/fonts/bootstrap-icons.woff2',
  '/fonts/bootstrap-icons.woff',
  '/js/app.js',
  '/manifest.json',
  '/img/icon.svg'
];

// 1. INSTALACIÓN: Precargar archivos del frontend en memoria caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precargando activos estáticos para modo offline...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Aviso al precargar algunos activos:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN: Limpiar cachés antiguas si se actualiza la versión
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. INTERCEPTACIÓN DE PETICIONES (FETCH)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Las peticiones a la API nunca se bloquean en SW (la lógica de offline/queue la maneja app.js)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navegación (HTML / Páginas principales): Red Primero -> Fallback a Caché
  // Si el usuario recarga la página (F5) sin internet, entrega index.html desde la memoria
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[SW] Sin internet: entregando página desde la caché local');
          const cachedResponse = await caches.match(req);
          if (cachedResponse) {
            return cachedResponse;
          }
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Archivos estáticos (CSS, JS, iconos, fuentes): Caché Primero con actualización en segundo plano
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Buscar actualización en segundo plano si hay red
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Si no estaba en caché, pedir a la red
      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return networkResponse;
      });
    })
  );
});
