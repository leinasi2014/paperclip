import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { resources, supportedLanguages } from "./resources";

const localeStorageKey = "paperclip.locale";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...supportedLanguages],
    defaultNS: "common",
    ns: ["common", "company", "workspaces", "settings"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: localeStorageKey,
      caches: ["localStorage"],
    },
  });

function syncDocumentLanguage(language: string): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.lang = language;
}

i18n.on("languageChanged", syncDocumentLanguage);
syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language ?? "en");

export { localeStorageKey };
export default i18n;
