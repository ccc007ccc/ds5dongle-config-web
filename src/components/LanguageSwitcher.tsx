import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LANGUAGES = [
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
  { value: "zh", label: "中文" },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const resolved = i18n.resolvedLanguage ?? "en";
  const currentLanguage = LANGUAGES.find((l) => resolved.startsWith(l.value))?.value ?? "en";

  return (
    <div className="language-switcher" aria-label={t("language.label")}>
      <Languages size={16} />
      <Select value={currentLanguage} onValueChange={(language) => void i18n.changeLanguage(language)}>
        <SelectTrigger className="h-9 w-[80px] text-xs font-bold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang.value} value={lang.value} className="text-xs font-bold">
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
