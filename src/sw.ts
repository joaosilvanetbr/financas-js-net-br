/// <reference lib="webworker" />
// Service Worker — Financas Pessoais v8
// Compila para dist/sw.js via tsc -p tsconfig.sw.json

export {}; // torna modulo — permite redeclarar self

declare const self: ServiceWorkerGlobalScope;

const SHELL_CACHE = "financas-shell-v8";
const DATA_CACHE = "financas-data-v8";

const APP_SHELL: readonly string[] = [
  "/",
  "/manifest.webmanifest",
  "/icon-v2.svg",
  "/icon-v2-192.png",
  "/icon-v2-512.png",
  "/icon-v2-maskable-512.png",
];

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache: Cache) => cache.addAll([...APP_SHELL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys: string[]) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAppShellRequest(url: URL, request: Request): boolean {
  return url.origin === self.location.origin && request.mode === "navigate";
}

self.addEventListener("fetch", (event: FetchEvent) => {
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
            caches.open(SHELL_CACHE).then((c: Cache) => c.put("/", copy));
            return response;
          })
        );
      }),
    );
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
            caches.open(SHELL_CACHE).then((c: Cache) => c.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }
});
