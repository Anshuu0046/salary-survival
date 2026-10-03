"use client";

import { ChevronDown, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { MonthSelector } from "@/components/MonthSelector";
import { PageHeader } from "@/components/PageHeader";
import { ScenarioComparison } from "@/components/ScenarioComparison";
import { useFeedback } from "@/components/ui/feedback";
import { AmountInput, EmptyState, Field } from "@/components/ui/primitives";
import { cycleName, shiftCycleKey } from "@/lib/calc/cycle";
import { compareScenario, adjustPlan, type ScenarioInput } from "@/lib/calc/scenario";
import { GROUP_LABELS, newId } from "@/lib/defaults";
import { formatINR, paiseToInput, parseAmount } from "@/lib/money";
import type { Plan } from "@/lib/types";
import { useCyclePlan, useStore } from "@/state/store";

interface Assumptions {
  salaryDir: "raise" | "cut";
  salary: string;
  lines: Record<string, string>;
  savingsDir: "more" | "less";
  savings: string;
  purchase: string;
  purchaseLabel: string;
}

const BLANK: Assumptions = { salaryDir: "raise", salary: "", lines: {}, savingsDir: "more", savings: "", purchase: "", purchaseLabel: "" };

function amt(text: string): { value: number; error?: string } {
  if (!text.trim()) return { value: 0 };
  const r = parseAmount(text, { allowZero: true });
  return r.ok ? { value: r.value } : { value: 0, error: r.error };
}

export default function ScenariosPage() {
  const { viewKey } = useStore();
  const resolved = useCyclePlan(viewKey);
  return <ScenarioEditor key={viewKey} plan={resolved.plan} cycleLength={resolved.cycle.length} hasPlan={resolved.source !== "none"} />;
}

function ScenarioEditor({ plan, cycleLength, hasPlan }: { plan: Plan; cycleLength: number; hasPlan: boolean }) {
  const { data, viewKey, actions } = useStore();
  const { confirm, toast } = useFeedback();
  const uid = useId();
  const [a, setA] = useState<Assumptions>(BLANK);
  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  const salary = amt(a.salary);
  const savings = amt(a.savings);
  const purchase = amt(a.purchase);
  const lineParsed = Object.fromEntries(Object.entries(a.lines).map(([id, t]) => [id, amt(t)]));
  const hasErrors = [salary, savings, purchase, ...Object.values(lineParsed)].some((x) => x.error);

  const input: ScenarioInput = {
    salaryChange: a.salaryDir === "raise" ? salary.value : -salary.value,
    extraSavings: a.savingsDir === "more" ? savings.value : -savings.value,
    purchase: purchase.value,
    lineAmounts: Object.fromEntries(
      Object.entries(a.lines)
        .filter(([, t]) => t.trim() !== "")
        .map(([id]) => [id, lineParsed[id]!.value]),
    ),
  };
  const result = compareScenario(plan, input, data.categories, cycleLength);

  const rentLine = plan.lines.find((l) => l.categoryId === "rent") ?? plan.lines.find((l) => catById.get(l.categoryId)?.group === "fixed");
  const emiLine =
    plan.lines.find((l) => l.categoryId === "emi") ?? plan.lines.find((l) => catById.get(l.categoryId)?.group === "obligations" && /emi|loan/i.test(catById.get(l.categoryId)?.name ?? ""));

  const presets: { label: string; apply(x: Assumptions): Assumptions }[] = [
    { label: "Salary up ₹2,000", apply: (x) => ({ ...x, salaryDir: "raise", salary: "2000" }) },
    ...(rentLine
      ? [{ label: "Rent up ₹1,000", apply: (x: Assumptions) => ({ ...x, lines: { ...x.lines, [rentLine.id]: paiseToInput(rentLine.amount + 1_000_00) } }) }]
      : []),
    { label: "Save ₹500 more", apply: (x) => ({ ...x, savingsDir: "more", savings: "500" }) },
    ...(emiLine ? [{ label: "EMI paid off", apply: (x: Assumptions) => ({ ...x, lines: { ...x.lines, [emiLine.id]: "0" } }) }] : []),
    { label: "₹3,000 purchase next month", apply: (x) => ({ ...x, purchase: "3000", purchaseLabel: x.purchaseLabel || "Planned purchase" }) },
  ];

  const nextKey = shiftCycleKey(viewKey, 1);
  const purchaseLabel = a.purchaseLabel.trim() || "Planned purchase";

  const applyTo = async (target: "this" | "next") => {
    const targetKey = target === "this" ? viewKey : nextKey;
    const overwritesNext = Boolean(data.plans[nextKey]) && (target === "next" || purchase.value > 0);
    const ok = await confirm({
      title: `Apply to the ${cycleName(targetKey)} plan?`,
      body: (
        <div className="space-y-2">
          <p>
            Your plan from the {cycleName(targetKey)} onward will have{" "}
            <span className="tnum font-semibold">{formatINR(result.adjusted.flexible)}</span> of flexible money (now{" "}
            <span className="tnum">{formatINR(result.current.flexible)}</span>).
          </p>
          {purchase.value > 0 && (
            <p>
              {purchaseLabel} (<span className="tnum">{formatINR(purchase.value)}</span>) is set aside once, in the {cycleName(nextKey)} only.
            </p>
          )}
          {overwritesNext && <p>This replaces the plan you already saved for the {cycleName(nextKey)}.</p>}
        </div>
      ),
      confirmLabel: "Apply changes",
    });
    if (!ok) return;

    const adjusted = adjustPlan(plan, input, data.categories, () => newId("line"));
    if (target === "this") actions.savePlan(viewKey, adjusted);
    if (target === "next" || purchase.value > 0) {
      let lines = adjusted.lines;
      if (purchase.value > 0) {
        let cat = data.categories.find((c) => c.group === "setAside" && c.name === "Planned purchases" && !c.archived);
        if (!cat) cat = actions.addCategory({ name: "Planned purchases", group: "setAside" });
        lines = [...lines, { id: newId("line"), categoryId: cat.id, amount: purchase.value, oneOff: true, label: purchaseLabel }];
      }
      actions.savePlan(nextKey, { ...adjusted, lines });
    }
    setA(BLANK);
    toast(`Applied. The ${cycleName(targetKey)} plan is updated.`);
  };

  if (!hasPlan || plan.takeHome === 0) {
    return (
      <>
        <PageHeader title="Scenarios" actions={<MonthSelector />} />
        <EmptyState
          title="Scenarios need a plan to compare against"
          body="Add your take-home pay and commitments first. Then try a raise, a rent increase or a purchase here."
          action={
            <Link href="/plan" className="btn btn-primary btn-sm">
              Set up your plan
            </Link>
          }
        />
      </>
    );
  }


  return (
    <>
      <PageHeader
        title="Scenarios"
        description={`Try a change against the ${cycleName(viewKey)} plan. Nothing is saved until you apply it.`}
        actions={<MonthSelector />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Common questions">
        <span className="mr-1 text-sm text-ink-600">Try:</span>
        {presets.map((p) => (
          <button key={p.label} type="button" className="btn btn-secondary btn-sm" onClick={() => setA((x) => p.apply(x))}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <form onSubmit={(e) => e.preventDefault()} className="min-w-0 space-y-8" aria-label="Assumptions">
          <fieldset className="border-t border-paper-400 pt-4">
            <legend className="float-left mb-3 w-full font-serif text-[1.3125rem] font-semibold">Salary</legend>
            <div className="clear-both grid grid-cols-[8.5rem_1fr] gap-3">
              <div>
                <label htmlFor={`${uid}-sdir`} className="mb-1 block text-sm font-medium">Change</label>
                <select id={`${uid}-sdir`} className="field" value={a.salaryDir} onChange={(e) => setA({ ...a, salaryDir: e.target.value as Assumptions["salaryDir"] })}>
                  <option value="raise">Goes up by</option>
                  <option value="cut">Goes down by</option>
                </select>
              </div>
              <Field id={`${uid}-sal`} label="Amount a month" error={salary.error}>
                <AmountInput id={`${uid}-sal`} value={a.salary} placeholder="0" invalid={Boolean(salary.error)} onChange={(e) => setA({ ...a, salary: e.target.value })} />
              </Field>
            </div>
            <p className="mt-2 text-sm text-ink-600">
              Now <span className="tnum">{formatINR(plan.takeHome)}</span> a month.
            </p>
          </fieldset>

          <fieldset className="border-t border-paper-400 pt-4">
            <legend className="float-left mb-1 w-full font-serif text-[1.3125rem] font-semibold">Costs in your plan</legend>
            <p className="clear-both mb-3 text-sm text-ink-600">Type a new monthly amount. 0 means the cost goes away, like an EMI paid off.</p>
            <ul className="divide-y divide-paper-300 border-y border-paper-300">
              {plan.lines.map((l) => {
                const cat = catById.get(l.categoryId);
                const err = lineParsed[l.id]?.error;
                const fid = `${uid}-l-${l.id}`;
                return (
                  <li key={l.id} className="grid grid-cols-[1fr_8.5rem] items-center gap-3 py-2">
                    <label htmlFor={fid} className="min-w-0">
                      <span className="block truncate font-medium">{l.label || cat?.name}</span>
                      <span className="block truncate text-xs text-ink-600">
                        {cat ? GROUP_LABELS[cat.group] : ""} · now <span className="tnum">{formatINR(l.amount)}</span>
                      </span>
                    </label>
                    <div>
                      <AmountInput
                        id={fid}
                        value={a.lines[l.id] ?? ""}
                        placeholder="No change"
                        invalid={Boolean(err)}
                        onChange={(e) => setA({ ...a, lines: { ...a.lines, [l.id]: e.target.value } })}
                      />
                      {err && <p className="mt-1 text-xs text-red-800">{err}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <fieldset className="border-t border-paper-400 pt-4">
            <legend className="float-left mb-3 w-full font-serif text-[1.3125rem] font-semibold">Savings</legend>
            <div className="clear-both grid grid-cols-[8.5rem_1fr] gap-3">
              <div>
                <label htmlFor={`${uid}-vdir`} className="mb-1 block text-sm font-medium">Change</label>
                <select id={`${uid}-vdir`} className="field" value={a.savingsDir} onChange={(e) => setA({ ...a, savingsDir: e.target.value as Assumptions["savingsDir"] })}>
                  <option value="more">Save more</option>
                  <option value="less">Save less</option>
                </select>
              </div>
              <Field id={`${uid}-sav`} label="Amount a month" error={savings.error}>
                <AmountInput id={`${uid}-sav`} value={a.savings} placeholder="0" invalid={Boolean(savings.error)} onChange={(e) => setA({ ...a, savings: e.target.value })} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="border-t border-paper-400 pt-4">
            <legend className="float-left mb-1 w-full font-serif text-[1.3125rem] font-semibold">A purchase next month</legend>
            <p className="clear-both mb-3 text-sm text-ink-600">
              Checked against the adjusted plan&apos;s flexible money for the {cycleName(nextKey)}.
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <Field id={`${uid}-pl`} label="What is it?" optional>
                <input id={`${uid}-pl`} className="field" maxLength={60} placeholder="Phone, course fee, gift…" value={a.purchaseLabel} onChange={(e) => setA({ ...a, purchaseLabel: e.target.value })} />
              </Field>
              <Field id={`${uid}-pa`} label="Cost" error={purchase.error}>
                <AmountInput id={`${uid}-pa`} value={a.purchase} placeholder="0" invalid={Boolean(purchase.error)} onChange={(e) => setA({ ...a, purchase: e.target.value })} />
              </Field>
            </div>
          </fieldset>
        </form>

        <section aria-labelledby={`${uid}-res`} className="lg:sticky lg:top-8 lg:self-start">
          <div className="border-y border-paper-400 py-5 lg:border lg:bg-paper-50 lg:px-5">
            <h2 id={`${uid}-res`} className="font-serif text-[1.3125rem] font-semibold">
              {result.changed ? "What changes" : "Your plan as it is"}
            </h2>
            <p className="mt-1 text-sm text-ink-600" aria-live="polite">
              {!result.changed
                ? "Change an assumption to see the difference."
                : result.difference.flexible === 0
                  ? "Your flexible money stays the same."
                  : result.difference.flexible > 0
                    ? `You'd have ${formatINR(result.difference.flexible)} more flexible money a month, about ${formatINR(Math.max(0, result.difference.dailyShare), { wholeRupees: true })} a day.`
                    : `You'd have ${formatINR(-result.difference.flexible)} less flexible money a month.${result.adjusted.flexible < 0 ? ` The plan would be ${formatINR(-result.adjusted.flexible)} over take-home pay.` : ""}`}
            </p>
            <div className="mt-4">
              <ScenarioComparison result={result} />
            </div>

            {purchase.value > 0 && (
              <div
                className={`mt-5 border-t pt-4 ${result.canAffordPurchase ? "border-forest-300" : "border-red-600"}`}
                role="status"
              >
                <p className={`font-serif text-lg font-semibold ${result.canAffordPurchase ? "text-forest-700" : "text-red-800"}`}>
                  {result.canAffordPurchase
                    ? `Yes, ${purchaseLabel.toLowerCase()} fits.`
                    : `Not without other changes.`}
                </p>
                <p className="mt-1 text-sm text-ink-700">
                  {result.canAffordPurchase
                    ? `After ${formatINR(purchase.value)}, you'd have ${formatINR(result.afterPurchase)} of flexible money in the ${cycleName(nextKey)}, about ${formatINR(result.afterPurchaseDailyShare, { wholeRupees: true })} a day.`
                    : `It's ${formatINR(result.purchaseShortBy)} more than your flexible money for the ${cycleName(nextKey)}. Spreading it over two months, or trimming a target, would close the gap.`}
                </p>
              </div>
            )}

            <details className="group mt-5 border-t border-paper-300 pt-3 text-sm text-ink-700">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-forest-700 [&::-webkit-details-marker]:hidden">
                <ChevronDown size={16} className="transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] group-open:rotate-180" aria-hidden />
                How these are worked out
              </summary>
              <div className="mt-2 space-y-2">
                <p>Flexible money = take-home pay − everything committed in the plan (savings included).</p>
                <p>
                  Daily share = flexible money ÷ {cycleLength} days in the cycle. It compares plans, so it ignores what
                  you&apos;ve already spent. Your live daily allowance on the Overview does count spending.
                </p>
                <p>These are plain sums of your own numbers. They don&apos;t predict interest, returns or loan payoff dates.</p>
              </div>
            </details>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-paper-300 pt-4">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!result.changed || hasErrors}
                onClick={() => applyTo("this")}
              >
                Apply from the {cycleName(viewKey)}
              </button>
              <button type="button" className="btn btn-secondary" disabled={!result.changed || hasErrors} onClick={() => applyTo("next")}>
                From the {cycleName(nextKey)}
              </button>
              <button type="button" className="btn btn-quiet" disabled={!result.changed && !a.purchaseLabel} onClick={() => setA(BLANK)}>
                <RotateCcw size={15} aria-hidden />
                Reset
              </button>
            </div>
            {hasErrors && <p className="mt-2 text-sm text-red-800">Fix the highlighted amounts to apply.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
