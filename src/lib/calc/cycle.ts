import {
  addDays,
  daysInMonth,
  diffDays,
  formatMonthName,
  formatShort,
  isWeekend,
  parts,
  toISO,
} from "../dates";
import type { CycleKey, ISODate, PaySchedule, Settings, WeekendRule } from "../types";

/**
 * Pay cycles.
 *
 * A cycle starts on a payday and ends the day before the next payday. It is
 * named after the month its salary arrives in, so a salary on 7 October opens
 * the "October cycle" (7 Oct – 6 Nov). Nothing here assumes payday is the 1st.
 */

export interface Cycle {
  key: CycleKey;
  start: ISODate;
  end: ISODate;
  /** The payday that closes this cycle (= end + 1). */
  nextPayday: ISODate;
  length: number;
}

export function cycleKey(y: number, m: number): CycleKey {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function parseCycleKey(key: CycleKey): { y: number; m: number } {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return { y, m };
}

export function isCycleKey(value: unknown): value is CycleKey {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const m = Number(value.slice(5));
  return m >= 1 && m <= 12;
}

export function shiftCycleKey(key: CycleKey, n: number): CycleKey {
  const { y, m } = parseCycleKey(key);
  const total = y * 12 + (m - 1) + n;
  return cycleKey(Math.floor(total / 12), (total % 12) + 1);
}

export function compareCycleKeys(a: CycleKey, b: CycleKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function applyWeekendRule(date: ISODate, rule: WeekendRule): ISODate {
  if (rule === "as-is") return date;
  const step = rule === "previous-working-day" ? -1 : 1;
  let d = date;
  while (isWeekend(d)) d = addDays(d, step);
  return d;
}

/** The payday the schedule produces for a cycle, before any one-off change. */
export function scheduledPayday(key: CycleKey, schedule: PaySchedule, weekendRule: WeekendRule): ISODate {
  const { y, m } = parseCycleKey(key);
  const last = daysInMonth(y, m);
  if (schedule.kind === "last-working-day") {
    let d = toISO(y, m, last);
    while (isWeekend(d)) d = addDays(d, -1);
    return d;
  }
  const day = Math.min(Math.max(1, Math.round(schedule.day)), last);
  return applyWeekendRule(toISO(y, m, day), weekendRule);
}

/** The actual payday for a cycle: a one-off change if one is set, otherwise the schedule. */
export function paydayFor(key: CycleKey, settings: Settings): ISODate {
  return settings.paydayOverrides[key] ?? scheduledPayday(key, settings.schedule, settings.weekendRule);
}

export function getCycle(key: CycleKey, settings: Settings): Cycle {
  const start = paydayFor(key, settings);
  let nextPayday = paydayFor(shiftCycleKey(key, 1), settings);
  // Defensive: a malformed override must never produce an empty or inverted cycle.
  if (nextPayday <= start) nextPayday = addDays(start, 1);
  const end = addDays(nextPayday, -1);
  return { key, start, end, nextPayday, length: diffDays(start, nextPayday) };
}

/** The cycle a given date falls in. */
export function cycleKeyForDate(date: ISODate, settings: Settings): CycleKey {
  const { y, m } = parts(date);
  let key = cycleKey(y, m);
  // Walk at most a few steps; overrides can move a payday across a month boundary.
  for (let i = 0; i < 4; i++) {
    const cycle = getCycle(key, settings);
    if (date < cycle.start) key = shiftCycleKey(key, -1);
    else if (date > cycle.end) key = shiftCycleKey(key, 1);
    else return key;
  }
  return key;
}

export function getCycleForDate(date: ISODate, settings: Settings): Cycle {
  return getCycle(cycleKeyForDate(date, settings), settings);
}

export type Timeframe = "past" | "current" | "future";

export function timeframeOf(cycle: Cycle, today: ISODate): Timeframe {
  if (today > cycle.end) return "past";
  if (today < cycle.start) return "future";
  return "current";
}

/** Days from today until payday, counting today. Zero outside the current cycle. */
export function daysLeftInCycle(cycle: Cycle, today: ISODate): number {
  if (today < cycle.start) return cycle.length;
  if (today > cycle.end) return 0;
  return diffDays(today, cycle.nextPayday);
}

/** "October cycle" */
export function cycleName(key: CycleKey, withYear = false): string {
  const { y, m } = parseCycleKey(key);
  return `${formatMonthName(y, m, withYear)} cycle`;
}

/** "7 Oct – 6 Nov" */
export function cycleRange(cycle: Cycle): string {
  return `${formatShort(cycle.start)} – ${formatShort(cycle.end)}`;
}

/**
 * Validates a one-off change to the next payday. It must fall after the
 * current cycle's start and no more than 45 days out, so cycles stay sensible.
 */
export function validateNextPayday(
  date: ISODate,
  current: Cycle,
  today: ISODate,
): { ok: true } | { ok: false; error: string } {
  if (date <= today) return { ok: false, error: "Pick a date after today." };
  if (date <= current.start) return { ok: false, error: "Payday must come after the start of this cycle." };
  if (diffDays(current.start, date) > 45) {
    return { ok: false, error: "That's more than 45 days after your last payday. Pick an earlier date." };
  }
  return { ok: true };
}
