import toast from "react-hot-toast";
import { registerSW } from "virtual:pwa-register";
import i18n from "./i18n";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

function t(key: string) {
  return i18n.t(key);
}

let reloadingForUpdate = false;

function reloadToLatestVersion() {
  if (reloadingForUpdate) {
    return;
  }

  reloadingForUpdate = true;
  window.location.reload();
}

function checkForServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  if (!navigator.onLine) {
    return;
  }

  void registration.update().catch((error) => {
    console.warn("PWA service worker update check failed", error);
  });
}

const updateServiceWorker = registerSW({
  immediate: true,
  onOfflineReady() {
    toast.success(t("pwa.offlineReady"), { id: "pwa-offline-ready" });
  },
  onNeedReload() {
    toast.success(t("pwa.cacheRefresh"), { id: "pwa-cache-refresh" });
    reloadToLatestVersion();
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    checkForServiceWorkerUpdate(registration);

    window.addEventListener("online", () => {
      checkForServiceWorkerUpdate(registration);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkForServiceWorkerUpdate(registration);
      }
    });

    window.setInterval(() => {
      checkForServiceWorkerUpdate(registration);
    }, UPDATE_CHECK_INTERVAL);
  },
  onNeedRefresh() {
    toast.success(t("pwa.cacheRefresh"), { id: "pwa-cache-refresh" });
    void updateServiceWorker();
  },
  onRegisterError(error) {
    console.error("PWA service worker registration failed", error);
  },
});
