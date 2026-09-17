// Service Worker cho "Quản Lý Công Việc" — cho phép cài đặt như app (PWA) và dùng ngoại tuyến.
// Chiến lược: cache-first cho phần "khung" ứng dụng (HTML/manifest/icons), có làm mới ngầm
// (stale-while-revalidate) mỗi khi có mạng. Toàn bộ dữ liệu công việc vẫn nằm trong
// localStorage/IndexedDB của trình duyệt trên máy người dùng, không đi qua service worker này.

const CACHE_NAME = "taskflow-shell-v34";
// Không cố định tên file trang chính (vd "index.html" hay "taskflow.html") vì có thể khác nhau tuỳ
// nơi lưu trữ — "./" sẽ khớp với bất kỳ URL trang chính nào được dùng để mở ứng dụng.
const APP_SHELL = [
  "./",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((e) => console.error("Không cache được", url, e))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // không can thiệp request ngoài (vd Google Fonts)

  // Trang chính (HTML) dùng NETWORK-FIRST: luôn ưu tiên lấy bản MỚI NHẤT khi có mạng, chỉ
  // dùng bản cache khi mất mạng — để mỗi lần cập nhật code không cần người dùng phải tự xoá
  // cache/gỡ cài đặt lại app mới thấy bản mới (khác với ảnh/manifest hiếm khi đổi, vẫn dùng
  // cache-first bên dưới để mở nhanh + đỡ tốn dữ liệu).
  const isNavigation = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // mất mạng -> dùng bản cache nếu có
      return cached || networkFetch;
    })
  );
});
