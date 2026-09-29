// Service Worker cho "Lịch công tác tuần" – cho phép cài như ứng dụng và dùng khi không có mạng.
// Trang chính: ưu tiên mạng (luôn nhận bản mới nhất khi có mạng), mất mạng thì dùng bản đã lưu.
// Tệp tĩnh (biểu tượng, manifest): ưu tiên bản đã lưu, làm mới ngầm khi có mạng.
// Dữ liệu lịch nằm trong trình duyệt của máy người dùng, không đi qua service worker này.
const CACHE_NAME = 'lich-tuan-v1';
const APP_SHELL = ['./', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(APP_SHELL.map(u => cache.add(u).catch(e => console.warn('Không lưu được', u, e))))));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n.startsWith('lich-tuan-') && n !== CACHE_NAME).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isNav) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put('./', copy)); }
        return res;
      }).catch(() => caches.match('./', { ignoreSearch: true }))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
