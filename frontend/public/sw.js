const CACHE_NAME = 'smartlogistics-v3';
const APP_SHELL = ['/index.html', '/', '/manifest.webmanifest'];
const OFFLINE_DB_NAME = 'smartlogistics-driver-offline';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE = 'pickup-actions';

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OFFLINE_STORE)) {
        request.result.createObjectStore(OFFLINE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOfflineAction(action) {
  const db = await openOfflineDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(OFFLINE_STORE, 'readwrite');
    transaction.objectStore(OFFLINE_STORE).put(action);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function getOfflineActions() {
  const db = await openOfflineDb();
  const actions = await new Promise((resolve, reject) => {
    const request = db.transaction(OFFLINE_STORE, 'readonly').objectStore(OFFLINE_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return actions;
}

async function deleteOfflineAction(id) {
  const db = await openOfflineDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(OFFLINE_STORE, 'readwrite');
    transaction.objectStore(OFFLINE_STORE).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

async function syncDriverActions() {
  const actions = await getOfflineActions();
  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: 'PUT',
        headers: action.headers,
        body: JSON.stringify(action.body)
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        await deleteOfflineAction(action.id);
        await notifyClients({ type: 'DRIVER_ACTION_SYNCED', tracking_code: action.body.tracking_code, success: true });
      } else if (response.status >= 400 && response.status < 500) {
        await deleteOfflineAction(action.id);
        await notifyClients({ type: 'DRIVER_ACTION_SYNCED', tracking_code: action.body.tracking_code, success: false, message: result.message || 'Máy chủ từ chối đồng bộ thao tác offline.' });
      } else {
        throw new Error(`Sync returned HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Driver action sync failed:', error);
      if (self.registration.sync) await self.registration.sync.register('sync-driver-actions');
      return;
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method === 'PUT') {
    const statusUrl = new URL(request.url);
    if (!/^\/api\/orders\/\d+\/status$/.test(statusUrl.pathname)) return;
    event.respondWith((async () => {
      const requestBody = await request.clone().json().catch(() => null);
      if (requestBody?.status !== 'picked_up') return fetch(request);
      try {
        return await fetch(request.clone());
      } catch (error) {
        const id = request.headers.get('Idempotency-Key')
          || `${requestBody.user_id}-${statusUrl.pathname}-${requestBody.status}`;
        await saveOfflineAction({
          id,
          url: request.url,
          headers: { 'Content-Type': 'application/json' },
          body: { ...requestBody, tracking_code: requestBody.tracking_code || null },
          queued_at: new Date().toISOString()
        });
        if (self.registration.sync) await self.registration.sync.register('sync-driver-actions');
        return new Response(JSON.stringify({ success: true, offline_queued: true, message: 'Đã lưu xác nhận offline; sẽ tự đồng bộ khi có mạng.' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    })());
    return;
  }

  if (request.method !== 'GET') return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).then((response) => {
      if (response && response.status === 200 && response.type === 'basic'
        && ['document', 'script', 'style', 'image', 'font'].includes(request.destination)) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => {
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('/index.html');
      return Response.error();
    }))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-driver-actions') event.waitUntil(syncDriverActions());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SYNC_DRIVER_ACTIONS') event.waitUntil(syncDriverActions());
});
