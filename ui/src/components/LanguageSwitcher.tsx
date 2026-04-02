import { ChevronsUpDown, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppLocale } from "@/i18n/useAppLocale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGUAGE_OPTIONS = [
  { value: "en", labelKey: "language.en" },
  { value: "zh-CN", labelKey: "language.zhCN" },
] as const;

export function LanguageSwitcher() {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useAppLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("language.switcher")}
          title={t("language.switcher")}
          className="h-9 gap-1.5 px-2 text-[13px] font-medium text-muted-foreground data-[state=open]:bg-accent/60 data-[state=open]:text-foreground"
        >
          <Globe className="h-4 w-4" />
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-40">
        <DropdownMenuLabel>{t("language.switcher")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={language} onValueChange={(value) => setLanguage(value as "en" | "zh-CN")}>
          {LANGUAGE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              data-language={option.value}
            >
              <span>{t(option.labelKey)}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
