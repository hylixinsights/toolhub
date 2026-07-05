const C = "penaltis-v2";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(["./"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(C).then(async (c) => {
      const cached = await c.match(e.request);
      const fresh = fetch(e.request).then((res) => {
        if (res && res.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes("cdnjs") || e.request.url.includes("gstatic")))
          c.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
