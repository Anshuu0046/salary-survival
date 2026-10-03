import type { Category, Paise, Plan, PlanLine } from "../types";
import { planTotals } from "./plan";
import { safeDivide } from "./summary";

/**
 * Scenarios compare the plan as it is with an adjusted copy. Nothing here
 * touches stored data; applying a scenario is a separate, explicit step.
 *
 * Comparisons are plan-to-plan (no transactions), so the "daily share" here is
 * the flexible money spread over a whole cycle, not today's live allowance.
 */

export interface ScenarioInput {
  /** Change to monthly take-home pay (can be negative). */
  salaryChange: Paise;
  /** New amounts for existing plan lines, keyed by line id. 0 removes the cost (e.g. an EMI paid off). */
  lineAmounts: Record<string, Paise>;
  /** Extra amount added to savings each month (can be negative). */
  extraSavings: Paise;
  /** A one-off purchase planned for the next cycle. */
  purchase: Paise;
}

export const EMPTY_SCENARIO: ScenarioInput = { salaryChange: 0, lineAmounts: {}, extraSavings: 0, purchase: 0 };

export interface PlanSnapshot {
  takeHome: Paise;
  committed: Paise;
  savings: Paise;
  flexible: Paise;
  dailyShare: Paise;
}

export interface ScenarioResult {
  current: PlanSnapshot;
  adjusted: PlanSnapshot;
  difference: PlanSnapshot;
  /** Flexible money left in the adjusted plan after the planned purchase. */
  afterPurchase: Paise;
  afterPurchaseDailyShare: Paise;
  canAffordPurchase: boolean;
  /** How much more flexible money the purchase needs (0 when affordable). */
  purchaseShortBy: Paise;
  changed: boolean;
}

export function snapshot(plan: Plan, categories: Category[], cycleLength: number): PlanSnapshot {
  const t = planTotals(plan, categories);
  return {
    takeHome: t.takeHome,
    committed: t.committed,
    savings: t.savings,
    flexible: t.flexible,
    dailyShare: Math.max(0, safeDivide(t.flexible, cycleLength)),
  };
}

/** Builds the adjusted plan. Extra savings go to the first savings line, or a new one. */
export function adjustPlan(
  plan: Plan,
  input: ScenarioInput,
  categories: Category[],
  newId: () => string = () => `scenario-${Math.random().toString(36).slice(2, 9)}`,
): Plan {
  const savingsIds = new Set(categories.filter((c) => c.group === "savings").map((c) => c.id));
  const lines: PlanLine[] = plan.lines.map((l) =>
    l.id in input.lineAmounts ? { ...l, amount: Math.max(0, input.lineAmounts[l.id] ?? l.amount) } : { ...l },
  );
  if (input.extraSavings !== 0) {
    const target = lines.find((l) => savingsIds.has(l.categoryId));
    if (target) target.amount = Math.max(0, target.amount + input.extraSavings);
    else {
      const savingsCat = categories.find((c) => c.group === "savings" && !c.archived);
      if (savingsCat && input.extraSavings > 0) {
        lines.push({ id: newId(), categoryId: savingsCat.id, amount: input.extraSavings });
      }
    }
  }
  return { takeHome: Math.max(0, plan.takeHome + input.salaryChange), lines };
}

export function compareScenario(
  plan: Plan,
  input: ScenarioInput,
  categories: Category[],
  cycleLength: number,
): ScenarioResult {
  const current = snapshot(plan, categories, cycleLength);
  const adjusted = snapshot(adjustPlan(plan, input, categories, () => "preview"), categories, cycleLength);
  const purchase = Math.max(0, input.purchase);
  const afterPurchase = adjusted.flexible - purchase;
  const difference: PlanSnapshot = {
    takeHome: adjusted.takeHome - current.takeHome,
    committed: adjusted.committed - current.committed,
    savings: adjusted.savings - current.savings,
    flexible: adjusted.flexible - current.flexible,
    dailyShare: adjusted.dailyShare - current.dailyShare,
  };
  return {
    current,
    adjusted,
    difference,
    afterPurchase,
    afterPurchaseDailyShare: Math.max(0, safeDivide(afterPurchase, cycleLength)),
    canAffordPurchase: purchase === 0 || afterPurchase >= 0,
    purchaseShortBy: Math.max(0, -afterPurchase),
    changed:
      input.salaryChange !== 0 ||
      input.extraSavings !== 0 ||
      purchase !== 0 ||
      Object.entries(input.lineAmounts).some(([id, amt]) => plan.lines.find((l) => l.id === id)?.amount !== amt),
  };
}
