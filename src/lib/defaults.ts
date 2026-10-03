import type { AppData, Category, CategoryGroup, PlannedGroup, Settings } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "salary", name: "Salary", group: "income", system: true },
  { id: "other-income", name: "Other income", group: "income", system: true },
  { id: "rent", name: "Rent", group: "fixed" },
  { id: "bills", name: "Bills & recharges", group: "fixed" },
  { id: "family", name: "Family support", group: "obligations" },
  { id: "emi", name: "EMI & loans", group: "obligations" },
  { id: "food", name: "Food & groceries", group: "variable" },
  { id: "travel", name: "Travel", group: "variable" },
  { id: "savings", name: "Savings", group: "savings" },
  { id: "festivals", name: "Festivals & gifts", group: "setAside" },
  { id: "medical", name: "Medical", group: "setAside" },
  { id: "eating-out", name: "Eating out", group: "flexible" },
  { id: "shopping", name: "Shopping", group: "flexible" },
  { id: "fun", name: "Entertainment", group: "flexible" },
  { id: "other", name: "Other", group: "flexible" },
];

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  fixed: "Fixed costs",
  obligations: "Family & EMIs",
  variable: "Everyday spending",
  savings: "Savings",
  setAside: "Set aside for irregular costs",
  flexible: "Flexible spending",
  income: "Income",
};

export const GROUP_HINTS: Record<PlannedGroup, string> = {
  fixed: "Rent, electricity, phone and internet. Costs that barely change month to month.",
  obligations: "Money you send home and loan or EMI payments.",
  variable: "Essentials that move around: food, groceries, commuting.",
  savings: "What you keep for later. Counted once, as committed money.",
  setAside: "A little each month for costs that come once in a while: festivals, medical, repairs.",
};

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  schedule: { kind: "day-of-month", day: 1 },
  weekendRule: "previous-working-day",
  paydayOverrides: {},
};

export function emptyData(): AppData {
  return {
    version: 1,
    isSample: false,
    settings: { ...DEFAULT_SETTINGS, paydayOverrides: {} },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    plans: {},
    transactions: [],
    bills: [],
    updatedAt: Date.now(),
  };
}

export function newId(prefix = "id"): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}
