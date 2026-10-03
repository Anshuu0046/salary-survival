"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { BudgetAllocation } from "@/components/BudgetAllocation";
import { MonthSelector } from "@/components/MonthSelector";
import { PageHeader } from "@/components/PageHeader";
import { ordinal } from "@/components/QuickSetup";
import { useFeedback } from "@/components/ui/feedback";
import { AmountInput, Field } from "@/components/ui/primitives";
import { cycleName, cycleRange } from "@/lib/calc/cycle";
import { planTotals, runningRemainders } from "@/lib/calc/plan";
import { GROUP_HINTS, GROUP_LABELS, newId } from "@/lib/defaults";
import { formatINR, paiseToInput, parseAmount } from "@/lib/money";
import { PLANNED_GROUPS } from "@/lib/types";
import type { Category, Plan, PlannedGroup, PaySchedule, WeekendRule } from "@/lib/types";
import { useCyclePlan, useStore } from "@/state/store";

interface DraftLine {
  id: string;
  categoryId: string;
  label: string;
  amount: string;
  oneOff?: boolean;
}

interface Draft {
  takeHome: string;
  lines: DraftLine[];
  payday: string; // "1".."31" or "last"
  weekendRule: WeekendRule;
}

const STARTER_CATEGORIES = ["rent", "bills", "family", "emi", "food", "travel", "savings"];

function toDraft(plan: Plan, schedule: PaySchedule, weekendRule: WeekendRule, starter: boolean, categories: Category[]): Draft {
  const lines: DraftLine[] =
    starter && plan.lines.length === 0
      ? STARTER_CATEGORIES.filter((id) => categories.some((c) => c.id === id && !c.archived)).map((categoryId) => ({
          id: newId("line"),
          categoryId,
          label: "",
          amount: "",
        }))
      : plan.lines.map((l) => ({ id: l.id, categoryId: l.categoryId, label: l.label ?? "", amount: paiseToInput(l.amount), oneOff: l.oneOff }));
  return {
    takeHome: paiseToInput(plan.takeHome),
    lines,
    payday: schedule.kind === "last-working-day" ? "last" : String(schedule.day),
    weekendRule,
  };
}

function amountOf(text: string): { value: number; error?: string } {
  if (text.trim() === "") return { value: 0 };
  const r = parseAmount(text, { allowZero: true });
  return r.ok ? { value: r.value } : { value: 0, error: r.error };
}

export default function PlanPage() {
  const { viewKey } = useStore();
  const resolved = useCyclePlan(viewKey);
  // Remount the editor when the cycle or where its plan comes from changes.
  return <PlanEditor key={`${viewKey}:${resolved.source}:${resolved.fromKey ?? ""}`} resolved={resolved} />;
}

