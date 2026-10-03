import { diffDays, eachDay, inRange } from "../dates";
import { sum } from "../money";
import type { AppData, Category, CycleKey, ISODate, Paise, PlannedGroup, Transaction } from "../types";
import { cycleBillOccurrences, type BillOccurrence } from "./bills";
import { daysLeftInCycle, getCycle, shiftCycleKey, timeframeOf, type Cycle, type Timeframe } from "./cycle";
import { isPlannedGroup, plannedByCategory, planTotals, resolvePlan, type PlanTotals, type ResolvedPlan } from "./plan";

/**
 * THE DAILY ALLOWANCE (one formula, used everywhere)
 *
 *   money in          = salary recorded this cycle (or the planned take-home,
 *                       marked "expected", until a salary is recorded)
 *                       + any other income recorded this cycle
 *   flexible money    = money in − everything committed in the plan
 *                       (fixed costs, family & EMIs, everyday targets,
 *                       savings and set-asides)
 *   safe to spend now = flexible money
 *                       − flexible spending recorded so far
 *                       − flexible-category bills still due this cycle
 *                       − overruns: for each planned category,
 *                         max(0, spent + bills still due − planned)
 *   daily allowance   = max(0, safe to spend now) ÷ days left until payday,
 *                       counting today, rounded down to whole rupees
 *
 * FIRST, PARTIAL CYCLE: if someone starts partway through a cycle, that cycle
 * runs on the amount they said had to last until payday. It takes the place of
 * money in, nothing is pre-committed, and only transactions from the starting
 * day count. Every expense and unpaid bill after that comes out of it.
 *
 * The plan sets the budget; recorded transactions and unpaid bills adjust it.
 * Spending less than planned in a category does NOT add to safe-to-spend,
 * because that money may still be needed before payday. Savings are part of
 * "committed" once and are never subtracted again. Income is never spending.
 */

export const SALARY_CATEGORY_ID = "salary";
/**
 * The allowance is "tight" when it falls below half of the plan's own daily
 * share. A fixed rupee threshold would call every ₹15,000 plan tight.
 */
export const TIGHT_RATIO = 0.5;

export interface CategoryActual {
  category: Category;
  planned: Paise;
  spent: Paise;
  /** Unpaid bill amounts in this category that belong to this cycle. */
  billsDue: Paise;
  /** How far spent + billsDue runs past the plan (planned groups only). */
  overrun: Paise;
}

export type AllowanceState = "comfortable" | "tight" | "zero" | "short" | "no-plan";

export interface CycleSummary {
  cycle: Cycle;
  timeframe: Timeframe;
  /** First day whose transactions count. The cycle start, unless this is a partial first cycle. */
  trackedFrom: ISODate;
  resolved: ResolvedPlan;
  totals: PlanTotals;

  salaryRecorded: Paise;
  /** True when money-in uses the planned take-home because no salary is recorded yet. */
  salaryExpected: boolean;
  extraIncome: Paise;
  moneyIn: Paise;

  committed: Paise;
  flexible: Paise;

  spentTotal: Paise;
  spentFlexible: Paise;
  flexibleBillsDue: Paise;
  overrunTotal: Paise;
  savingsPlanned: Paise;
  savingsActual: Paise;

  safeToSpend: Paise;
  daysLeft: number;
  dailyAllowance: Paise;
  /** Flexible money spread evenly over the whole cycle. Used for past days on the day card. */
  plannedDailyShare: Paise;
  state: AllowanceState;

  categories: CategoryActual[];
  bills: BillOccurrence[];
  billsDueTotal: Paise;
  transactions: Transaction[];
}

export function transactionsInRange(transactions: Transaction[], start: ISODate, end: ISODate): Transaction[] {
  return transactions.filter((t) => inRange(t.date, start, end));
}

/** Divide and round toward zero, never producing NaN or Infinity. */
export function safeDivide(amount: Paise, by: number): Paise {
  if (!Number.isFinite(amount) || !Number.isFinite(by) || by <= 0) return 0;
  return Math.trunc(amount / by);
}

/** Allowance rounded down to whole rupees, never negative. */
export function dailyAllowanceFor(safeToSpend: Paise, daysLeft: number): Paise {
  if (safeToSpend <= 0 || daysLeft <= 0) return 0;
  return Math.floor(safeToSpend / daysLeft / 100) * 100;
}

