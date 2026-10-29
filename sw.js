const CACHE = "fittrack-pages-v20261029r47-pressmith";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./store.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./calendar.js",
  "./coach.js",
  "./summary.js",
  "./wellbeing.js",
  "./challenges.js",
  "./food-data.js",
  "./core.js",
  "./food-photos.js",
  "./nutrition.js",
  "./program.js",
  "./assets/0_0.jpg",
  "./assets/0_1.jpg",
  "./assets/0_2.jpg",
  "./assets/0_3.jpg",
  "./assets/0_4.jpg",
  "./assets/0_5.jpg",
  "./assets/1_0.jpg",
  "./assets/1_1.jpg",
  "./assets/1_2.jpg",
  "./assets/1_3.jpg",
  "./assets/1_4.jpg",
  "./assets/1_5.jpg",
  "./assets/2_0.jpg",
  "./assets/2_1.jpg",
  "./assets/2_2.jpg",
  "./assets/2_3.jpg",
  "./assets/2_4.jpg",
  "./assets/2_5.jpg",
  "./assets/3_0.jpg",
  "./assets/3_1.jpg",
  "./assets/3_2.jpg",
  "./assets/3_3.jpg",
  "./assets/3_4.jpg",
  "./assets/3_5.jpg",
  "./assets/4_0.jpg",
  "./assets/4_1.jpg",
  "./assets/4_2.jpg",
  "./assets/4_3.jpg",
  "./assets/4_4.jpg",
  "./assets/4_5.jpg",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(FILES.map((f) => cache.add(new Request(f, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== CACHE && (key === "fittrack-v20261019r2" || key.startsWith("fittrack-pages-")),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        // "no-cache": revalida con el servidor para no servir archivos viejos de la caché HTTP.
        const response = await fetch(event.request.url, { cache: "no-cache", credentials: "same-origin" });
        if (response.ok && response.type === "basic") await cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return cache.match("./index.html");
        return Response.error();
      }
    })(),
  );
});
