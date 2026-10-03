import { GROUP_LABELS } from "@/lib/defaults";
import { formatINR } from "@/lib/money";
import type { PlannedGroup } from "@/lib/types";
import type { PlanTotals } from "@/lib/calc/plan";
import { planBalanceSentence } from "@/lib/copy";

export const GROUP_SWATCH: Record<PlannedGroup | "flexible", string> = {
  fixed: "bg-ink-900",
  obligations: "bg-ink-600",
  variable: "bg-forest-700",
  savings: "bg-forest-300",
  setAside: "bg-paper-500",
  flexible: "bg-paper-50",
};

const ORDER: PlannedGroup[] = ["fixed", "obligations", "variable", "savings", "setAside"];

/**
 * Take-home pay as one bar: each section takes its share and what's left is
 * flexible. When the plan asks for more than comes in, the overflow is shown
 * past the end of the bar in red.
 */
export function BudgetAllocation({ totals }: { totals: PlanTotals }) {
  const base = Math.max(totals.takeHome, totals.committed, 1);
  const pct = (v: number) => `${(v / base) * 100}%`;
  const over = totals.overBy;
  const flexible = Math.max(0, totals.flexible);

  return (
    <div>
      <p
        className={`font-serif text-[1.375rem] font-semibold leading-snug ${totals.flexible < 0 ? "text-red-800" : ""}`}
        aria-live="polite"
      >
        {totals.takeHome === 0 && totals.committed === 0 ? "Start with your take-home pay." : planBalanceSentence(totals.flexible)}
      </p>

      <div className="relative mt-4">
        <div
          className="flex h-5 w-full overflow-hidden border border-paper-500 bg-paper-50"
          role="img"
          aria-label={`Allocation of ${formatINR(totals.takeHome)} take-home: ${ORDER.map((g) => `${GROUP_LABELS[g]} ${formatINR(totals.byGroup[g])}`).join(", ")}, flexible ${formatINR(flexible)}${over ? `, over by ${formatINR(over)}` : ""}.`}
        >
          {ORDER.map((g) =>
            totals.byGroup[g] > 0 ? (
              <span
                key={g}
                className={`${GROUP_SWATCH[g]} h-full border-r border-paper-50 last:border-r-0`}
                style={{ width: pct(totals.byGroup[g]) }}
              />
            ) : null,
          )}
          {over > 0 && (
            <span
              className="h-full bg-red-600"
              style={{
                width: pct(over),
                backgroundImage:
                  "repeating-linear-gradient(135deg, transparent 0 4px, rgb(255 255 255 / 0.35) 4px 6px)",
              }}
            />
          )}
        </div>
        {over > 0 && (
          <span
            className="absolute -bottom-1 top-[-4px] w-0.5 bg-ink-900"
            style={{ left: pct(totals.takeHome) }}
            aria-hidden
            title="Take-home pay"
          />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-y-1.5 text-sm">
        {ORDER.map((g) => (
          <div key={g} className="flex items-center gap-2">
            <span aria-hidden className={`size-3 shrink-0 border border-paper-500 ${GROUP_SWATCH[g]}`} />
            <dt className="flex-1 text-ink-700">{GROUP_LABELS[g]}</dt>
            <dd className="tnum font-medium">{formatINR(totals.byGroup[g])}</dd>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t border-paper-300 pt-1.5">
          <span aria-hidden className={`size-3 shrink-0 border border-paper-500 ${totals.flexible < 0 ? "bg-red-600" : GROUP_SWATCH.flexible}`} />
          <dt className="flex-1 font-medium">{totals.flexible < 0 ? "Over take-home pay" : "Left for flexible spending"}</dt>
          <dd className={`tnum font-semibold ${totals.flexible < 0 ? "text-red-800" : "text-forest-700"}`}>
            {formatINR(totals.flexible < 0 ? over : flexible)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
