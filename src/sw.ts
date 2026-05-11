/// <reference lib="webworker" />
/**
 * Service Worker — Financas Pessoais v9
 *
 * Estrategias:
 * - App Shell: Cache First (index.html, manifest, icons)
 * - Assets Vite: Cache First (JS/CSS com hash — imutaveis)
 * - API: Stale-While-Revalidate (dados do dashboard, 5min stale)
 * - Imagens externas: Cache First (unsplash)
 * - Fallback: offline.html quando rede falhar
 */

export {}; // torna modulo

declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CACHE_VERSION = "v9";
const SHELL_CACHE = `financas-shell-${CACHE_VERSION}`;
const ASSETS_CACHE = `financas-assets-${CACHE_VERSION}`;
const DATA_CACHE = `financas-data-${CACHE_VERSION}`;
const IMAGES_CACHE = `financas-images-${CACHE_VERSION}`;

const OFFLINE_PAGE = "/offline.html";

// App shell — sempre disponivel offline
const APP_SHELL: readonly string[] = [
  "/",
  OFFLINE_PAGE,
  "/manifest.webmanifest",
  "/icon-v2.svg",
  "/icon-v2-192.png",
  "/icon-v2-512.png",
  "/icon-v2-maskable-512.png",
  "/icon-v2-192.png", // apple-touch-icon
];

// Patterns de assets do Vite build (hash no nome)
const ASSET_PATTERNS = [
  /\/assets\/.+\.(js|css)$/,
  /\/assets\/.+\.woff2?$/,
];

// Rotas de API que podem ser cacheadas (dados nao sensiveis)
const CACHEABLE_API_PATHS = [
  "/api/dashboard",
  "/api/categories",
  "/api/transactions",
  "/api/recurring",
  "/api/limits",
];

// TTL de cache de API (5 minutos)
const API_CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAssetRequest(url: URL): boolean {
  return ASSET_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

function isCacheableApi(url: URL): boolean {
  return CACHEABLE_API_PATHS.some((path) => url.pathname.startsWith(path));
}

function isImageRequest(url: URL): boolean {
  return url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/) !== null;
}

function isNavigationRequest(request: Request): boolean {
  return request.mode === "navigate";
}

async function fetchWithTimeout(request: Request, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function cacheResponse(cacheName: string, request: Request, response: Response): Promise<void> {
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

// ---------------------------------------------------------------------------
// Install — Precache app shell
// ---------------------------------------------------------------------------

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll([...APP_SHELL]);
      console.info("[SW] App shell precacheado:", APP_SHELL.length, "recursos");
      await self.skipWaiting();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Activate — Limpar caches antigos + cachear assets do build
// ---------------------------------------------------------------------------

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Limpar caches de versoes anteriores
      const keys = await caches.keys();
      const toDelete = keys.filter(
        (key) =>
          key.startsWith("financas-") &&
          key !== SHELL_CACHE &&
          key !== ASSETS_CACHE &&
          key !== DATA_CACHE &&
          key !== IMAGES_CACHE,
      );
      await Promise.all(toDelete.map((key) => caches.delete(key)));
      if (toDelete.length > 0) {
        console.info("[SW] Caches antigos removidos:", toDelete);
      }

      // Cachear assets do build dinamicamente
      await cacheBuildAssets();

      await self.clients.claim();
      console.info("[SW] Ativado — controle de clients assumido");
    })(),
  );
});

/**
 * Descobre e cacheia assets do build do Vite automaticamente.
 * Le o index.html do cache e extrai referencias a assets.
 */
