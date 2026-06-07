const CACHE = 'courtgo-v63';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Auth token storage (IndexedDB so it survives SW restarts) ──────────────
let _cachedToken = null;

function _openTokenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('courtgo-sw', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function _getToken() {
  if (_cachedToken) return _cachedToken;
  try {
    const db = await _openTokenDB();
    return new Promise(resolve => {
      const req = db.transaction('kv', 'readonly').objectStore('kv').get('authToken');
      req.onsuccess = () => { _cachedToken = req.result || null; resolve(_cachedToken); };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function _setToken(token) {
  _cachedToken = token;
  try {
    const db = await _openTokenDB();
    const tx = db.transaction('kv', 'readwrite');
    if (token) tx.objectStore('kv').put(token, 'authToken');
    else tx.objectStore('kv').delete('authToken');
  } catch {}
}

// ── Live visitor badge (called by periodicsync and on token receipt) ────────
async function _updateVisitorBadge() {
  const token = await _getToken();
  if (!token) return;
  try {
    const res = await fetch('/api/analytics/live-visitors', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const count = (data.visitors || []).filter(v => v.role !== 'superadmin').length;
    if ('setAppBadge' in self.registration) {
      if (count > 0) await self.registration.setAppBadge(count);
      else await self.registration.clearAppBadge();
    }
  } catch {}
}

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'SET_AUTH_TOKEN') {
    _setToken(e.data.token).then(() => _updateVisitorBadge());
  }
  if (e.data?.type === 'CLEAR_AUTH_TOKEN') {
    _setToken(null);
    if ('clearAppBadge' in self.registration) self.registration.clearAppBadge();
  }
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'live-visitors-badge') e.waitUntil(_updateVisitorBadge());
});

self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  const title = data.title || 'CourtGo';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.webp',
    badge: '/icons/icon-96.webp',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    tag: data.tag || 'courtgo',
    renotify: true,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { c.focus(); c.postMessage({ type: 'NAVIGATE', url }); return; }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', e => {
  // Only handle GET, skip API calls
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (!res || res.status !== 200 || res.type !== 'basic') return res;
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
