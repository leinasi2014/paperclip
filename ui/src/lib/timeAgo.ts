import i18n from "../i18n";
import { formatRelativeTime, normalizeLanguage } from "../i18n/formatters";

export function timeAgo(date: Date | string): string {
  return formatRelativeTime(date, normalizeLanguage(i18n.resolvedLanguage ?? i18n.language));
}
