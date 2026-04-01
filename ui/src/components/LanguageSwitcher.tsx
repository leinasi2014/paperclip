import { useTranslation } from "react-i18next";
import { useAppLocale } from "@/i18n/useAppLocale";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useAppLocale();

  return (
    <div
      className="inline-flex items-center rounded-md border border-border p-0.5"
      aria-label={t("language.switcher")}
    >
      <Button
        type="button"
        variant={language === "en" ? "secondary" : "ghost"}
        size="xs"
        data-language="en"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        {t("language.en")}
      </Button>
      <Button
        type="button"
        variant={language === "zh-CN" ? "secondary" : "ghost"}
        size="xs"
        data-language="zh-CN"
        aria-pressed={language === "zh-CN"}
        onClick={() => setLanguage("zh-CN")}
      >
        {t("language.zhCN")}
      </Button>
    </div>
  );
}
