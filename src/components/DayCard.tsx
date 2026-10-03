"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CycleSummary, DayCell } from "@/lib/calc/summary";
import { formatShort, formatWithWeekday, parts } from "@/lib/dates";
import { formatINR } from "@/lib/money";

/**
 * The milk card: one box per day of the pay cycle.
 * Past boxes fill with the day's flexible spending against the plan's daily
 * share; today is the solid green box; boxes ahead carry the live allowance;
 * the card closes with a payday stamp.
 */

const inr = (p: number) => formatINR(p, { wholeRupees: true });

/** Phone boxes are ~44px wide: drop the ₹ and shorten thousands ("1.2k"). */
function compact(p: number): string {
  const r = Math.max(0, Math.floor(p / 100));
  if (r < 1000) return String(r);
  return `${(Math.floor(r / 100) / 10).toString()}k`;
}

/** The figure in a box: full on wider screens, compact on phones. */
function BoxFigure({ value, className }: { value: number; className: string }) {
  return (
    <>
      <span className={`tnum text-[0.625rem] leading-none sm:hidden ${className}`}>{compact(value)}</span>
      <span className={`tnum hidden text-[0.75rem] leading-none sm:inline ${className}`}>{inr(value)}</span>
    </>
  );
}

function useColumns() {
  const [cols, setCols] = useState(8);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const set = () => setCols(mq.matches ? 16 : 8);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return cols;
}

function describe(cell: DayCell, summary: CycleSummary): string {
  const day = formatWithWeekday(cell.date);
  const bills = cell.billsDue
    .map((o) => `${o.bill.name} ${inr(o.bill.amount)} ${o.status === "paid" ? "paid" : "due"}.`)
    .join(" ");
  let text: string;
  switch (cell.state) {
    case "today":
      text =
        summary.dailyAllowance > 0
          ? `Today, ${day}. You can spend ${inr(cell.share)}.${cell.spent > 0 ? ` ${inr(cell.spent)} of flexible spending recorded today.` : ""}`
          : `Today, ${day}. No flexible money is left for today.${cell.spent > 0 ? ` ${inr(cell.spent)} spent today.` : ""}`;
      break;
    case "within":
      text = `${day}. ${inr(cell.spent)} on flexible spending, inside the plan's ${inr(cell.share)} a day.`;
      break;
    case "over":
      text = `${day}. ${inr(cell.spent)} on flexible spending, ${inr(cell.spent - cell.share)} more than the plan's ${inr(cell.share)} a day.`;
      break;
    case "empty":
      text = `${day}. Nothing spent on flexible things.`;
      break;
    case "untracked":
      text = `${day}. Before you started using SalarySurvival, so nothing is counted.`;
      break;
    default:
      text =
        cell.share > 0
          ? `${day}. ${inr(cell.share)} to spend if you keep to the ${summary.timeframe === "future" ? "plan" : "allowance"}.`
          : summary.timeframe === "future"
            ? `${day}. No flexible money planned for this day.`
            : `${day}. No flexible money left for this day.`;
  }
  return bills ? `${text} ${bills}` : text;
}

