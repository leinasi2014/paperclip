export type AppLanguage = "en" | "zh-CN";

export function normalizeLanguage(language: string | null | undefined): AppLanguage {
  const normalized = language?.toLowerCase();
  if (normalized === "zh" || normalized === "zh-cn") {
    return "zh-CN";
  }
  return "en";
}

export function formatUsdCents(cents: number, language: string): string {
  return new Intl.NumberFormat(normalizeLanguage(language), {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(value: Date | string, language: string): string {
  return new Date(value).toLocaleDateString(normalizeLanguage(language), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export function formatRelativeTime(value: Date | string, language: string): string {
  const now = Date.now();
  const then = new Date(value).getTime();
  const seconds = Math.round((now - then) / 1000);

  const formatter = new Intl.RelativeTimeFormat(normalizeLanguage(language), { numeric: "always" });

  if (seconds < MINUTE) return formatter.format(-Math.floor(seconds), "second");
  if (seconds < HOUR) return formatter.format(-Math.floor(seconds / MINUTE), "minute");
  if (seconds < DAY) return formatter.format(-Math.floor(seconds / HOUR), "hour");
  if (seconds < WEEK) return formatter.format(-Math.floor(seconds / DAY), "day");
  if (seconds < MONTH) return formatter.format(-Math.floor(seconds / WEEK), "week");
  return formatter.format(-Math.floor(seconds / MONTH), "month");
}