export function allowanceState(
  safeToSpend: Paise,
  dailyAllowance: Paise,
  plannedDailyShare: Paise,
  hasPlan: boolean,
): AllowanceState {
  if (!hasPlan) return "no-plan";
  if (safeToSpend < 0) return "short";
  if (dailyAllowance <= 0) return "zero";
  if (plannedDailyShare > 0 && dailyAllowance < plannedDailyShare * TIGHT_RATIO) return "tight";
  return "comfortable";
}

export function summarizeCycle(data: AppData, key: CycleKey, today: ISODate): CycleSummary {
  const { settings, categories, plans, bills } = data;
  const cycle = getCycle(key, settings);
  const timeframe = timeframeOf(cycle, today);
  const sp = data.startingPoint?.cycleKey === key ? data.startingPoint : undefined;
  const resolved: ResolvedPlan = sp
    ? { plan: { takeHome: sp.amount, lines: [] }, source: "starting" }
    : resolvePlan(plans, key);
  const totals = planTotals(resolved.plan, categories);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const trackedFrom = sp ? (sp.date > cycle.start ? sp.date : cycle.start) : cycle.start;

  const txns = transactionsInRange(data.transactions, trackedFrom, cycle.end);
  const income = txns.filter((t) => t.type === "income");
  const expenses = txns.filter((t) => t.type === "expense");

  const salaryRecorded = sum(income.filter((t) => t.categoryId === SALARY_CATEGORY_ID).map((t) => t.amount));
  const extraIncome = sum(income.filter((t) => t.categoryId !== SALARY_CATEGORY_ID).map((t) => t.amount));
  const salaryExpected = !sp && salaryRecorded === 0;
  const moneyIn = sp ? sp.amount + salaryRecorded + extraIncome : (salaryExpected ? totals.takeHome : salaryRecorded) + extraIncome;

  const committed = totals.committed;
  const flexible = moneyIn - committed;

  const previousStart = getCycle(shiftCycleKey(key, -1), settings).start;
  const occurrences = cycleBillOccurrences(bills, data.transactions, cycle, previousStart, today).filter(
    // Before the starting day, bills belong to money we weren't told about.
    (o) => !sp || o.dueDate >= trackedFrom,
  );
  // Bills only reduce safe-to-spend while they are still ahead of us in this cycle.
  const countBills = timeframe !== "past";

  const planned = plannedByCategory(resolved.plan, categories);
  const spentByCat = new Map<string, Paise>();
  for (const t of expenses) spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount);
  const billsByCat = new Map<string, Paise>();
  if (countBills) {
    for (const o of occurrences) {
      if (o.status === "paid") continue;
      billsByCat.set(o.bill.categoryId, (billsByCat.get(o.bill.categoryId) ?? 0) + o.bill.amount);
    }
  }

  const ids = new Set<string>([...planned.keys(), ...spentByCat.keys(), ...billsByCat.keys()]);
  const categoryRows: CategoryActual[] = [];
  let spentFlexible = 0;
  let flexibleBillsDue = 0;
  let overrunTotal = 0;
  for (const id of ids) {
    const category = catById.get(id) ?? { id, name: "Uncategorised", group: "flexible" as const };
    if (category.group === "income") continue;
    const p = planned.get(id) ?? 0;
    const s = spentByCat.get(id) ?? 0;
    const b = billsByCat.get(id) ?? 0;
    let overrun = 0;
    if (isPlannedGroup(category.group)) {
      overrun = Math.max(0, s + b - p);
      overrunTotal += overrun;
    } else {
      spentFlexible += s;
      flexibleBillsDue += b;
    }
    categoryRows.push({ category, planned: p, spent: s, billsDue: b, overrun });
  }
  categoryRows.sort((a, b) => b.spent - a.spent || b.planned - a.planned || a.category.name.localeCompare(b.category.name));

  const safeToSpend = flexible - spentFlexible - flexibleBillsDue - overrunTotal;
  const daysLeft = daysLeftInCycle(cycle, today);
  const hasPlan = sp !== undefined || (resolved.source !== "none" && totals.takeHome + extraIncome + salaryRecorded > 0);
  const dailyAllowance = timeframe === "past" ? 0 : dailyAllowanceFor(safeToSpend, daysLeft);
  const trackedDays = Math.max(1, diffDays(trackedFrom, cycle.nextPayday));
  const plannedDailyShare = Math.max(0, safeDivide(flexible, trackedDays));

  return {
    cycle,
    timeframe,
    trackedFrom,
    resolved,
    totals,
    salaryRecorded,
    salaryExpected,
    extraIncome,
    moneyIn,
    committed,
    flexible,
    spentTotal: sum(expenses.map((t) => t.amount)),
    spentFlexible,
    flexibleBillsDue,
    overrunTotal,
    savingsPlanned: totals.savings,
    savingsActual: sum(expenses.filter((t) => catById.get(t.categoryId)?.group === "savings").map((t) => t.amount)),
    safeToSpend,
    daysLeft,
    dailyAllowance,
    plannedDailyShare,
    state: allowanceState(safeToSpend, dailyAllowance, plannedDailyShare, hasPlan),
    categories: categoryRows,
    bills: occurrences,
    billsDueTotal: countBills ? sum(occurrences.filter((o) => o.status !== "paid").map((o) => o.bill.amount)) : 0,
    transactions: txns,
  };
}

