const SHELL_CACHE = "financas-shell-v8";
const DATA_CACHE = "financas-data-v8";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon-v2.svg",
  "/icon-v2-192.png",
  "/icon-v2-512.png",
  "/icon-v2-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
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
            .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isSupabaseRequest(url) {
  return url.hostname.includes("supabase.co");
}

function isAppShellRequest(url, request) {
  return url.origin === self.location.origin && request.mode === "navigate";
}

async function supabaseStaleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      return cached || new Response(JSON.stringify({ error: "offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    });

  return cached || fetchPromise;
}

async function mutationNetworkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(JSON.stringify({ error: "offline", message: "Voce esta offline. A acao sera sincronizada quando a conexao voltar." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Nunca interceptar requisicoes de API — evita cache cross-user
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return;
  }

  if (isAppShellRequest(url, request)) {
    event.respondWith(
      caches.match("/").then((cached) => {
        return (
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((c) => c.put("/", copy));
            return response;
          })
        );
      }),
    );
    return;
  }

  if (isSupabaseRequest(url)) {
    if (request.method === "POST" && !url.pathname.includes("/rest/v1/")) {
      event.respondWith(mutationNetworkOnly(request));
      return;
    }

    if (url.pathname.includes("/rest/v1/")) {
      event.respondWith(supabaseStaleWhileRevalidate(request));
      return;
    }

    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }
          const copy = response.clone();
          if (request.method === "GET") {
            caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }
});
