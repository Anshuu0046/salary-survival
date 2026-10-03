"use client";

import { Plus, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useComposer } from "@/components/AppShell";
import { MonthSelector } from "@/components/MonthSelector";
import { PageHeader } from "@/components/PageHeader";
import { TransactionList } from "@/components/TransactionList";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState } from "@/components/ui/primitives";
import { cycleName, getCycle } from "@/lib/calc/cycle";
import { transactionsInRange } from "@/lib/calc/summary";
import { formatShort } from "@/lib/dates";
import { GROUP_LABELS } from "@/lib/defaults";
import { formatINR, MINUS, sum } from "@/lib/money";
import type { CategoryGroup, Transaction } from "@/lib/types";
import { useStore } from "@/state/store";

const PAGE = 50;

type TypeFilter = "all" | "income" | "expense";
type BillFilter = "all" | "bill" | "other";

export default function TransactionsPage() {
  const { data, viewKey, actions } = useStore();
  const { addTransaction, editTransaction } = useComposer();
  const { confirm, toast } = useFeedback();
  const uid = useId();

  const [scope, setScope] = useState<"cycle" | "all">("cycle");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [bill, setBill] = useState<BillFilter>("all");
  const [limit, setLimit] = useState(PAGE);

  const cycle = getCycle(viewKey, data.settings);
  const inScope = useMemo(
    () => (scope === "cycle" ? transactionsInRange(data.transactions, cycle.start, cycle.end) : data.transactions),
    [scope, data.transactions, cycle.start, cycle.end],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inScope
      .filter((t) => (q ? t.description.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q) : true))
      .filter((t) => category === "all" || t.categoryId === category)
      .filter((t) => type === "all" || t.type === type)
      .filter((t) => bill === "all" || (bill === "bill" ? Boolean(t.billId) : !t.billId))
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  }, [inScope, query, category, type, bill]);

  const moneyIn = sum(filtered.filter((t) => t.type === "income").map((t) => t.amount));
  const moneyOut = sum(filtered.filter((t) => t.type === "expense").map((t) => t.amount));
  const filtersActive = query.trim() !== "" || category !== "all" || type !== "all" || bill !== "all";

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setType("all");
    setBill("all");
  };

  const onDelete = async (t: Transaction) => {
    const ok = await confirm({
      title: "Delete this transaction?",
      body: (
        <>
          <span className="font-semibold">{t.description}</span>, {formatShort(t.date)},{" "}
          <span className="tnum">{formatINR(t.amount)}</span>.{" "}
          {t.billId ? "It's the payment for a bill, so that bill will show as unpaid again." : "Your totals and allowance update straight away."}
        </>
      ),
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    actions.deleteTransaction(t.id);
    toast(`Deleted ${t.description}.`, { label: "Undo", onClick: () => actions.addTransaction(stripId(t)) });
  };

  const groupedCategories = useMemo(() => {
    const order: CategoryGroup[] = ["income", "fixed", "obligations", "variable", "savings", "setAside", "flexible"];
    return order
      .map((g) => ({ g, items: data.categories.filter((c) => c.group === g) }))
      .filter((x) => x.items.length > 0);
  }, [data.categories]);

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Everything that came in or went out. Changes here update your allowance and spending breakdown straight away."
        actions={
          <>
            {scope === "cycle" && <MonthSelector />}
            <button type="button" className="btn btn-primary hidden lg:inline-flex" onClick={() => addTransaction()}>
              <Plus size={18} aria-hidden />
              Add transaction
            </button>
          </>
        }
      />

      {/* Totals for what's shown */}
      <dl className="grid grid-cols-3 divide-x divide-paper-300 border-y border-paper-400">
        <div className="py-3 pr-3">
          <dt className="label">Money in</dt>
          <dd className="tnum text-xl font-semibold text-forest-700 sm:text-2xl">{formatINR(moneyIn)}</dd>
        </div>
        <div className="px-3 py-3 sm:px-5">
          <dt className="label">Money out</dt>
          <dd className="tnum text-xl font-semibold sm:text-2xl">{formatINR(moneyOut)}</dd>
        </div>
        <div className="px-3 py-3 sm:px-5">
          <dt className="label">Difference</dt>
          <dd className={`tnum text-xl font-semibold sm:text-2xl ${moneyIn - moneyOut < 0 ? "text-red-800" : ""}`}>
            {formatINR(moneyIn - moneyOut, { signed: true })}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-600">
        {scope === "cycle" ? `${cycleName(viewKey)}, ${formatShort(cycle.start)} – ${formatShort(cycle.end)}` : "All time"}
        {filtersActive ? ", filtered" : ""}. Savings transfers count as money out.
      </p>

      {/* Filters */}
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]"
      >
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-1">
          <label htmlFor={`${uid}-q`} className="sr-only">
            Search by description
          </label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600" aria-hidden />
          <input
            id={`${uid}-q`}
            type="search"
            className="field pl-9"
            placeholder="Search descriptions and notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <FilterSelect id={`${uid}-scope`} label="Period" value={scope} onChange={(v) => setScope(v as "cycle" | "all")}>
          <option value="cycle">One cycle</option>
          <option value="all">All time</option>
        </FilterSelect>
        <FilterSelect id={`${uid}-type`} label="Type" value={type} onChange={(v) => setType(v as TypeFilter)}>
          <option value="all">In and out</option>
          <option value="expense">Money out</option>
          <option value="income">Money in</option>
        </FilterSelect>
        <FilterSelect id={`${uid}-cat`} label="Category" value={category} onChange={setCategory}>
          <option value="all">All categories</option>
          {groupedCategories.map(({ g, items }) => (
            <optgroup key={g} label={GROUP_LABELS[g]}>
              {items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.archived ? " (archived)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </FilterSelect>
        <FilterSelect id={`${uid}-bill`} label="Bill payments" value={bill} onChange={(v) => setBill(v as BillFilter)}>
          <option value="all">Bills and others</option>
          <option value="bill">Bill payments only</option>
          <option value="other">Not bill payments</option>
        </FilterSelect>
      </form>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm text-ink-600">
          <p aria-live="polite">
            {filtered.length === 1 ? "1 transaction" : `${filtered.length} transactions`}
          </p>
          {filtersActive && (
            <button type="button" className="link text-sm" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        {filtered.length > 0 ? (
          <>
            <TransactionList transactions={filtered.slice(0, limit)} onEdit={editTransaction} onDelete={onDelete} showNotes />
            {filtered.length > limit && (
              <div className="mt-4 flex justify-center">
                <button type="button" className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </button>
              </div>
            )}
          </>
        ) : data.transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            body="Record your salary when it arrives and what you spend as you go. Bills you mark paid show up here too."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => addTransaction()}>
                Add your first transaction
              </button>
            }
          />
        ) : filtersActive ? (
          <EmptyState
            title="Nothing matches these filters"
            body="Try a different search or category, or clear the filters."
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            title={`Nothing recorded in the ${cycleName(viewKey)}`}
            body="Switch cycles with the arrows above, or choose All time."
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTransaction()}>
                Add a transaction
              </button>
            }
          />
        )}
        {filtered.length > 0 && (
          <p className="mt-3 text-xs text-ink-600">
            <span className="tnum">+</span> marks money in and <span className="tnum">{MINUS}</span> money out.
          </p>
        )}
      </div>
    </>
  );
}

function stripId(t: Transaction) {
  const { id: _id, createdAt: _c, ...rest } = t;
  return rest;
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange(v: string): void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} title={label}>
        {children}
      </select>
    </div>
  );
}
