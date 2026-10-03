import { z } from "zod";
import { isCycleKey } from "./calc/cycle";
import { isISODate } from "./dates";
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "./defaults";
import type { AppData, Bill, Category, Plan, Settings, Transaction } from "./types";

/**
 * Data access.
 *
 * Components never touch localStorage. They go through a DataRepository, so a
 * server-backed repository can replace this one without changing the UI.
 *
 * Stored data is validated record by record. A malformed record is dropped
 * on its own and the rest is kept; unreadable JSON is copied aside before
 * anything is overwritten, so nothing is lost silently.
 */

export const STORAGE_KEY = "salarysurvival:data:v1";
export const BACKUP_PREFIX = "salarysurvival:unreadable:";

const isoDate = z.string().refine(isISODate, "Invalid date");
const paise = z.number().int().min(0).max(1_00_00_000_00);
const id = z.string().min(1).max(120);

const categorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  group: z.enum(["fixed", "obligations", "variable", "savings", "setAside", "flexible", "income"]),
  archived: z.boolean().optional(),
  system: z.boolean().optional(),
});

const planSchema = z.object({
  takeHome: paise,
  lines: z.array(
    z.object({
      id,
      categoryId: id,
      amount: paise,
      oneOff: z.boolean().optional(),
      label: z.string().max(80).optional(),
    }),
  ),
});

const settingsSchema = z.object({
  name: z.string().max(60),
  schedule: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("day-of-month"), day: z.number().int().min(1).max(31) }),
    z.object({ kind: z.literal("last-working-day") }),
  ]),
  weekendRule: z.enum(["as-is", "previous-working-day", "next-working-day"]),
  paydayOverrides: z.record(z.string(), z.string()),
});

const transactionSchema = z.object({
  id,
  type: z.enum(["income", "expense"]),
  amount: paise.refine((v) => v > 0, "Amount must be positive"),
  date: isoDate,
  description: z.string().trim().min(1).max(120),
  categoryId: id,
  note: z.string().max(500).optional(),
  billId: id.optional(),
  billDueDate: isoDate.optional(),
  createdAt: z.number(),
});

const startingPointSchema = z.object({
  cycleKey: z.string().refine(isCycleKey),
  date: isoDate,
  amount: paise,
});

const billSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  amount: paise.refine((v) => v > 0, "Amount must be positive"),
  categoryId: id,
  recurrence: z.enum(["monthly", "every-28-days", "quarterly", "yearly", "once"]),
  dueDate: isoDate,
  remindDaysBefore: z.number().int().min(0).max(30),
  note: z.string().max(500).optional(),
});

export interface SanitizeReport {
  dropped: number;
}

function keepValid<T>(items: unknown, schema: z.ZodType<T>, report: SanitizeReport): T[] {
  if (!Array.isArray(items)) {
    if (items !== undefined) report.dropped += 1;
    return [];
  }
  const out: T[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    else report.dropped += 1;
  }
  return out;
}

/** Turns anything into valid AppData, keeping every record that passes validation. */
export function sanitize(raw: unknown): { data: AppData; report: SanitizeReport } {
  const report: SanitizeReport = { dropped: 0 };
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const settingsParsed = settingsSchema.safeParse(obj.settings);
  let settings: Settings;
  if (settingsParsed.success) {
    const overrides = Object.fromEntries(
      Object.entries(settingsParsed.data.paydayOverrides).filter(([k, v]) => isCycleKey(k) && isISODate(v)),
    );
    report.dropped += Object.keys(settingsParsed.data.paydayOverrides).length - Object.keys(overrides).length;
    settings = { ...settingsParsed.data, paydayOverrides: overrides };
  } else {
    if (obj.settings !== undefined) report.dropped += 1;
    settings = { ...DEFAULT_SETTINGS, paydayOverrides: {} };
  }

  let categories: Category[] = keepValid(obj.categories, categorySchema, report);
  // System categories must always exist; transactions depend on them.
  for (const sys of DEFAULT_CATEGORIES.filter((c) => c.system)) {
    if (!categories.some((c) => c.id === sys.id)) categories = [{ ...sys }, ...categories];
  }
  // Duplicate ids would make lookups ambiguous; keep the first.
  const seen = new Set<string>();
  categories = categories.filter((c) => (seen.has(c.id) ? (report.dropped++, false) : (seen.add(c.id), true)));

  const plans: Record<string, Plan> = {};
  if (obj.plans && typeof obj.plans === "object") {
    for (const [key, value] of Object.entries(obj.plans as Record<string, unknown>)) {
      const parsed = planSchema.safeParse(value);
      if (isCycleKey(key) && parsed.success) plans[key] = parsed.data;
      else report.dropped += 1;
    }
  }

  const transactions: Transaction[] = keepValid(obj.transactions, transactionSchema, report);
  const bills: Bill[] = keepValid(obj.bills, billSchema, report);
  const sp = startingPointSchema.safeParse(obj.startingPoint);
  if (obj.startingPoint !== undefined && !sp.success) report.dropped += 1;

  return {
    data: {
      version: 1,
      isSample: obj.isSample === true,
      settings,
      categories,
      plans,
      transactions,
      bills,
      ...(sp.success ? { startingPoint: sp.data } : {}),
      updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
    },
    report,
  };
}

export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; data: AppData }
  | { status: "repaired"; data: AppData; dropped: number }
  | { status: "unreadable"; backupKey: string | null };

export interface DataRepository {
  load(): LoadResult;
  save(data: AppData): { ok: true } | { ok: false; error: string };
  clear(): void;
}

export function createLocalStorageRepository(storage: Storage | null = safeLocalStorage()): DataRepository {
  return {
    load() {
      if (!storage) return { status: "empty" };
      let text: string | null = null;
      try {
        text = storage.getItem(STORAGE_KEY);
      } catch {
        return { status: "empty" };
      }
      if (text === null) return { status: "empty" };
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        const backupKey = `${BACKUP_PREFIX}${Date.now()}`;
        try {
          storage.setItem(backupKey, text);
          return { status: "unreadable", backupKey };
        } catch {
          return { status: "unreadable", backupKey: null };
        }
      }
      const { data, report } = sanitize(raw);
      return report.dropped > 0 ? { status: "repaired", data, dropped: report.dropped } : { status: "ok", data };
    },
    save(data) {
      if (!storage) return { ok: false, error: "This browser isn't letting SalarySurvival save data." };
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
        return { ok: true };
      } catch {
        return { ok: false, error: "Couldn't save. Your browser storage may be full or blocked." };
      }
    },
    clear() {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        /* storage blocked: nothing to clear */
      }
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
