"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { CycleSummary } from "@/lib/calc/summary";
import { formatShort } from "@/lib/dates";
import { formatINR, MINUS } from "@/lib/money";
import { daysPhrase } from "@/lib/copy";
import { MoneyAmount } from "./ui/primitives";

export function SummaryMetric({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: number;
  caption: ReactNode;
  tone?: "default" | "positive" | "critical";
}) {
  return (
    <div className="min-w-0 py-4 pr-3 sm:px-5 sm:first:pl-0">
      <dt className="label">{label}</dt>
      <dd className="mt-1">
        <MoneyAmount value={value} tone={tone} className="block text-[1.5rem] font-semibold leading-tight sm:text-[1.75rem]" />
        <span className="mt-1 block text-[0.8125rem] leading-snug text-ink-600">{caption}</span>
      </dd>
    </div>
  );
}

/** Money in, committed, flexible, safe to spend: the cycle in four figures, with the working one click away. */
export function CycleFigures({ summary }: { summary: CycleSummary }) {
  const s = summary;
  const noPlan = s.state === "no-plan";
  const starting = s.resolved.source === "starting";
  return (
    <section aria-labelledby="figures-heading" className="border-b border-paper-400">
      <h2 id="figures-heading" className="sr-only">
        This cycle in figures
      </h2>
      <dl className="grid grid-cols-2 divide-paper-300 sm:grid-cols-4 sm:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-paper-300 sm:[&>*:nth-child(-n+2)]:border-b-0">
        <SummaryMetric
          label="Money in"
          value={s.moneyIn}
          caption={
            starting
              ? `What you had to last until payday, from ${formatShort(s.trackedFrom)}`
              : s.salaryExpected
              ? `Expected salary${s.totals.takeHome === 0 ? "" : ", not recorded yet"}${s.extraIncome ? ` + ${formatINR(s.extraIncome)} extra` : ""}`
              : `Salary${s.extraIncome ? ` + ${formatINR(s.extraIncome)} extra income` : ` received`}`
          }
        />
        <SummaryMetric
          label="Committed"
          value={s.committed}
          caption={starting ? "Nothing set aside in advance this first cycle" : "Fixed costs, family & EMIs, everyday spending and savings"}
        />
        <SummaryMetric
          label="Flexible this cycle"
          value={s.flexible}
          tone={s.flexible < 0 ? "critical" : "default"}
          caption={s.flexible < 0 ? "Your plan asks for more than comes in" : "Left after commitments"}
        />
        <SummaryMetric
          label="Safe to spend now"
          value={s.timeframe === "past" ? Math.max(0, s.safeToSpend) : s.safeToSpend}
          tone={s.safeToSpend < 0 ? "critical" : noPlan ? "default" : "positive"}
          caption={
            s.timeframe === "past"
              ? "Unspent when the cycle closed"
              : "After spending, overruns and bills still due. Not your bank balance."
          }
        />
      </dl>
      {!noPlan && <HowWorkedOut summary={s} />}
    </section>
  );
}

function Row({ op, label, value, strong, note }: { op: string; label: ReactNode; value: number; strong?: boolean; note?: ReactNode }) {
  return (
    <tr className={strong ? "border-t border-paper-400 font-semibold" : ""}>
      <td className="w-6 py-1.5 align-top text-ink-600" aria-hidden>
        {op}
      </td>
      <th scope="row" className="py-1.5 pr-4 text-left align-top font-[inherit]">
        {label}
        {note && <span className="block text-xs font-normal text-ink-600">{note}</span>}
      </th>
      <td className="tnum py-1.5 text-right align-top">{formatINR(value)}</td>
    </tr>
  );
}

function HowWorkedOut({ summary: s }: { summary: CycleSummary }) {
  const overrunCats = s.categories.filter((c) => c.overrun > 0);
  return (
    <details className="group border-t border-paper-300 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-forest-700 [&::-webkit-details-marker]:hidden">
        <ChevronDown size={16} className="transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] group-open:rotate-180" aria-hidden />
        How this is worked out
      </summary>
      <div className="mt-3 grid gap-6 pb-2 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <table className="w-full text-[0.9375rem]">
          <caption className="sr-only">Calculation of the daily allowance</caption>
          <tbody>
            <Row
              op=""
              label={s.resolved.source === "starting" ? "Money to last until payday" : s.salaryExpected ? "Money in (expected salary)" : "Money in"}
              value={s.moneyIn}
            />
            <Row op={MINUS} label="Committed in your plan" value={s.committed} />
            <Row op="=" label="Flexible this cycle" value={s.flexible} strong />
            <Row op={MINUS} label="Flexible spending so far" value={s.spentFlexible} />
            {s.flexibleBillsDue > 0 && <Row op={MINUS} label="Flexible bills still due" value={s.flexibleBillsDue} />}
            <Row
              op={MINUS}
              label="Planned categories running over"
              value={s.overrunTotal}
              note={
                overrunCats.length > 0
                  ? overrunCats.map((c) => `${c.category.name} ${formatINR(c.overrun)}`).join(", ")
                  : "None. Underspending doesn't add to this."
              }
            />
            <Row op="=" label="Safe to spend now" value={s.safeToSpend} strong />
            {s.timeframe === "current" && (
              <>
                <tr>
                  <td className="py-1.5 text-ink-600" aria-hidden>
                    ÷
                  </td>
                  <th scope="row" className="py-1.5 text-left font-[inherit]">
                    Days until payday, counting today
                  </th>
                  <td className="tnum py-1.5 text-right">{s.daysLeft}</td>
                </tr>
                <Row op="=" label="Daily allowance (rounded down)" value={s.dailyAllowance} strong />
              </>
            )}
          </tbody>
        </table>
        <div className="max-w-[60ch] space-y-2 text-sm text-ink-700">
          <p>
            The allowance uses your plan and what you&apos;ve actually recorded. The plan sets aside money for rent, family,
            EMIs, food, travel and savings. What&apos;s left is flexible.
          </p>
          <p>
            Spending in flexible categories comes straight off that. Spending more than planned in a category, or a bill
            that&apos;s bigger than its plan line, comes off it too. Spending less than planned doesn&apos;t add anything,
            because that money may still be needed before payday.
          </p>
          <p>
            Savings count once, as committed. A paid bill counts once, through its payment. This is not your bank balance.
            {s.timeframe === "current" &&
              ` The cycle runs ${formatShort(s.cycle.start)} to ${formatShort(s.cycle.end)}: ${daysPhrase(s.cycle.length)}.`}
          </p>
        </div>
      </div>
    </details>
  );
}