/* ------------------------------------------------------------------ */
/* Day card                                                            */
/* ------------------------------------------------------------------ */

export type DayState = "within" | "over" | "today" | "ahead" | "empty" | "untracked";

export interface DayCell {
  date: ISODate;
  state: DayState;
  /** Flexible spending recorded on this day. */
  spent: Paise;
  /** What the day could take: the planned share for past days, the live allowance from today on. */
  share: Paise;
  billsDue: BillOccurrence[];
}

/**
 * One cell per day of the cycle. Only flexible-category spending is drawn, because
 * that is the money the daily allowance covers; rent and EMIs live in the plan.
 */
export function dayCells(summary: CycleSummary, today: ISODate, categories: Category[]): DayCell[] {
  const flexibleIds = new Set(categories.filter((c) => c.group === "flexible").map((c) => c.id));
  const spentByDay = new Map<ISODate, Paise>();
  for (const t of summary.transactions) {
    if (t.type !== "expense") continue;
    if (!flexibleIds.has(t.categoryId) && categories.some((c) => c.id === t.categoryId)) continue;
    spentByDay.set(t.date, (spentByDay.get(t.date) ?? 0) + t.amount);
  }
  return eachDay(summary.cycle.start, summary.cycle.end).map((date) => {
    const spent = spentByDay.get(date) ?? 0;
    const billsDue = summary.bills.filter((o) => o.dueDate === date);
    if (date < summary.trackedFrom) return { date, spent: 0, share: 0, billsDue, state: "untracked" };
    if (date < today) {
      const share = summary.plannedDailyShare;
      return { date, spent, share, billsDue, state: spent > share ? "over" : spent > 0 ? "within" : "empty" };
    }
    if (date === today) return { date, spent, share: summary.dailyAllowance, billsDue, state: "today" };
    return {
      date,
      spent,
      share: summary.timeframe === "future" ? summary.plannedDailyShare : summary.dailyAllowance,
      billsDue,
      state: "ahead",
    };
  });
}

/* ------------------------------------------------------------------ */
/* Spending breakdown                                                  */
/* ------------------------------------------------------------------ */

export interface BreakdownRow {
  id: string;
  name: string;
  group: PlannedGroup | "flexible";
  spent: Paise;
  planned: Paise;
  percent: number;
}

/** Spending by category with each row's share of total spending this cycle. */
export function spendingBreakdown(summary: CycleSummary): BreakdownRow[] {
  const total = summary.spentTotal;
  return summary.categories
    .filter((c) => c.spent > 0 || c.planned > 0)
    .map((c) => ({
      id: c.category.id,
      name: c.category.name,
      group: c.category.group === "income" ? "flexible" : (c.category.group as PlannedGroup | "flexible"),
      spent: c.spent,
      planned: c.planned,
      percent: total > 0 ? Math.round((c.spent / total) * 100) : 0,
    }));
}
