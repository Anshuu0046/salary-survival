import { getCycleForDate, getCycle, shiftCycleKey, parseCycleKey } from "./calc/cycle";
import { billDueDates } from "./calc/bills";
import { addDays, eachDay, toISO } from "./dates";
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "./defaults";
import type { AppData, Bill, ISODate, Plan, Settings, Transaction } from "./types";

/**
 * The sample profile. It is deterministic: the same "today" always produces
 * the same data, so the demo is reproducible and testable. Dates are placed
 * relative to today so the demo always shows a live cycle. Nothing in the
 * calculations depends on these numbers.
 *
 *   Take-home ₹15,000 · Rent ₹4,000 · Family support ₹2,000 · Travel ₹1,500
 *   Food ₹3,000 · EMI ₹1,000 · Savings ₹1,000 → ₹2,500 flexible
 */

export const SAMPLE_PLAN: Plan = {
  takeHome: 15_000_00,
  lines: [
    { id: "s-line-rent", categoryId: "rent", amount: 4_000_00 },
    { id: "s-line-family", categoryId: "family", amount: 2_000_00 },
    { id: "s-line-emi", categoryId: "emi", amount: 1_000_00, label: "Phone EMI" },
    { id: "s-line-food", categoryId: "food", amount: 3_000_00 },
    { id: "s-line-travel", categoryId: "travel", amount: 1_500_00 },
    { id: "s-line-savings", categoryId: "savings", amount: 1_000_00, label: "Recurring deposit" },
  ],
};

/** Small deterministic PRNG (mulberry32) seeded from a date string. */
function rng(seedText: string) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(r: () => number, min: number, max: number, step = 10): number {
  return Math.round((min + r() * (max - min)) / step) * step;
}

export function sampleData(today: ISODate): AppData {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    name: "Priya",
    schedule: { kind: "day-of-month", day: 7 },
    weekendRule: "previous-working-day",
    paydayOverrides: {},
  };
  const current = getCycleForDate(today, settings);
  const previous = getCycle(shiftCycleKey(current.key, -1), settings);
  const { y, m } = parseCycleKey(previous.key);

  const bills: Bill[] = [
    { id: "s-bill-rent", name: "Rent", amount: 4_000_00, categoryId: "rent", recurrence: "monthly", dueDate: toISO(y, m, 10), remindDaysBefore: 5 },
    { id: "s-bill-family", name: "Send home", amount: 2_000_00, categoryId: "family", recurrence: "monthly", dueDate: toISO(y, m, 9), remindDaysBefore: 3 },
    { id: "s-bill-emi", name: "Phone EMI", amount: 1_000_00, categoryId: "emi", recurrence: "monthly", dueDate: toISO(y, m, 15), remindDaysBefore: 5 },
    {
      id: "s-bill-recharge",
      name: "Mobile recharge",
      amount: 299_00,
      categoryId: "bills",
      recurrence: "every-28-days",
      dueDate: addDays(previous.start, 3),
      remindDaysBefore: 3,
      note: "Prepaid plan, renews every 28 days.",
    },
  ];

  const txns: Transaction[] = [];
  let n = 0;
  const add = (t: Omit<Transaction, "id" | "createdAt">) => {
    n += 1;
    txns.push({ ...t, id: `s-txn-${n}`, createdAt: n });
  };

  for (const cycle of [previous, current]) {
    const last = cycle.key === current.key ? addDays(today, -1) : cycle.end;
    if (last < cycle.start) continue;

    add({ type: "income", amount: 15_000_00, date: cycle.start, description: "Salary", categoryId: "salary" });

    // Bills due before today are paid, each through one linked transaction.
    for (const bill of bills) {
      for (const due of billDueDates(bill, cycle.start, last)) {
        add({ type: "expense", amount: bill.amount, date: due, description: bill.name, categoryId: bill.categoryId, billId: bill.id, billDueDate: due });
      }
    }

    eachDay(cycle.start, last).forEach((date, i) => {
      const r = rng(date);
      if (i === 1) add({ type: "expense", amount: 1_000_00, date, description: "Recurring deposit", categoryId: "savings" });
      if (i % 10 === 0) add({ type: "expense", amount: 500_00, date, description: "Metro card top-up", categoryId: "travel" });
      if (i % 4 === 2) add({ type: "expense", amount: between(r, 320_00, 460_00, 1000), date, description: i % 8 === 2 ? "Weekly groceries" : "Vegetables and milk", categoryId: "food" });
      if (r() < 0.45) add({ type: "expense", amount: between(r, 20_00, 50_00, 500), date, description: "Chai and snacks", categoryId: "eating-out" });
      if (i % 9 === 5) add({ type: "expense", amount: between(r, 150_00, 200_00, 1000), date, description: "Lunch with team", categoryId: "eating-out" });
      if (i === 12) add({ type: "expense", amount: 449_00, date, description: "T-shirt", categoryId: "shopping" });
      if (i === 18) add({ type: "expense", amount: 230_00, date, description: "Movie ticket", categoryId: "fun" });
    });

    if (cycle.key === previous.key) {
      add({ type: "income", amount: 1_200_00, date: addDays(cycle.start, 14), description: "Weekend tuition", categoryId: "other-income", note: "Two Saturdays of maths tuition." });
    }
  }

  return {
    version: 1,
    isSample: true,
    settings,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    plans: { [previous.key]: SAMPLE_PLAN },
    transactions: txns,
    bills,
    updatedAt: 0,
  };
}
