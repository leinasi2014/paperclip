import { useTranslation } from "react-i18next";

export function normalizeAppLanguage(value: string | null | undefined): "en" | "zh-CN" {
  const normalized = value?.toLowerCase();

  if (normalized === "zh" || normalized === "zh-cn") {
    return "zh-CN";
  }

  return "en";
}

export function useAppLocale() {
  const { i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language);

  return {
    language,
    setLanguage: (nextLanguage: string) => i18n.changeLanguage(normalizeAppLanguage(nextLanguage)),
  };
}
