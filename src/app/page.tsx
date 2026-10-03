"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useComposer } from "@/components/AppShell";
import { BillList } from "@/components/BillList";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { CycleFigures } from "@/components/CycleFigures";
import { DailyAllowancePanel } from "@/components/DailyAllowancePanel";
import { MonthSelector } from "@/components/MonthSelector";
import { PageHeader } from "@/components/PageHeader";
import { QuickSetup } from "@/components/QuickSetup";
import { TransactionList } from "@/components/TransactionList";
import { EmptyState, SectionHeading } from "@/components/ui/primitives";
import { sortForAttention } from "@/lib/calc/bills";
import { cycleName } from "@/lib/calc/cycle";
import { spendingBreakdown, summarizeCycle } from "@/lib/calc/summary";
import { billsDueSentence } from "@/lib/copy";
import { formatINR } from "@/lib/money";
import { useStore } from "@/state/store";

export default function OverviewPage() {
  const { data, today, viewKey } = useStore();
  const { addTransaction } = useComposer();
  const summary = useMemo(() => summarizeCycle(data, viewKey, today), [data, viewKey, today]);
  const breakdown = useMemo(() => spendingBreakdown(summary), [summary]);

  const unpaid = summary.bills.filter((o) => o.status !== "paid");
  const nextBills = sortForAttention(unpaid).slice(0, 5);
  const overdue = unpaid.filter((o) => o.status === "overdue");
  const dueThisWeek = unpaid.filter((o) => o.daysUntil >= 0 && o.daysUntil <= 7);
  const paidCount = summary.bills.length - unpaid.length;

  const recent = useMemo(
    () =>
      [...summary.transactions]
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
        .slice(0, 7),
    [summary.transactions],
  );

  const name = data.settings.name.trim();
  const noPlan = summary.state === "no-plan";
  // Before any plan exists, the payday is unknown: don't show cycle dates built on a default.
  const notSetUp = Object.keys(data.plans).length === 0 && !data.startingPoint;
  const planHasNoLines = summary.resolved.plan.lines.length === 0 && !noPlan && summary.resolved.source !== "starting";

  return (
    <>
      <PageHeader
        title="Your money, in view."
        description={
          <>
            {name ? `Hi ${name}. ` : ""}
            {notSetUp
              ? "Start with your salary."
              : summary.timeframe === "current"
              ? `Here's your ${cycleName(viewKey)} so far.`
              : summary.timeframe === "past"
                ? `Looking back at the ${cycleName(viewKey, true)}.`
                : `Looking ahead to the ${cycleName(viewKey, true)}.`}{" "}
            <Link href="/plan" className="link">
              Edit monthly plan
            </Link>
          </>
        }
        actions={
          <>
            {!notSetUp && <MonthSelector />}
            <button type="button" className="btn btn-primary hidden lg:inline-flex" onClick={() => addTransaction()}>
              <Plus size={18} aria-hidden />
              Add transaction
            </button>
          </>
        }
      />

      <DailyAllowancePanel summary={summary} />
      {noPlan && summary.timeframe !== "past" && <QuickSetup />}
      {planHasNoLines && (
        <p className="mt-4 text-sm text-ink-700">
          Your plan only has take-home pay so far, so the whole amount counts as flexible.{" "}
          <Link href="/plan" className="link">
            Add rent, family support and other commitments
          </Link>{" "}
          for a truer allowance.
        </p>
      )}

      {!noPlan && <CycleFigures summary={summary} />}

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <section aria-labelledby="bills-heading">
            <SectionHeading
              id="bills-heading"
              title="Bills before payday"
              summary={
                summary.timeframe === "past"
                  ? `${paidCount} of ${summary.bills.length} bills in this cycle were paid.`
                  : [
                      overdue.length > 0
                        ? `${overdue.length === 1 ? "1 bill is" : `${overdue.length} bills are`} overdue.`
                        : dueThisWeek.length > 0
                          ? `${formatINR(dueThisWeek.reduce((s, o) => s + o.bill.amount, 0))} due in the next seven days.`
                          : unpaid.length > 0
                            ? "Nothing due in the next seven days."
                            : "",
                      // Only add the cycle total when it says something the first sentence didn't.
                      dueThisWeek.length === unpaid.length && overdue.length === 0 && unpaid.length > 0
                        ? ""
                        : billsDueSentence(summary.billsDueTotal, unpaid.length),
                    ]
                      .filter(Boolean)
                      .join(" ")
              }
              actions={
                <Link href="/bills" className="link text-sm">
                  All bills
                </Link>
              }
            />
            {summary.timeframe === "past" ? (
              <p className="border-y border-paper-300 py-4 text-sm text-ink-600">
                This cycle has closed. Unpaid bills from it carry into the current cycle.
              </p>
            ) : nextBills.length > 0 ? (
              <BillList occurrences={nextBills} compact />
            ) : data.bills.length === 0 ? (
              <EmptyState
                title="No bills yet"
                body="Add rent, EMIs, recharges and anything else that repeats, and they'll show here before they're due."
                action={
                  <Link href="/bills" className="btn btn-secondary btn-sm">
                    Add a bill
                  </Link>
                }
              />
            ) : (
              <p className="border-y border-paper-300 py-4 text-sm text-ink-600">
                Every bill in this cycle is paid{paidCount > 0 ? ` (${paidCount})` : ""}.
              </p>
            )}
          </section>

          <section aria-labelledby="activity-heading">
            <SectionHeading
              id="activity-heading"
              title="Recent activity"
              summary={
                summary.transactions.length > 0
                  ? `${summary.transactions.length} transactions in this cycle.`
                  : undefined
              }
              actions={
                <>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addTransaction()}>
                    <Plus size={15} aria-hidden />
                    Add
                  </button>
                  <Link href="/transactions" className="link text-sm">
                    All transactions
                  </Link>
                </>
              }
            />
            {recent.length > 0 ? (
              <TransactionList transactions={recent} />
            ) : (
              <EmptyState
                title="Nothing recorded in this cycle"
                body="Add what you spend as you go. Each entry updates your daily allowance straight away."
                action={
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => addTransaction()}>
                    Add a transaction
                  </button>
                }
              />
            )}
          </section>
        </div>

        <section aria-labelledby="spending-heading">
          <SectionHeading
            id="spending-heading"
            title="Where it went"
            summary="Each bar is spending against its plan. The percentage is its share of everything spent this cycle."
          />
          <CategoryBreakdown rows={breakdown} total={summary.spentTotal} flexible={summary.flexible} />
          {summary.savingsPlanned > 0 && (
            <p className="mt-5 border-t border-paper-300 pt-3 text-sm text-ink-700">
              Savings: <span className="tnum font-semibold">{formatINR(summary.savingsActual)}</span> put aside of{" "}
              <span className="tnum">{formatINR(summary.savingsPlanned)}</span> planned.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