function PlanEditor({ resolved }: { resolved: ReturnType<typeof useCyclePlan> }) {
  const { data, viewKey, actions } = useStore();
  const { toast, confirm } = useFeedback();
  const uid = useId();
  const categories = data.categories;
  const initial = useMemo(
    () => toDraft(resolved.plan, data.settings.schedule, data.settings.weekendRule, resolved.source === "none", categories),
    // Only on mount: the editor owns the draft until it's saved or discarded.
    [],
  );
  const [draft, setDraft] = useState<Draft>(initial);
  const [dirty, setDirty] = useState(false);
  const [newCat, setNewCat] = useState<{ group: PlannedGroup; name: string } | null>(null);

  const edit = (fn: (d: Draft) => Draft) => {
    setDraft(fn);
    setDirty(true);
  };

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const takeHome = amountOf(draft.takeHome);
  const lineAmounts = draft.lines.map((l) => amountOf(l.amount));
  const plan: Plan = {
    takeHome: takeHome.value,
    lines: draft.lines.map((l, i) => ({
      id: l.id,
      categoryId: l.categoryId,
      amount: lineAmounts[i]!.value,
      ...(l.label.trim() ? { label: l.label.trim() } : {}),
      ...(l.oneOff ? { oneOff: true } : {}),
    })),
  };
  const totals = planTotals(plan, categories);
  const remainders = runningRemainders(plan, categories);
  const hasErrors = Boolean(takeHome.error) || lineAmounts.some((a) => a.error);
  const catById = new Map(categories.map((c) => [c.id, c]));

  const save = () => {
    if (hasErrors) return;
    const schedule: PaySchedule =
      draft.payday === "last" ? { kind: "last-working-day" } : { kind: "day-of-month", day: Number(draft.payday) };
    const scheduleChanged =
      JSON.stringify(schedule) !== JSON.stringify(data.settings.schedule) || draft.weekendRule !== data.settings.weekendRule;
    if (scheduleChanged) actions.updateSettings({ schedule, weekendRule: draft.weekendRule });
    // Blank lines are dropped; a plan doesn't need every category.
    actions.savePlan(viewKey, { ...plan, lines: plan.lines.filter((l) => l.amount > 0 || l.oneOff) });
    setDirty(false);
    toast(`Saved as the ${cycleName(viewKey)} plan. It carries forward until you change it.`);
  };

  const discard = async () => {
    const ok = await confirm({
      title: "Discard your changes?",
      body: "The plan goes back to how it was when you last saved it.",
      confirmLabel: "Discard changes",
      tone: "danger",
    });
    if (ok) {
      setDraft(initial);
      setDirty(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    edit((d) => {
      const group = catById.get(d.lines[index]!.categoryId)?.group;
      let j = index + dir;
      while (j >= 0 && j < d.lines.length && catById.get(d.lines[j]!.categoryId)?.group !== group) j += dir;
      if (j < 0 || j >= d.lines.length) return d;
      const lines = [...d.lines];
      [lines[index], lines[j]] = [lines[j]!, lines[index]!];
      return { ...d, lines };
    });
  };

  const addLine = (group: PlannedGroup) => {
    const options = categories.filter((c) => c.group === group && !c.archived);
    const used = new Set(draft.lines.map((l) => l.categoryId));
    const pick = options.find((c) => !used.has(c.id)) ?? options[0];
    if (!pick) {
      setNewCat({ group, name: "" });
      return;
    }
    edit((d) => ({ ...d, lines: [...d.lines, { id: newId("line"), categoryId: pick.id, label: "", amount: "" }] }));
  };

  const createCategory = () => {
    if (!newCat) return;
    const name = newCat.name.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && !c.archived)) {
      toast(`There's already a category called ${name}.`);
      return;
    }
    const c = actions.addCategory({ name, group: newCat.group });
    edit((d) => ({ ...d, lines: [...d.lines, { id: newId("line"), categoryId: c.id, label: "", amount: "" }] }));
    setNewCat(null);
  };

  const startingHere = data.startingPoint?.cycleKey === viewKey;
  const sourceNote = startingHere
    ? `Your first cycle runs on the ${formatINR(data.startingPoint!.amount)} you had to last until payday. This plan applies in full from the next cycle.`
    : resolved.source === "own"
      ? `This is the ${cycleName(viewKey)} plan (${cycleRange(resolved.cycle)}). Later cycles use it until you change them.`
      : resolved.source === "carried"
        ? `Using the ${cycleName(resolved.fromKey!)} plan. Saving makes it the ${cycleName(viewKey)} plan, and it carries forward from there.`
        : `No plan yet for the ${cycleName(viewKey)}. Fill in what you know; blank lines are left out.`;

  return (
    <>
      <PageHeader title="Monthly plan" description={sourceNote} actions={<MonthSelector />} />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          {/* Salary */}
          <section aria-labelledby={`${uid}-salary`} className="border-t border-paper-400 pt-4">
            <h2 id={`${uid}-salary`} className="text-[1.3125rem] font-semibold">
              Salary
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field
                id={`${uid}-takehome`}
                label="Take-home pay"
                error={takeHome.error}
                hint="What reaches your account after tax and PF."
              >
                <AmountInput
                  id={`${uid}-takehome`}
                  value={draft.takeHome}
                  placeholder="15,000"
                  invalid={Boolean(takeHome.error)}
                  onChange={(e) => edit((d) => ({ ...d, takeHome: e.target.value }))}
                />
              </Field>
              <Field id={`${uid}-payday`} label="Payday" hint="When your salary usually arrives.">
                <select
                  id={`${uid}-payday`}
                  className="field"
                  value={draft.payday}
                  onChange={(e) => edit((d) => ({ ...d, payday: e.target.value }))}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      On the {ordinal(d)}
                    </option>
                  ))}
                  <option value="last">Last working day</option>
                </select>
              </Field>
              <Field id={`${uid}-weekend`} label="If payday is a weekend" hint="Most employers pay on the Friday before.">
                <select
                  id={`${uid}-weekend`}
                  className="field"
                  value={draft.weekendRule}
                  disabled={draft.payday === "last"}
                  onChange={(e) => edit((d) => ({ ...d, weekendRule: e.target.value as WeekendRule }))}
                >
                  <option value="previous-working-day">Friday before</option>
                  <option value="next-working-day">Monday after</option>
                  <option value="as-is">Same date anyway</option>
                </select>
              </Field>
            </div>
          </section>

          {PLANNED_GROUPS.map((group, gi) => {
            const rows = draft.lines
              .map((l, index) => ({ l, index }))
              .filter(({ l }) => catById.get(l.categoryId)?.group === group);
            const groupCats = categories.filter((c) => c.group === group && (!c.archived || rows.some(({ l }) => l.categoryId === c.id)));
            const rem = remainders[gi]!;
            const headingId = `${uid}-${group}`;
            return (
              <section key={group} aria-labelledby={headingId} className="border-t border-paper-400 pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 id={headingId} className="text-[1.3125rem] font-semibold">
                    {GROUP_LABELS[group]}
                  </h2>
                  <p className="tnum text-sm font-semibold">{formatINR(rem.total)}</p>
                </div>
                <p className="mt-0.5 max-w-[60ch] text-sm text-ink-600">{GROUP_HINTS[group]}</p>

                {rows.length > 0 && (
                  <ul className="mt-3 divide-y divide-paper-300 border-y border-paper-300">
                    {rows.map(({ l, index }, ri) => {
                      const err = lineAmounts[index]!.error;
                      const catLabel = catById.get(l.categoryId)?.name ?? "Category";
                      const fieldId = `${uid}-line-${l.id}`;
                      return (
                        <li key={l.id} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-2 py-2.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_9rem_auto] sm:items-start">
                          <div className="col-span-2 sm:col-span-1">
                            <label htmlFor={`${fieldId}-cat`} className="sr-only">
                              Category
                            </label>
                            <select
                              id={`${fieldId}-cat`}
                              className="field"
                              value={l.categoryId}
                              onChange={(e) =>
                                edit((d) => ({
                                  ...d,
                                  lines: d.lines.map((x) => (x.id === l.id ? { ...x, categoryId: e.target.value } : x)),
                                }))
                              }
                            >
                              {groupCats.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <label htmlFor={`${fieldId}-label`} className="sr-only">
                              Note for {catLabel}
                            </label>
                            <input
                              id={`${fieldId}-label`}
                              className="field"
                              placeholder={l.oneOff ? "One-off: what for?" : "Note (optional)"}
                              value={l.label}
                              maxLength={80}
                              onChange={(e) =>
                                edit((d) => ({
                                  ...d,
                                  lines: d.lines.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label htmlFor={`${fieldId}-amt`} className="sr-only">
                              Amount for {catLabel}
                            </label>
                            <AmountInput
                              id={`${fieldId}-amt`}
                              value={l.amount}
                              placeholder="0"
                              invalid={Boolean(err)}
                              describedById={err ? `${fieldId}-err` : undefined}
                              onChange={(e) =>
                                edit((d) => ({
                                  ...d,
                                  lines: d.lines.map((x) => (x.id === l.id ? { ...x, amount: e.target.value } : x)),
                                }))
                              }
                            />
                            {err && (
                              <p id={`${fieldId}-err`} className="mt-1 text-xs text-red-800">
                                {err}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              className="btn btn-quiet btn-icon btn-sm"
                              onClick={() => move(index, -1)}
                              disabled={ri === 0}
                              aria-label={`Move ${catLabel} up`}
                            >
                              <ArrowUp size={15} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="btn btn-quiet btn-icon btn-sm"
                              onClick={() => move(index, 1)}
                              disabled={ri === rows.length - 1}
                              aria-label={`Move ${catLabel} down`}
                            >
                              <ArrowDown size={15} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="btn btn-quiet btn-icon btn-sm"
                              onClick={() => edit((d) => ({ ...d, lines: d.lines.filter((x) => x.id !== l.id) }))}
                              aria-label={`Remove ${catLabel} from the plan`}
                            >
                              <Trash2 size={15} aria-hidden />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="btn btn-quiet btn-sm text-forest-700" onClick={() => addLine(group)}>
                      <Plus size={15} aria-hidden />
                      Add a line
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm text-forest-700"
                      onClick={() => setNewCat({ group, name: "" })}
                    >
                      New category
                    </button>
                  </div>
                  <p className={`tnum text-sm ${rem.leftAfter < 0 ? "font-semibold text-red-800" : "text-ink-600"}`}>
                    {rem.leftAfter < 0 ? `Over by ${formatINR(-rem.leftAfter)}` : `${formatINR(rem.leftAfter)} left after this`}
                  </p>
                </div>

                {newCat?.group === group && (
                  <form
                    className="mt-2 flex flex-wrap items-end gap-2 border border-paper-400 bg-paper-50 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      createCategory();
                    }}
                  >
                    <Field id={`${uid}-newcat-${group}`} label={`New category in ${GROUP_LABELS[group]}`} className="min-w-[12rem] flex-1">
                      <input
                        id={`${uid}-newcat-${group}`}
                        className="field"
                        autoFocus
                        maxLength={60}
                        value={newCat.name}
                        placeholder="e.g. Gym, Course fees"
                        onChange={(e) => setNewCat({ group, name: e.target.value })}
                      />
                    </Field>
                    <button type="submit" className="btn btn-primary" disabled={!newCat.name.trim()}>
                      Add category
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={() => setNewCat(null)}>
                      Cancel
                    </button>
                  </form>
                )}
              </section>
            );
          })}
        </div>

        {/* Live allocation */}
        <aside className="lg:sticky lg:top-8 lg:self-start" aria-label="Plan summary">
          <div className="border-y border-paper-400 py-5 lg:border lg:bg-paper-50 lg:px-5">
            <BudgetAllocation totals={totals} />
            {totals.flexible < 0 && (
              <p className="mt-4 text-sm text-ink-700">
                Lower a target or two, or plan a smaller savings amount, until it fits. You can still save it as it is.
              </p>
            )}
          </div>
          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-paper-300 bg-paper-100/95 px-4 py-2.5 lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-xl items-center gap-2 lg:max-w-none">
              <p className="flex-1 text-sm text-ink-600 lg:hidden" aria-live="polite">
                {hasErrors ? "Fix the highlighted amounts." : dirty ? "Unsaved changes" : "All changes saved"}
              </p>
              {dirty && (
                <button type="button" className="btn btn-quiet" onClick={discard}>
                  Discard
                </button>
              )}
              <button type="button" className="btn btn-primary lg:flex-1" onClick={save} disabled={!dirty || hasErrors}>
                Save plan
              </button>
            </div>
            <p className="mt-2 hidden text-sm text-ink-600 lg:block" aria-live="polite">
              {hasErrors ? "Fix the highlighted amounts to save." : dirty ? "You have unsaved changes." : "All changes saved."}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
