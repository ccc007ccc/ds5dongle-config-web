import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer" aria-label="Page footer">
      <div className="footer-copy">
        <strong>{t("footer.title")}</strong>
        <span>{t("footer.description")}</span>
      </div>
      <a className="footer-link" href="https://github.com/ccc007ccc/DS5Dongle" target="_blank" rel="noopener noreferrer">
        <GitBranch size={16} />
        github.com/ccc007ccc/DS5Dongle
      </a>
    </footer>
  );
}
