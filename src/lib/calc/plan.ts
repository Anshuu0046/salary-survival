import { sum } from "../money";
import { PLANNED_GROUPS } from "../types";
import type { Category, CategoryGroup, CycleKey, Paise, Plan, PlannedGroup } from "../types";
import { compareCycleKeys } from "./cycle";

/**
 * Monthly plans.
 *
 * A plan belongs to a cycle. A cycle without its own plan uses the most recent
 * earlier plan, minus any one-off lines, so a plan carries forward until the
 * person changes it. Cycles before the first plan have no plan at all.
 */

export const EMPTY_PLAN: Plan = { takeHome: 0, lines: [] };

export type PlanSource = "own" | "carried" | "none" | "starting";

export interface ResolvedPlan {
  plan: Plan;
  source: PlanSource;
  /** The cycle the plan was copied from when it was carried forward. */
  fromKey?: CycleKey;
}

export function resolvePlan(plans: Record<CycleKey, Plan>, key: CycleKey): ResolvedPlan {
  const own = plans[key];
  if (own) return { plan: own, source: "own" };
  const earlier = Object.keys(plans)
    .filter((k) => compareCycleKeys(k, key) < 0)
    .sort(compareCycleKeys)
    .pop();
  if (!earlier) return { plan: EMPTY_PLAN, source: "none" };
  const base = plans[earlier]!;
  return {
    plan: { takeHome: base.takeHome, lines: base.lines.filter((l) => !l.oneOff) },
    source: "carried",
    fromKey: earlier,
  };
}

export type GroupTotals = Record<PlannedGroup, Paise>;

export interface PlanTotals {
  takeHome: Paise;
  byGroup: GroupTotals;
  /** Everything the plan sets aside before flexible spending, savings included. */
  committed: Paise;
  /** take-home − committed. Negative when the plan asks for more than the salary. */
  flexible: Paise;
  /** How far the plan exceeds take-home pay (0 when it fits). */
  overBy: Paise;
  savings: Paise;
}

export function groupOf(categoryId: string, categories: Category[]): CategoryGroup | undefined {
  return categories.find((c) => c.id === categoryId)?.group;
}

export function isPlannedGroup(group: CategoryGroup | undefined): group is PlannedGroup {
  return group !== undefined && (PLANNED_GROUPS as readonly string[]).includes(group);
}

export function planTotals(plan: Plan, categories: Category[]): PlanTotals {
  const byGroup: GroupTotals = { fixed: 0, obligations: 0, variable: 0, savings: 0, setAside: 0 };
  for (const line of plan.lines) {
    const group = groupOf(line.categoryId, categories);
    if (isPlannedGroup(group)) byGroup[group] += Math.max(0, line.amount);
  }
  const committed = sum(Object.values(byGroup));
  const flexible = plan.takeHome - committed;
  return {
    takeHome: plan.takeHome,
    byGroup,
    committed,
    flexible,
    overBy: Math.max(0, -flexible),
    savings: byGroup.savings,
  };
}

/** Planned amount per category (several lines can share a category). */
export function plannedByCategory(plan: Plan, categories: Category[]): Map<string, Paise> {
  const out = new Map<string, Paise>();
  for (const line of plan.lines) {
    if (!isPlannedGroup(groupOf(line.categoryId, categories))) continue;
    out.set(line.categoryId, (out.get(line.categoryId) ?? 0) + Math.max(0, line.amount));
  }
  return out;
}

/** "Left after this section" running totals for the plan editor, in group order. */
export function runningRemainders(plan: Plan, categories: Category[], order: readonly PlannedGroup[] = PLANNED_GROUPS) {
  const totals = planTotals(plan, categories);
  let left = plan.takeHome;
  return order.map((group) => {
    left -= totals.byGroup[group];
    return { group, total: totals.byGroup[group], leftAfter: left };
  });
}
