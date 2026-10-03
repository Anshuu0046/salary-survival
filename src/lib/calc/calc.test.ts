import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysInMonth, diffDays, isISODate } from "../dates";
import { emptyData } from "../defaults";
import { formatINR, paiseToInput, parseAmount, percentOf } from "../money";
import { sampleData, SAMPLE_PLAN } from "../sample";
import { sanitize } from "../storage";
import type { AppData, Bill, Settings, Transaction } from "../types";
import { billDueDates, billOccurrences, statusOf } from "./bills";
import {
  cycleKeyForDate,
  daysLeftInCycle,
  getCycle,
  scheduledPayday,
  shiftCycleKey,
  validateNextPayday,
} from "./cycle";
import { planTotals, resolvePlan, runningRemainders } from "./plan";
import { compareScenario, EMPTY_SCENARIO } from "./scenario";
import { dailyAllowanceFor, dayCells, safeDivide, spendingBreakdown, summarizeCycle } from "./summary";

const R = (rupees: number) => Math.round(rupees * 100);

const settings7: Settings = {
  name: "",
  schedule: { kind: "day-of-month", day: 7 },
  weekendRule: "as-is",
  paydayOverrides: {},
};

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    ...emptyData(),
    settings: settings7,
    plans: { "2026-10": SAMPLE_PLAN },
    ...overrides,
  };
}

let seq = 0;
function txn(partial: Partial<Transaction> & Pick<Transaction, "amount" | "date" | "categoryId">): Transaction {
  seq += 1;
  return { id: `t${seq}`, type: "expense", description: "x", createdAt: seq, ...partial };
}

/* ------------------------------------------------------------------ */

describe("dates", () => {
  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(diffDays("2026-10-26", "2026-11-07")).toBe(12);
  });

  it("clamps month arithmetic to the target month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-02-28", 1, 31)).toBe("2026-03-31");
  });

  it("validates ISO dates", () => {
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("hello")).toBe(false);
  });
});

