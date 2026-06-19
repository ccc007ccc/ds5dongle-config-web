import toast from "react-hot-toast";
import { registerSW } from "virtual:pwa-register";
import i18n from "./i18n";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;
const MANUAL_REFRESH_TOAST_ID = "pwa-manual-cache-refresh";
const MANUAL_REFRESH_RELOAD_DELAY = 450;

function t(key: string) {
  return i18n.t(key);
}

async function updateRegisteredServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.update()));
}

async function clearCacheStorage() {
  if (!("caches" in window)) {
    return;
  }

  const cacheNames = await window.caches.keys();
  await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
}

export async function refreshWebCache() {
  if (!navigator.onLine) {
    toast.error(t("pwa.cacheRefreshOffline"), { id: MANUAL_REFRESH_TOAST_ID });
    return;
  }

  toast.loading(t("pwa.cacheRefreshing"), { id: MANUAL_REFRESH_TOAST_ID });

  try {
    await updateRegisteredServiceWorkers();
    await clearCacheStorage();
    await updateServiceWorker(true);

    toast.success(t("pwa.cacheRefreshed"), { id: MANUAL_REFRESH_TOAST_ID });
    window.setTimeout(() => {
      window.location.reload();
    }, MANUAL_REFRESH_RELOAD_DELAY);
  } catch (error) {
    console.error("PWA cache refresh failed", error);
    toast.error(t("pwa.cacheRefreshFailed"), { id: MANUAL_REFRESH_TOAST_ID });
  }
}

const updateServiceWorker = registerSW({
  immediate: true,
  onOfflineReady() {
    toast.success(t("pwa.offlineReady"), { id: "pwa-offline-ready" });
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    window.addEventListener("online", () => {
      void registration.update();
    });

    window.setInterval(() => {
      if (navigator.onLine) {
        void registration.update();
      }
    }, UPDATE_CHECK_INTERVAL);
  },
  onNeedRefresh() {
    toast.success(t("pwa.cacheRefresh"), { id: "pwa-cache-refresh" });
    void updateServiceWorker(true);
  },
  onRegisterError(error) {
    console.error("PWA service worker registration failed", error);
  },
});
