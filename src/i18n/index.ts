import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { resources } from "./locales";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "fr", "zh"],
    load: "languageOnly",
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

const normalizeLang = (language: string | undefined): string => {
  if (language?.startsWith("zh")) return "zh-CN";
  if (language?.startsWith("fr")) return "fr";
  return "en";
};

i18n.on("languageChanged", (language: string) => {
  document.documentElement.lang = normalizeLang(language);
  document.documentElement.translate = false;
});

void i18n.loadNamespaces([]).then(() => {
  document.documentElement.lang = normalizeLang(i18n.resolvedLanguage);
  document.documentElement.translate = false;
});

export default i18n;