describe("money", () => {
  it("formats with Indian digit grouping", () => {
    expect(formatINR(R(100000))).toBe("₹1,00,000");
    expect(formatINR(R(1234567))).toBe("₹12,34,567");
    expect(formatINR(R(420))).toBe("₹420");
    expect(formatINR(R(12.5))).toBe("₹12.50");
    expect(formatINR(0)).toBe("₹0");
  });

  it("uses a real minus sign and optional plus", () => {
    expect(formatINR(R(-800))).toBe("−₹800");
    expect(formatINR(R(500), { signed: true })).toBe("+₹500");
    expect(formatINR(R(420.99), { wholeRupees: true })).toBe("₹420");
  });

  it("never prints NaN", () => {
    expect(formatINR(Number.NaN)).toBe("₹0");
    expect(formatINR(Number.POSITIVE_INFINITY)).toBe("₹0");
  });

  it("parses what people type", () => {
    expect(parseAmount("1,500")).toEqual({ ok: true, value: R(1500) });
    expect(parseAmount("₹ 1,00,000")).toEqual({ ok: true, value: R(100000) });
    expect(parseAmount("12.5")).toEqual({ ok: true, value: R(12.5) });
    expect(parseAmount("0.05")).toEqual({ ok: true, value: 5 });
    expect(parseAmount("").ok).toBe(false);
    expect(parseAmount("-50").ok).toBe(false);
    expect(parseAmount("abc").ok).toBe(false);
    expect(parseAmount("1.234").ok).toBe(false);
    expect(parseAmount("0").ok).toBe(false);
    expect(parseAmount("0", { allowZero: true })).toEqual({ ok: true, value: 0 });
    expect(parseAmount("200000000").ok).toBe(false);
  });

  it("round-trips amounts into input text", () => {
    expect(paiseToInput(R(1500))).toBe("1500");
    expect(paiseToInput(R(1500.5))).toBe("1500.50");
    expect(paiseToInput(0)).toBe("");
  });

  it("computes percentages safely", () => {
    expect(percentOf(R(25), R(100))).toBe(25);
    expect(percentOf(R(25), 0)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("pay cycles", () => {
  it("runs from payday to the day before the next payday", () => {
    const c = getCycle("2026-10", settings7);
    expect(c.start).toBe("2026-10-07");
    expect(c.end).toBe("2026-11-06");
    expect(c.nextPayday).toBe("2026-11-07");
    expect(c.length).toBe(31);
  });

  it("handles short months and a payday on the 31st", () => {
    const s: Settings = { ...settings7, schedule: { kind: "day-of-month", day: 31 } };
    expect(scheduledPayday("2026-02", s.schedule, "as-is")).toBe("2026-02-28");
    const feb = getCycle("2026-02", s);
    expect(feb.start).toBe("2026-02-28");
    expect(feb.end).toBe("2026-03-30");
    expect(getCycle("2026-01", s).length).toBe(28);
  });

  it("moves weekend paydays according to the rule", () => {
    // 7 Nov 2026 is a Saturday.
    expect(scheduledPayday("2026-11", { kind: "day-of-month", day: 7 }, "previous-working-day")).toBe("2026-11-06");
    expect(scheduledPayday("2026-11", { kind: "day-of-month", day: 7 }, "next-working-day")).toBe("2026-11-09");
    expect(scheduledPayday("2026-11", { kind: "day-of-month", day: 7 }, "as-is")).toBe("2026-11-07");
  });

  it("finds the last working day", () => {
    // 31 Oct 2026 is a Saturday.
    expect(scheduledPayday("2026-10", { kind: "last-working-day" }, "as-is")).toBe("2026-10-30");
  });

  it("puts dates before this month's payday in the previous cycle", () => {
    expect(cycleKeyForDate("2026-10-03", settings7)).toBe("2026-09");
    expect(cycleKeyForDate("2026-10-07", settings7)).toBe("2026-10");
    expect(cycleKeyForDate("2026-11-06", settings7)).toBe("2026-10");
    expect(cycleKeyForDate("2027-01-02", settings7)).toBe("2026-12");
  });

  it("respects a one-off change to the next payday", () => {
    const s: Settings = { ...settings7, paydayOverrides: { "2026-11": "2026-11-04" } };
    const oct = getCycle("2026-10", s);
    expect(oct.end).toBe("2026-11-03");
    expect(cycleKeyForDate("2026-11-05", s)).toBe("2026-11");
  });

  it("counts days left including today", () => {
    const c = getCycle("2026-10", settings7);
    expect(daysLeftInCycle(c, "2026-10-26")).toBe(12);
    expect(daysLeftInCycle(c, "2026-11-06")).toBe(1);
    expect(daysLeftInCycle(c, "2026-10-07")).toBe(31);
    expect(daysLeftInCycle(c, "2026-12-01")).toBe(0);
  });

  it("rejects a next payday in the past or too far away", () => {
    const c = getCycle("2026-10", settings7);
    expect(validateNextPayday("2026-10-20", c, "2026-10-26").ok).toBe(false);
    expect(validateNextPayday("2026-12-31", c, "2026-10-26").ok).toBe(false);
    expect(validateNextPayday("2026-11-10", c, "2026-10-26").ok).toBe(true);
  });

  it("never builds an inverted cycle from a bad override", () => {
    const s: Settings = { ...settings7, paydayOverrides: { "2026-11": "2026-10-01" } };
    const c = getCycle("2026-10", s);
    expect(c.length).toBeGreaterThanOrEqual(1);
    expect(c.end >= c.start).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("plans", () => {
  const cats = emptyData().categories;

  it("adds up the sample plan exactly as documented", () => {
    const t = planTotals(SAMPLE_PLAN, cats);
    expect(t.committed).toBe(R(12500));
    expect(t.flexible).toBe(R(2500));
    expect(t.savings).toBe(R(1000));
    expect(t.overBy).toBe(0);
  });

  it("reports how far a plan exceeds take-home pay", () => {
    const t = planTotals({ ...SAMPLE_PLAN, takeHome: R(11700) }, cats);
    expect(t.flexible).toBe(R(-800));
    expect(t.overBy).toBe(R(800));
  });

  it("carries a plan forward without one-off lines", () => {
    const plans = {
      "2026-09": { takeHome: R(15000), lines: [...SAMPLE_PLAN.lines, { id: "p", categoryId: "festivals", amount: R(3000), oneOff: true }] },
    };
    const r = resolvePlan(plans, "2026-11");
    expect(r.source).toBe("carried");
    expect(r.fromKey).toBe("2026-09");
    expect(r.plan.lines.some((l) => l.oneOff)).toBe(false);
    expect(resolvePlan(plans, "2026-08").source).toBe("none");
    expect(resolvePlan(plans, "2026-09").source).toBe("own");
  });

  it("gives running remainders after each section", () => {
    const rows = runningRemainders(SAMPLE_PLAN, cats);
    expect(rows.at(-1)?.leftAfter).toBe(R(2500));
    expect(rows[0]).toEqual({ group: "fixed", total: R(4000), leftAfter: R(11000) });
  });

  it("ignores plan lines in income or flexible categories", () => {
    const t = planTotals({ takeHome: R(1000), lines: [{ id: "a", categoryId: "eating-out", amount: R(500) }] }, cats);
    expect(t.committed).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("bills", () => {
  const monthly: Bill = { id: "b", name: "Rent", amount: R(4000), categoryId: "rent", recurrence: "monthly", dueDate: "2026-01-31", remindDaysBefore: 5 };

  it("clamps monthly bills to short months and keeps the anchor day", () => {
    expect(billDueDates(monthly, "2026-02-01", "2026-04-30")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("never produces due dates before the first one", () => {
    expect(billDueDates(monthly, "2025-01-01", "2026-01-30")).toEqual([]);
  });

  it("repeats every 28 days for prepaid recharges", () => {
    const r: Bill = { ...monthly, recurrence: "every-28-days", dueDate: "2026-10-01" };
    expect(billDueDates(r, "2026-10-01", "2026-12-31")).toEqual(["2026-10-01", "2026-10-29", "2026-11-26", "2026-12-24"]);
  });

  it("handles one-time, quarterly and yearly bills", () => {
    expect(billDueDates({ ...monthly, recurrence: "once", dueDate: "2026-10-10" }, "2026-10-01", "2026-10-31")).toEqual(["2026-10-10"]);
    expect(billDueDates({ ...monthly, recurrence: "quarterly", dueDate: "2026-01-15" }, "2026-01-01", "2026-12-31")).toHaveLength(4);
    expect(billDueDates({ ...monthly, recurrence: "yearly", dueDate: "2024-02-29" }, "2025-01-01", "2028-12-31")).toEqual([
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });

  it("labels status honestly", () => {
    expect(statusOf("2026-10-20", "2026-10-26", 5, false)).toBe("overdue");
    expect(statusOf("2026-10-26", "2026-10-26", 5, false)).toBe("due-soon");
    expect(statusOf("2026-10-31", "2026-10-26", 5, false)).toBe("due-soon");
    expect(statusOf("2026-11-01", "2026-10-26", 5, false)).toBe("upcoming");
    expect(statusOf("2026-10-20", "2026-10-26", 5, true)).toBe("paid");
  });

  it("is paid only through a linked transaction", () => {
    const pay = txn({ amount: R(4000), date: "2026-02-27", categoryId: "rent", billId: "b", billDueDate: "2026-02-28" });
    const occ = billOccurrences([monthly], [pay], "2026-02-01", "2026-03-31", "2026-03-05");
    expect(occ.map((o) => o.status)).toEqual(["paid", "upcoming"]);
  });
});

/* ------------------------------------------------------------------ */

describe("cycle summary and daily allowance", () => {
  const today = "2026-10-26"; // 12 days left in the October cycle (7 Oct – 6 Nov)

  it("uses the planned take-home as expected money until a salary is recorded", () => {
    const s = summarizeCycle(makeData(), "2026-10", today);
    expect(s.salaryExpected).toBe(true);
    expect(s.moneyIn).toBe(R(15000));
    expect(s.flexible).toBe(R(2500));
    expect(s.safeToSpend).toBe(R(2500));
    expect(s.daysLeft).toBe(12);
    expect(s.dailyAllowance).toBe(R(208)); // 2500 / 12 = 208.33, rounded down
    expect(s.state).toBe("comfortable");
  });

  it("does not count income as spending or a budget target as a transaction", () => {
    const data = makeData({
      transactions: [txn({ type: "income", amount: R(15000), date: "2026-10-07", categoryId: "salary" })],
    });
    const s = summarizeCycle(data, "2026-10", today);
    expect(s.spentTotal).toBe(0);
    expect(s.salaryExpected).toBe(false);
    expect(s.safeToSpend).toBe(R(2500));
  });

  it("uses the recorded salary when it differs from the plan, and adds extra income", () => {
    const data = makeData({
      transactions: [
        txn({ type: "income", amount: R(14000), date: "2026-10-07", categoryId: "salary" }),
        txn({ type: "income", amount: R(1200), date: "2026-10-12", categoryId: "other-income" }),
      ],
    });
    const s = summarizeCycle(data, "2026-10", today);
    expect(s.moneyIn).toBe(R(15200));
    expect(s.flexible).toBe(R(2700));
  });

  it("subtracts flexible spending and planned-category overruns, never underspends", () => {
    const data = makeData({
      transactions: [
        txn({ amount: R(600), date: "2026-10-10", categoryId: "eating-out" }),
        txn({ amount: R(3400), date: "2026-10-12", categoryId: "food" }), // ₹400 over the food plan
        txn({ amount: R(200), date: "2026-10-12", categoryId: "travel" }), // under plan: no bonus
      ],
    });
    const s = summarizeCycle(data, "2026-10", today);
    expect(s.spentFlexible).toBe(R(600));
    expect(s.overrunTotal).toBe(R(400));
    expect(s.safeToSpend).toBe(R(1500));
    expect(s.dailyAllowance).toBe(R(125));
  });

  it("does not subtract savings twice", () => {
    const data = makeData({ transactions: [txn({ amount: R(1000), date: "2026-10-08", categoryId: "savings" })] });
    const s = summarizeCycle(data, "2026-10", today);
    expect(s.savingsActual).toBe(R(1000));
    expect(s.safeToSpend).toBe(R(2500));
  });

  it("counts a paid bill once, through its transaction", () => {
    const rent: Bill = { id: "rent-bill", name: "Rent", amount: R(4000), categoryId: "rent", recurrence: "monthly", dueDate: "2026-10-10", remindDaysBefore: 5 };
    const unpaid = summarizeCycle(makeData({ bills: [rent] }), "2026-10", today);
    // ₹4,000 due against a ₹4,000 rent line: no overrun.
    expect(unpaid.safeToSpend).toBe(R(2500));
    expect(unpaid.billsDueTotal).toBe(R(4000));

    const paid = summarizeCycle(
      makeData({
        bills: [rent],
        transactions: [txn({ amount: R(4000), date: "2026-10-10", categoryId: "rent", billId: "rent-bill", billDueDate: "2026-10-10" })],
      }),
      "2026-10",
      today,
    );
    expect(paid.billsDueTotal).toBe(0);
    expect(paid.spentTotal).toBe(R(4000));
    expect(paid.safeToSpend).toBe(R(2500));
  });

  it("subtracts unplanned bills that are still due", () => {
    const recharge: Bill = { id: "r", name: "Recharge", amount: R(299), categoryId: "bills", recurrence: "once", dueDate: "2026-10-30", remindDaysBefore: 3 };
    const s = summarizeCycle(makeData({ bills: [recharge] }), "2026-10", today);
    expect(s.overrunTotal).toBe(R(299));
    expect(s.safeToSpend).toBe(R(2201));
  });

  it("carries an overdue bill from last cycle into this one", () => {
    const old: Bill = { id: "o", name: "Electricity", amount: R(500), categoryId: "other", recurrence: "once", dueDate: "2026-10-01", remindDaysBefore: 3 };
    const s = summarizeCycle(makeData({ bills: [old] }), "2026-10", today);
    expect(s.flexibleBillsDue).toBe(R(500));
    expect(s.bills[0]?.status).toBe("overdue");
  });

  it("shows ₹0 a day, not a negative or misleading number, when short", () => {
    const data = makeData({ transactions: [txn({ amount: R(3300), date: "2026-10-20", categoryId: "shopping" })] });
    const s = summarizeCycle(data, "2026-10", today);
    expect(s.safeToSpend).toBe(R(-800));
    expect(s.dailyAllowance).toBe(0);
    expect(s.state).toBe("short");
  });

  it("handles exactly zero left", () => {
    const data = makeData({ transactions: [txn({ amount: R(2500), date: "2026-10-20", categoryId: "shopping" })] });
    const s = summarizeCycle(data, "2026-10", today);
    expect(s.safeToSpend).toBe(0);
    expect(s.dailyAllowance).toBe(0);
    expect(s.state).toBe("zero");
  });

  it("flags a tight allowance relative to the plan's own daily share", () => {
    const data = makeData({ transactions: [txn({ amount: R(2100), date: "2026-10-20", categoryId: "shopping" })] });
    const s = summarizeCycle(data, "2026-10", today);
    expect(s.plannedDailyShare).toBe(Math.trunc(R(2500) / 31)); // ₹80.64
    expect(s.dailyAllowance).toBe(R(33)); // 400 / 12, below half the share
    expect(s.state).toBe("tight");
    const ok = summarizeCycle(makeData({ transactions: [txn({ amount: R(2000), date: "2026-10-20", categoryId: "shopping" })] }), "2026-10", today);
    expect(ok.dailyAllowance).toBe(R(41)); // just above half
    expect(ok.state).toBe("comfortable");
  });

  it("handles a plan that is over take-home pay", () => {
    const data = makeData({ plans: { "2026-10": { ...SAMPLE_PLAN, takeHome: R(12000) } } });
    const s = summarizeCycle(data, "2026-10", today);
    expect(s.flexible).toBe(R(-500));
    expect(s.dailyAllowance).toBe(0);
    expect(s.state).toBe("short");
  });

  it("reports no plan when nothing has been set up", () => {
    const s = summarizeCycle({ ...emptyData(), settings: settings7 }, "2026-10", today);
    expect(s.state).toBe("no-plan");
    expect(s.dailyAllowance).toBe(0);
    expect(Number.isNaN(s.safeToSpend)).toBe(false);
  });

  it("has no allowance for a past cycle and a planned share for a future one", () => {
    const past = summarizeCycle(makeData(), "2026-10", "2026-12-01");
    expect(past.timeframe).toBe("past");
    expect(past.dailyAllowance).toBe(0);
    const future = summarizeCycle(makeData(), "2026-10", "2026-10-01");
    expect(future.timeframe).toBe("future");
    expect(future.daysLeft).toBe(31);
  });

  it("guards division", () => {
    expect(safeDivide(R(100), 0)).toBe(0);
    expect(dailyAllowanceFor(R(100), 0)).toBe(0);
    expect(dailyAllowanceFor(R(-100), 5)).toBe(0);
  });
});

describe("day card", () => {
  it("draws one cell per day with only flexible spending", () => {
    const data = makeData({
      transactions: [
        txn({ amount: R(150), date: "2026-10-08", categoryId: "eating-out" }),
        txn({ amount: R(4000), date: "2026-10-08", categoryId: "rent" }),
      ],
    });
    const s = summarizeCycle(data, "2026-10", "2026-10-26");
    const cells = dayCells(s, "2026-10-26", data.categories);
    expect(cells).toHaveLength(31);
    const d8 = cells.find((c) => c.date === "2026-10-08")!;
    expect(d8.spent).toBe(R(150));
    expect(d8.state).toBe("over"); // share is 2500/31 ≈ ₹80
    expect(cells.find((c) => c.date === "2026-10-26")?.state).toBe("today");
    expect(cells.find((c) => c.date === "2026-10-09")?.state).toBe("empty");
    expect(cells.at(-1)?.state).toBe("ahead");
  });
});

describe("spending breakdown", () => {
  it("shows each category's share of total spending", () => {
    const data = makeData({
      transactions: [
        txn({ amount: R(750), date: "2026-10-08", categoryId: "food" }),
        txn({ amount: R(250), date: "2026-10-08", categoryId: "eating-out" }),
      ],
    });
    const rows = spendingBreakdown(summarizeCycle(data, "2026-10", "2026-10-26"));
    expect(rows.find((r) => r.id === "food")?.percent).toBe(75);
    expect(rows.find((r) => r.id === "eating-out")?.percent).toBe(25);
    expect(rows.find((r) => r.id === "rent")?.percent).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("scenarios", () => {
  const cats = emptyData().categories;

  it("shows no change for an empty scenario", () => {
    const r = compareScenario(SAMPLE_PLAN, EMPTY_SCENARIO, cats, 31);
    expect(r.changed).toBe(false);
    expect(r.difference.flexible).toBe(0);
  });

  it("models a raise, a rent rise, extra savings and an EMI paid off", () => {
    const r = compareScenario(
      SAMPLE_PLAN,
      { salaryChange: R(2000), lineAmounts: { "s-line-rent": R(5000), "s-line-emi": 0 }, extraSavings: R(500), purchase: 0 },
      cats,
      31,
    );
    // +2000 salary, +1000 rent, −1000 EMI, +500 savings → flexible +1500
    expect(r.adjusted.flexible).toBe(R(4000));
    expect(r.difference.flexible).toBe(R(1500));
    expect(r.difference.savings).toBe(R(500));
    expect(r.changed).toBe(true);
  });

  it("answers whether a purchase fits", () => {
    const fits = compareScenario(SAMPLE_PLAN, { ...EMPTY_SCENARIO, purchase: R(2000) }, cats, 30);
    expect(fits.canAffordPurchase).toBe(true);
    expect(fits.afterPurchase).toBe(R(500));
    const tooMuch = compareScenario(SAMPLE_PLAN, { ...EMPTY_SCENARIO, purchase: R(3000) }, cats, 30);
    expect(tooMuch.canAffordPurchase).toBe(false);
    expect(tooMuch.purchaseShortBy).toBe(R(500));
    expect(tooMuch.afterPurchaseDailyShare).toBe(0);
  });

  it("never takes take-home below zero", () => {
    const r = compareScenario(SAMPLE_PLAN, { ...EMPTY_SCENARIO, salaryChange: R(-50000) }, cats, 30);
    expect(r.adjusted.takeHome).toBe(0);
    expect(r.adjusted.dailyShare).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("stored data", () => {
  it("drops malformed records and keeps the rest", () => {
    const good = txn({ amount: R(100), date: "2026-10-08", categoryId: "food" });
    const { data, report } = sanitize({
      settings: { nope: true },
      categories: [{ id: "food", name: "Food", group: "variable" }, { id: 3 }],
      plans: { "2026-10": SAMPLE_PLAN, banana: {} },
      transactions: [good, { ...good, id: "bad", amount: -5 }, { ...good, id: "bad2", date: "2026-02-30" }],
      bills: "not an array",
    });
    expect(data.transactions).toHaveLength(1);
    expect(data.categories.some((c) => c.id === "salary")).toBe(true);
    expect(data.settings.schedule.kind).toBe("day-of-month");
    expect(Object.keys(data.plans)).toEqual(["2026-10"]);
    expect(report.dropped).toBeGreaterThanOrEqual(5);
  });

  it("survives null and garbage", () => {
    expect(sanitize(null).data.transactions).toEqual([]);
    expect(sanitize("hello").data.version).toBe(1);
  });
});

describe("sample data", () => {
  it("is deterministic for a given day", () => {
    expect(sampleData("2026-10-26")).toEqual(sampleData("2026-10-26"));
  });

  it("passes its own validation and has no transactions after today", () => {
    const data = sampleData("2026-10-26");
    expect(sanitize(data).report.dropped).toBe(0);
    expect(data.transactions.every((t) => t.date < "2026-10-26")).toBe(true);
    expect(data.isSample).toBe(true);
  });

  it("produces sensible numbers on any day of the cycle", () => {
    for (let i = 0; i < 70; i++) {
      const day = addDays("2026-09-01", i);
      const data = sampleData(day);
      const key = cycleKeyForDate(day, data.settings);
      const s = summarizeCycle(data, key, day);
      expect(Number.isFinite(s.safeToSpend)).toBe(true);
      expect(s.dailyAllowance).toBeGreaterThanOrEqual(0);
      expect(s.state).not.toBe("no-plan");
      expect(shiftCycleKey(key, 1) > key).toBe(true);
    }
  });
});

describe("starting partway through a cycle", () => {
  const sp = { cycleKey: "2026-10", date: "2026-10-30", amount: R(4000) };

  it("runs the first cycle on what has to last, not the full salary", () => {
    const data = makeData({ plans: { "2026-10": { takeHome: R(18000), lines: [] } }, startingPoint: sp });
    const s = summarizeCycle(data, "2026-10", "2026-10-30");
    expect(s.resolved.source).toBe("starting");
    expect(s.moneyIn).toBe(R(4000));
    expect(s.committed).toBe(0);
    expect(s.daysLeft).toBe(8); // 30 Oct – 6 Nov
    expect(s.dailyAllowance).toBe(R(500));
  });

  it("ignores transactions and bills from before the starting day", () => {
    const rent: Bill = { id: "rb", name: "Rent", amount: R(4000), categoryId: "rent", recurrence: "monthly", dueDate: "2026-10-10", remindDaysBefore: 5 };
    const data = makeData({
      startingPoint: sp,
      bills: [rent],
      transactions: [
        txn({ amount: R(900), date: "2026-10-20", categoryId: "shopping" }),
        txn({ amount: R(400), date: "2026-10-31", categoryId: "food" }),
      ],
    });
    const s = summarizeCycle(data, "2026-10", "2026-11-01");
    expect(s.bills).toHaveLength(0); // the 10 Oct rent predates tracking
    expect(s.safeToSpend).toBe(R(3600)); // only the ₹400 on 31 Oct counts
    expect(s.dailyAllowance).toBe(R(600)); // 3600 / 6 days
    const cells = dayCells(s, "2026-11-01", data.categories);
    expect(cells.find((c) => c.date === "2026-10-20")?.state).toBe("untracked");
  });

  it("subtracts bills still due after the starting day", () => {
    const due: Bill = { id: "e", name: "EMI", amount: R(1000), categoryId: "emi", recurrence: "once", dueDate: "2026-11-02", remindDaysBefore: 3 };
    const s = summarizeCycle(makeData({ startingPoint: sp, bills: [due] }), "2026-10", "2026-10-30");
    expect(s.safeToSpend).toBe(R(3000));
  });

  it("shows zero, not 'no plan', when nothing has to last", () => {
    const s = summarizeCycle(makeData({ plans: {}, startingPoint: { ...sp, amount: 0 } }), "2026-10", "2026-10-30");
    expect(s.state).toBe("zero");
  });

  it("only affects its own cycle and survives validation", () => {
    const data = makeData({ startingPoint: sp });
    expect(summarizeCycle(data, "2026-11", "2026-11-10").resolved.source).not.toBe("starting");
    expect(sanitize(data).data.startingPoint).toEqual(sp);
    expect(sanitize({ ...data, startingPoint: { cycleKey: "nope", date: "x", amount: -1 } }).data.startingPoint).toBeUndefined();
  });
});
