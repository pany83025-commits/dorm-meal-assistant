/* 寝室餐食助手 Service Worker
   策略：
   - 导航 / index.html → network-first（否则改了 HTML 却没改本文件，老用户永远停在旧版）
   - 其它同源静态资源 → cache-first（图标、manifest 这类很少变）
   - 跨域请求（天气、AI）完全不介入
   - 离线兜底只对导航请求返回 index.html，别把 HTML 塞给图片请求
*/
const C = "dorm-eat-v3";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isDoc(req, url) {
  return req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}

async function networkFirst(req) {
  const cache = await caches.open(C);
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(req)) || (await cache.match("./index.html")) || (await cache.match("./"));
    if (hit) return hit;
    return new Response("离线，且没有缓存版本", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(C);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    /* 静态资源失败就如实失败，不要返回 HTML（会让 <img> 拿到 text/html） */
    return new Response("", { status: 504, statusText: "offline" });
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      /* 天气 / AI 直接走网络 */
  if (isDoc(req, url)) e.respondWith(networkFirst(req));
  else e.respondWith(cacheFirst(req));
});
