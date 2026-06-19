import { useState } from "react";
import { CheckCircle2, RefreshCw, Usb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import type { ThemeMode } from "@/hooks/useTheme";
import { refreshWebCache } from "@/pwa";

interface AppHeaderProps {
  isConnected: boolean;
  statusText: string;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export function AppHeader({ isConnected, statusText, theme, onThemeChange }: AppHeaderProps) {
  const { t } = useTranslation();
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);

  async function handleRefreshCache() {
    if (isRefreshingCache) {
      return;
    }

    setIsRefreshingCache(true);

    try {
      await refreshWebCache();
    } finally {
      setIsRefreshingCache(false);
    }
  }

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <img className="app-icon" src="/pwa-icon.svg" alt="" aria-hidden="true" />
        <h1>{t("app.title")}</h1>
      </div>
      <div className="header-actions">
        <LanguageSwitcher />
        <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleRefreshCache}
          disabled={isRefreshingCache}
          title={t("pwa.refreshCacheTitle")}
          aria-label={t("pwa.refreshCache")}
        >
          <RefreshCw className={isRefreshingCache ? "animate-spin" : undefined} size={16} />
        </Button>
        <div className={`status-pill ${isConnected ? "connected" : ""}`}>
          {isConnected ? <CheckCircle2 size={16} /> : <Usb size={16} />}
          <span>{statusText}</span>
        </div>
      </div>
    </header>
  );
}
