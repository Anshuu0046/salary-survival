"use client";

import { useState } from "react";
import type { BreakdownRow } from "@/lib/calc/summary";
import { formatINR } from "@/lib/money";

/**
 * Where the money went: one row per category, bar length relative to the
 * biggest category, with amount and share of all spending this cycle.
 */
export function CategoryBreakdown({ rows, total, flexible }: { rows: BreakdownRow[]; total: number; flexible: number }) {
  const [showAll, setShowAll] = useState(false);
  const spent = rows.filter((r) => r.spent > 0);
  const notYet = rows.filter((r) => r.spent === 0);
  const visible = showAll ? spent : spent.slice(0, 7);

  if (spent.length === 0) {
    return <p className="border-y border-paper-300 py-4 text-sm text-ink-600">No spending recorded in this cycle yet.</p>;
  }

  return (
    <div>
      <table className="w-full border-y border-paper-300 text-[0.9375rem]">
        <caption className="sr-only">Spending by category, with share of total spending of {formatINR(total)}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Amount spent</th>
            <th scope="col">Share of spending</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-paper-300">
          {visible.map((r) => {
            const over = r.planned > 0 && r.spent > r.planned;
            // Planned rows: progress against their own plan line. Flexible rows: share of the flexible money.
            const budget = r.planned > 0 ? r.planned : Math.max(0, flexible);
            const ratio = budget > 0 ? r.spent / budget : 1;
            const width = Math.max(2, Math.round(Math.min(1, ratio) * 100));
            return (
              <tr key={r.id}>
                <th scope="row" className="w-[62%] py-2.5 pr-3 text-left align-top font-normal sm:w-[52%]">
                  <span className="block font-medium">{r.name}</span>
                  <span className="relative mt-1.5 block h-1.5 bg-paper-200" aria-hidden>
                    <span
                      className={`block h-full ${over ? "bg-ink-900" : r.group === "flexible" ? "bg-ink-700" : "bg-forest-600"}`}
                      style={{ width: `${width}%` }}
                    />
                    {over && <span className="absolute -top-1 right-0 h-3.5 w-0.5 bg-ink-900" />}
                  </span>
                  <span className="mt-1 block text-xs text-ink-600">
                    {r.planned > 0
                      ? over
                        ? <span className="font-semibold text-ink-900">{formatINR(r.spent - r.planned)} over the {formatINR(r.planned)} planned</span>
                        : `of ${formatINR(r.planned)} planned`
                      : flexible > 0
                        ? `of ${formatINR(flexible)} flexible`
                        : "Flexible"}
                  </span>
                </th>
                <td className="tnum py-2.5 text-right align-top font-semibold">{formatINR(r.spent)}</td>
                <td className="tnum w-14 py-2.5 text-right align-top text-ink-600">{r.percent}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-600">
        <span>
          Total spent <span className="tnum font-semibold text-ink-900">{formatINR(total)}</span>
          {notYet.length > 0 && ` · Nothing yet in ${notYet.map((r) => r.name).join(", ")}`}
        </span>
        {spent.length > 7 && (
          <button type="button" className="link text-xs" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? "Show fewer" : `Show all ${spent.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
