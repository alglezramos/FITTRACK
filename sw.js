const CACHE = "fittrack-r103-guardado-seguro";
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
  "./macros.js",
  "./food-images.js",
  "./food-photos.js",
  "./nutrition.js",
  "./program.js",
  "./assets/peso_muerto_kettlebell.jpg",
  "./assets/remo_kettlebell.jpg",
  "./assets/curl_ez_scott.jpg",
  "./assets/trunk_extension.jpg",
  "./assets/pallof_press.jpg",
  "./assets/press_inclinado_smith.jpg",
  "./assets/press_recto_mancuernas.jpg",
  "./assets/hip_thrust.jpg",
  "./assets/stairclimber.jpg",
  "./assets/press_pecho_maquina.jpg",
  "./assets/pec_deck.jpg",
  "./assets/curl_martillo.jpg",
  "./assets/press_militar_maquina.jpg",
  "./assets/curl_polea_baja.jpg",
  "./assets/extension_triceps_cabeza.jpg",
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
  "./assets/curl_femoral.jpg",
  "./assets/kettlebell_swing.jpg",
  "./assets/face_pull.jpg",
];
// r103: la versión nueva solo se instala si bajaron todos los archivos de la app;
// si falla alguno, sigue funcionando la versión anterior. Las fotos de ejercicios son opcionales.
const CORE = FILES.filter((f) => !f.startsWith("./assets/"));
const ASSETS = FILES.filter((f) => f.startsWith("./assets/"));
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await cache.addAll(CORE.map((f) => new Request(f, { cache: "reload" })));
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
      await Promise.allSettled(ASSETS.map((f) => cache.add(new Request(f, { cache: "reload" }))));
      await self.skipWaiting();
    })(),
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
              // r103: borra todas las versiones anteriores de la app.
              (key) => key !== CACHE && key.startsWith("fittrack-"),
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
        if (response.ok && response.type === "basic") {
          await cache.put(event.request, response.clone());
          return response;
        }
        // r103: si el servidor responde con error, usa la copia guardada.
        const cached = await cache.match(event.request);
        return cached || response;
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return cache.match("./index.html");
        return Response.error();
      }
    })(),
  );
});
