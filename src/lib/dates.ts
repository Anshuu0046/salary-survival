import type { ISODate } from "./types";

/**
 * Calendar-date helpers. All arithmetic runs in UTC on midnight timestamps, so
 * daylight-saving shifts and the user's timezone can never move a date.
 */

const DAY_MS = 86_400_000;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parts(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

export function toISO(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toUTC(iso: ISODate): number {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 1-based month. Handles leap years. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTC(toUTC(iso) + n * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: ISODate): number {
  return new Date(toUTC(iso)).getUTCDay();
}

export function isWeekend(iso: ISODate): boolean {
  const w = weekday(iso);
  return w === 0 || w === 6;
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

/** Inclusive range check. */
export function inRange(iso: ISODate, start: ISODate, end: ISODate): boolean {
  return iso >= start && iso <= end;
}

/** Add whole months, clamping to the target month's length (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: ISODate, n: number, anchorDay?: number): ISODate {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(anchorDay ?? d, daysInMonth(ny, nm)));
}

/** Today's date on the user's own clock. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" });
    fmtCache.set(key, f);
  }
  return f;
}

/** "7 Oct" */
export function formatShort(iso: ISODate): string {
  return fmt({ day: "numeric", month: "short" }).format(toUTC(iso));
}

/** "Fri, 7 Nov" */
export function formatWithWeekday(iso: ISODate): string {
  return fmt({ weekday: "short", day: "numeric", month: "short" }).format(toUTC(iso));
}

/** "7 Oct 2026" */
export function formatLong(iso: ISODate): string {
  return fmt({ day: "numeric", month: "short", year: "numeric" }).format(toUTC(iso));
}

/** "October" / "October 2026" */
export function formatMonthName(y: number, m: number, withYear = false): string {
  return fmt(withYear ? { month: "long", year: "numeric" } : { month: "long" }).format(Date.UTC(y, m - 1, 1));
}

export function formatWeekdayLetter(iso: ISODate): string {
  return fmt({ weekday: "narrow" }).format(toUTC(iso));
}
