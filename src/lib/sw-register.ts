/**
 * Registro do Service Worker com:
 * - Deteccao de updates
 * - Notificacao ao usuario
 * - Recarregamento controlado
 */

let updateCallback: (() => void) | null = null;

export function onServiceWorkerUpdate(callback: () => void) {
  updateCallback = callback;
}

export function applyUpdate() {
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

let registration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.info("[PWA] Service Worker nao suportado");
    return;
  }

  try {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "imports",
    });

    console.info("[PWA] Service Worker registrado:", registration.scope);

    // Verificar updates a cada 60 minutos
    setInterval(
      () => {
        registration?.update().catch(() => {});
      },
      60 * 60 * 1000,
    );

    // Detectar novo SW esperando
    registration.addEventListener("updatefound", () => {
      const newWorker = registration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          console.info("[PWA] Nova versao disponivel");
          updateCallback?.();
        }
      });
    });

    // Tambem verificar se ja existe um waiting
    if (registration.waiting && navigator.serviceWorker.controller) {
      updateCallback?.();
    }

    // Recarregar quando o novo SW assumir
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } catch (err) {
    console.error("[PWA] Falha ao registrar Service Worker:", err);
  }
}

export async function unregisterServiceWorker() {
  if (!registration) return;
  const result = await registration.unregister();
  console.info("[PWA] Service Worker desregistrado:", result);
}
