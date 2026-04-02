import { asNumber, appendWithCap, MAX_EXCERPT_BYTES, parseObject } from "../../adapters/utils.js";

export const HEARTBEAT_TASK_KEY = "__heartbeat__";

export function appendExcerpt(prev: string, chunk: string) {
  return appendWithCap(prev, chunk, MAX_EXCERPT_BYTES);
}

export function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function truncateDisplayId(value: string | null | undefined, max = 128) {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

export function normalizeSessionParams(params: Record<string, unknown> | null | undefined) {
  const parsed = parseObject(params);
  return Object.keys(parsed).length > 0 ? parsed : null;
}

export function formatCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US");
}

export function normalizeMaxConcurrentRuns(
  value: unknown,
  fallback: number,
  max: number,
) {
  const parsed = Math.floor(asNumber(value, fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(fallback, Math.min(max, parsed));
}