async function cacheBuildAssets(): Promise<void> {
  try {
    const cache = await caches.open(SHELL_CACHE);
    const response = await cache.match("/");
    if (!response) return;

    const html = await response.text();
    const assetMatches = html.match(/\/assets\/[^"'\s>]+/g);
    if (!assetMatches || assetMatches.length === 0) return;

    const uniqueAssets = [...new Set(assetMatches)].map((path) =>
      path.startsWith("/") ? path : `/${path}`,
    );

    const assetsCache = await caches.open(ASSETS_CACHE);
    const alreadyCached = await assetsCache.keys();
    const cachedUrls = new Set(alreadyCached.map((r) => r.url));

    const toCache = uniqueAssets.filter((url) => !cachedUrls.has(self.location.origin + url));

    if (toCache.length === 0) return;

    await Promise.all(
      toCache.map(async (url) => {
        try {
          const response = await fetch(url, { cache: "no-cache" });
          if (response.ok) {
            await assetsCache.put(url, response);
          }
        } catch {
          // Ignora assets que falham no precache
        }
      }),
    );

    console.info("[SW] Assets do build cacheados:", toCache.length);
  } catch (err) {
    console.warn("[SW] Falha ao cachear build assets:", err);
  }
}

// ---------------------------------------------------------------------------
// Fetch — Estrategias por tipo de request
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event: FetchEvent) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignorar requests nao-GET
  if (request.method !== "GET") {
    return;
  }

  // 1. Navegacao (HTML pages) → App Shell com fallback offline
  if (isNavigationRequest(request)) {
    event.respondWith(appShellStrategy(request));
    return;
  }

  // 2. Assets do Vite (JS/CSS com hash) → Cache First
  if (isAssetRequest(url)) {
    event.respondWith(cacheFirst(ASSETS_CACHE, request));
    return;
  }

  // 3. API cacheavel → Stale-While-Revalidate
  if (isCacheableApi(url)) {
    event.respondWith(staleWhileRevalidate(DATA_CACHE, request));
    return;
  }

  // 4. Imagens locais → Cache First
  if (isImageRequest(url) && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(IMAGES_CACHE, request));
    return;
  }

  // 5. Manifest → Cache First
  if (url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(SHELL_CACHE, request));
    return;
  }

  // Demais requests → pass-through (nao interceptar)
});

// ---------------------------------------------------------------------------
// Estrategias de cache
// ---------------------------------------------------------------------------

/**
 * App Shell Strategy:
 * - Retorna do cache imediatamente (se disponivel)
 * - Atualiza em background
 * - Se cache falhar E rede falhar → offline.html
 */
async function appShellStrategy(request: Request): Promise<Response> {
  try {
    // Tentar cache primeiro
    const cached = await caches.match(request);
    if (cached) {
      // Atualizar em background
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(SHELL_CACHE).then((c) => c.put(request, response));
          }
        })
        .catch(() => {});
      return cached;
    }

    // Sem cache — buscar da rede
    const response = await fetchWithTimeout(request, 8000);
    if (response.ok) {
      await cacheResponse(SHELL_CACHE, request, response.clone());
    }
    return response;
  } catch {
    // Rede falhou — retornar offline.html
    const offline = await caches.match(OFFLINE_PAGE);
    if (offline) return offline;

    // Ultimo recurso
    return new Response(
      `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Offline</title>
<style>body{font-family:system-ui;background:#070b12;color:#e8f0f8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
.container{max-width:320px;padding:24px;}
h1{font-size:1.25rem;margin-bottom:8px;}
p{color:#8b9db5;font-size:0.875rem;}</style></head>
<body><div class="container">
<h1>Sem conexao</h1>
<p>Verifique sua internet e tente novamente.</p>
</div></body></html>`,
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

/**
 * Cache First:
 * - Retorna do cache se existir
 * - Se nao, busca da rede e cacheia
 */
async function cacheFirst(cacheName: string, request: Request): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Se rede falhar e nao tem cache, retornar erro
    return new Response("Recurso nao disponivel offline", { status: 503 });
  }
}

/**
 * Stale-While-Revalidate:
 * - Retorna do cache imediatamente (mesmo stale)
 * - Atualiza em background para proxima vez
 * - Se cache vazio, espera rede
 * - TTL: 5 minutos
 */
async function staleWhileRevalidate(cacheName: string, request: Request): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const shouldRevalidate = await isCacheEntryStale(cache, request, API_CACHE_TTL_MS);

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const responseWithTimestamp = addTimestampHeader(response);
        await cache.put(request, responseWithTimestamp.clone());
      }
      return response;
    })
    .catch(() => {
      // Se rede falhar, usar cache mesmo se stale
      return cached ?? new Response(JSON.stringify({ error: "offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    });

  // Se tem cache fresco, retorna ele (e atualiza em background)
  if (cached && !shouldRevalidate) {
    fetchPromise.catch(() => {});
    return cached;
  }

  // Cache stale ou inexistente — espera rede
  return fetchPromise;
}

// ---------------------------------------------------------------------------
// Helpers de cache
// ---------------------------------------------------------------------------

function addTimestampHeader(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-SW-Cached-At", Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function isCacheEntryStale(
  cache: Cache,
  request: Request,
  ttlMs: number,
): Promise<boolean> {
  const cached = await cache.match(request);
  if (!cached) return true;

  const cachedAt = cached.headers.get("X-SW-Cached-At");
  if (!cachedAt) return true;

  return Date.now() - Number(cachedAt) > ttlMs;
}

// ---------------------------------------------------------------------------
// Mensagens do cliente (SKIP_WAITING para updates)
// ---------------------------------------------------------------------------

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
