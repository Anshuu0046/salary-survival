/**
 * SalarySurvival data model.
 *
 * Money is always stored as integer paise (₹1 = 100 paise) so that sums never
 * pick up floating-point drift. Dates are local calendar dates as ISO strings
 * (YYYY-MM-DD) with no time or timezone attached.
 */

export type ISODate = string;
export type Paise = number;

/** A pay cycle is identified by the month its salary arrives in: "2026-10". */
export type CycleKey = string;

/**
 * Where a category sits in the monthly plan.
 * - fixed:       essential costs that barely change (rent, bills & recharges)
 * - obligations: money owed to people or lenders (family support, EMIs)
 * - variable:    everyday essentials with a target (food, travel)
 * - savings:     money kept aside for the future
 * - setAside:    sinking funds for irregular costs (festivals, medical)
 * - flexible:    no plan amount; spending comes out of the flexible money
 * - income:      salary and any extra income
 */
export type CategoryGroup =
  | "fixed"
  | "obligations"
  | "variable"
  | "savings"
  | "setAside"
  | "flexible"
  | "income";

export const PLANNED_GROUPS = ["fixed", "obligations", "variable", "savings", "setAside"] as const;
export type PlannedGroup = (typeof PLANNED_GROUPS)[number];

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  /** Archived categories keep their history but are hidden from pickers. */
  archived?: boolean;
  /** System categories (e.g. Salary) cannot be deleted or moved to another group. */
  system?: boolean;
}

export interface PlanLine {
  id: string;
  categoryId: string;
  amount: Paise;
  /** One-off lines (e.g. a planned purchase) are not carried into later cycles. */
  oneOff?: boolean;
  label?: string;
}

export interface Plan {
  takeHome: Paise;
  /** Display order is the array order. */
  lines: PlanLine[];
}

export type PaySchedule =
  | { kind: "day-of-month"; day: number }
  | { kind: "last-working-day" };

export type WeekendRule = "as-is" | "previous-working-day" | "next-working-day";

export interface Settings {
  name: string;
  schedule: PaySchedule;
  weekendRule: WeekendRule;
  /** One-off payday changes, keyed by the cycle whose start they move. */
  paydayOverrides: Record<CycleKey, ISODate>;
}

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: Paise;
  date: ISODate;
  description: string;
  categoryId: string;
  note?: string;
  /** Set when this transaction is the payment of a bill occurrence. */
  billId?: string;
  billDueDate?: ISODate;
  createdAt: number;
}

export type Recurrence = "monthly" | "every-28-days" | "quarterly" | "yearly" | "once";

export interface Bill {
  id: string;
  name: string;
  amount: Paise;
  categoryId: string;
  recurrence: Recurrence;
  /** The first due date. Recurring bills repeat from here. */
  dueDate: ISODate;
  /** How many days before the due date the in-app "due soon" flag appears. */
  remindDaysBefore: number;
  note?: string;
}

/**
 * Set when someone starts partway through a pay cycle. That first cycle runs on
 * the money they said had to last until payday, counted from the day they started.
 */
export interface StartingPoint {
  cycleKey: CycleKey;
  date: ISODate;
  amount: Paise;
}

export interface AppData {
  version: 1;
  /** True while the demo profile is loaded. */
  isSample: boolean;
  settings: Settings;
  categories: Category[];
  plans: Record<CycleKey, Plan>;
  transactions: Transaction[];
  bills: Bill[];
  startingPoint?: StartingPoint;
  updatedAt: number;
}
