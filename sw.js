/* Service Worker | אתונה 2026 */
const VERSION = 'athens-2026-v5';
const SHELL = [
  './index.html', './styles.css?v=5', './trip.json?v=5', './app.js?v=5', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];
const IMG_CACHE = 'athens-img-v2'; // v2: ניקוי תשובות opaque/שגויות שנשמרו בגרסאות קודמות

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // תמונות Wikimedia: מהמטמון קודם, ושמירה לאופליין
  if (url.hostname === 'upload.wikimedia.org') {
    e.respondWith(
      caches.open(IMG_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) c.put(req, res.clone()); // רק תשובה תקינה. 404/429/opaque לא נשמרים
        return res;
      })))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // דף ראשי: רשת קודם כדי לקבל עדכונים, מטמון כשאין קליטה
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // קבצי האפליקציה: מטמון קודם
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
    return res;
  })));
});