export function DayCard({ summary, cells }: { summary: CycleSummary; cells: DayCell[] }) {
  const cols = useColumns();
  const todayIndex = cells.findIndex((c) => c.state === "today");
  const [selected, setSelected] = useState(Math.max(0, todayIndex));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset selection when the cycle changes.
  useEffect(() => setSelected(Math.max(0, todayIndex)), [summary.cycle.key, todayIndex]);

  const selectedCell = cells[Math.min(selected, cells.length - 1)];
  const maxShare = useMemo(() => Math.max(1, summary.plannedDailyShare), [summary.plannedDailyShare]);

  const move = (to: number) => {
    const i = Math.max(0, Math.min(cells.length - 1, to));
    setSelected(i);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const map: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: cells.length - 1 };
    if (e.key in map) {
      e.preventDefault();
      move(map[e.key]!);
    }
  };

  return (
    <div className="mt-6">
      <div
        role="group"
        aria-label={`Days in this cycle, ${formatShort(summary.cycle.start)} to ${formatShort(summary.cycle.end)}. Use arrow keys to move between days.`}
        className="grid grid-cols-8 border-l border-t border-paper-400 sm:grid-cols-16"
      >
        {cells.map((cell, i) => {
          const { d } = parts(cell.date);
          const isSel = i === selected;
          const unpaidBills = cell.billsDue.filter((o) => o.status !== "paid");
          const fill =
            cell.state === "within" ? Math.min(1, cell.spent / maxShare) : cell.state === "over" ? 1 : 0;
          const showMonth = i === 0 || d === 1;
          return (
            <button
              key={cell.date}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              tabIndex={isSel ? 0 : -1}
              aria-pressed={isSel}
              aria-label={describe(cell, summary)}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={[
                "relative flex aspect-square min-h-10 flex-col justify-between overflow-hidden border-b border-r border-paper-400 p-1.5 text-left focus-visible:z-10 focus-visible:outline-offset-[-2px] sm:aspect-[5/6] sm:p-1.5",
                cell.state === "today"
                  ? "bg-forest-700 text-paper-50"
                  : cell.state === "ahead"
                    ? "bg-paper-50"
                    : cell.state === "untracked"
                      ? "bg-paper-200"
                      : "bg-paper-100",
                isSel && cell.state !== "today" ? "outline outline-2 -outline-offset-2 outline-ink-900" : "",
                isSel && cell.state === "today" ? "outline outline-1 -outline-offset-[3px] outline-paper-50" : "",
              ].join(" ")}
            >
              {fill > 0 && (
                <span
                  aria-hidden
                  className={`absolute inset-x-0 bottom-0 bg-forest-100 ${cell.state === "over" ? "border-t-2 border-ink-900" : ""}`}
                  style={{ height: `${Math.max(12, Math.round(fill * 100))}%` }}
                />
              )}
              <span
                className={`tnum relative flex items-baseline justify-between gap-1 text-[0.6875rem] leading-none ${cell.state === "today" ? "font-semibold text-paper-50" : "text-ink-600"}`}
              >
                {showMonth ? formatShort(cell.date) : d}
                {cell.state === "today" && (
                  <span className="hidden text-[0.5625rem] uppercase tracking-wide lg:inline">Today</span>
                )}
              </span>
              <span className="relative flex items-end justify-between gap-0.5">
                {cell.state === "empty" && <Check size={13} strokeWidth={2.5} className="text-forest-600" aria-hidden />}
                {cell.state === "today" && <BoxFigure value={cell.share} className="font-semibold text-paper-50" />}
                {(cell.state === "within" || cell.state === "over") && (
                  <BoxFigure
                    value={cell.spent}
                    className={cell.state === "over" ? "font-semibold text-ink-900" : "font-medium text-ink-700"}
                  />
                )}
                {cell.state === "ahead" && cell.share > 0 && <BoxFigure value={cell.share} className="text-ink-600" />}
              </span>
              {unpaidBills.length > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-0 top-0 size-0 border-l-[10px] border-t-[10px] border-l-transparent ${
                    unpaidBills.some((o) => o.status === "overdue") ? "border-t-red-600" : "border-t-amber-600"
                  }`}
                />
              )}
            </button>
          );
        })}
        <div
          className="flex aspect-square min-h-10 flex-col items-center justify-center border-b border-r border-paper-400 bg-paper-100 p-1 sm:aspect-[5/6]"
          aria-label={`Payday, ${formatWithWeekday(summary.cycle.nextPayday)}`}
          role="note"
        >
          <span className="stamp -rotate-6 px-1 text-[0.5625rem] text-forest-700 sm:text-[0.625rem]">Payday</span>
          <span className="tnum mt-1 text-[0.6875rem] font-semibold text-forest-700">{formatShort(summary.cycle.nextPayday)}</span>
        </div>
      </div>

      <p className="mt-3 min-h-12 text-[0.9375rem] text-ink-700">
        {selectedCell ? describe(selectedCell, summary) : null}
      </p>

      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-600" aria-label="Key">
        {cells.some((c) => c.state === "untracked") && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-3 border border-paper-400 bg-paper-200" />
            Before you started
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 border border-paper-400 bg-forest-100" />
          Spent, inside the plan&apos;s share
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 border border-paper-400 border-t-2 border-t-ink-900 bg-forest-100" />
          Over the share
        </li>
        <li className="flex items-center gap-1.5">
          <Check size={12} strokeWidth={2.5} className="text-forest-600" aria-hidden />
          Nothing spent
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-amber-600" />
          Bill due
        </li>
      </ul>
    </div>
  );
}
