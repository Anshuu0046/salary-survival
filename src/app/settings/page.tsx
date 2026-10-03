"use client";

import { Archive, ArchiveRestore, Check, Download, Pencil, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ordinal } from "@/components/QuickSetup";
import { useFeedback } from "@/components/ui/feedback";
import { Field, SectionHeading } from "@/components/ui/primitives";
import { cycleName, getCycle, shiftCycleKey } from "@/lib/calc/cycle";
import { formatWithWeekday, todayISO } from "@/lib/dates";
import { GROUP_LABELS } from "@/lib/defaults";
import { dataToJSON, downloadText, transactionsToCSV } from "@/lib/export";
import type { Category, CategoryGroup, PaySchedule, WeekendRule } from "@/lib/types";
import { useStore } from "@/state/store";

const GROUPS: CategoryGroup[] = ["fixed", "obligations", "variable", "savings", "setAside", "flexible", "income"];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your profile, payday, categories and data." />
      <div className="max-w-3xl space-y-12">
        <ProfileSection />
        <PaySection />
        <CurrencySection />
        <CategoriesSection />
        <DataSection />
      </div>
    </>
  );
}

function ProfileSection() {
  const { data, actions } = useStore();
  const { toast } = useFeedback();
  const id = useId();
  const [name, setName] = useState(data.settings.name);
  return (
    <section aria-labelledby={`${id}-h`} className="border-t border-paper-400 pt-4">
      <SectionHeading id={`${id}-h`} title="Profile" summary="Only used for the greeting on your overview." />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          actions.updateSettings({ name: name.trim().slice(0, 60) });
          toast("Name saved.");
        }}
      >
        <Field id={`${id}-name`} label="What should we call you?" optional className="min-w-[14rem] flex-1">
          <input id={`${id}-name`} className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </Field>
        <button type="submit" className="btn btn-secondary" disabled={name.trim() === data.settings.name}>
          Save name
        </button>
      </form>
    </section>
  );
}

function PaySection() {
  const { data, today, currentKey, actions } = useStore();
  const { toast } = useFeedback();
  const id = useId();
  const s = data.settings;
  const [payday, setPayday] = useState(s.schedule.kind === "last-working-day" ? "last" : String(s.schedule.day));
  const [weekend, setWeekend] = useState<WeekendRule>(s.weekendRule);
  const current = getCycle(currentKey, s);
  const nextKey = shiftCycleKey(currentKey, 1);
  const override = s.paydayOverrides[nextKey];
  const changed = payday !== (s.schedule.kind === "last-working-day" ? "last" : String(s.schedule.day)) || weekend !== s.weekendRule;

  return (
    <section aria-labelledby={`${id}-h`} className="border-t border-paper-400 pt-4">
      <SectionHeading
        id={`${id}-h`}
        title="Salary schedule"
        summary={`Your next payday is ${formatWithWeekday(current.nextPayday)}${override ? " (changed for this cycle only)" : ""}. Today is ${formatWithWeekday(today)}.`}
      />
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const schedule: PaySchedule = payday === "last" ? { kind: "last-working-day" } : { kind: "day-of-month", day: Number(payday) };
          actions.updateSettings({ schedule, weekendRule: weekend });
          toast("Salary schedule saved. Cycles and allowance are recalculated.");
        }}
      >
        <Field id={`${id}-day`} label="Salary usually arrives">
          <select id={`${id}-day`} className="field" value={payday} onChange={(e) => setPayday(e.target.value)}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                On the {ordinal(d)}
              </option>
            ))}
            <option value="last">On the last working day</option>
          </select>
        </Field>
        <Field id={`${id}-wk`} label="If that's a Saturday or Sunday">
          <select id={`${id}-wk`} className="field" value={weekend} disabled={payday === "last"} onChange={(e) => setWeekend(e.target.value as WeekendRule)}>
            <option value="previous-working-day">Paid the Friday before</option>
            <option value="next-working-day">Paid the Monday after</option>
            <option value="as-is">Paid on the date anyway</option>
          </select>
        </Field>
        <button type="submit" className="btn btn-secondary" disabled={!changed}>
          Save schedule
        </button>
      </form>
      <p className="mt-3 text-sm text-ink-600">
        Paid on the 29th, 30th or 31st? In shorter months, payday moves to the last day of the month.
        {override && (
          <>
            {" "}
            The {cycleName(nextKey)} starts on a changed date.{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                actions.setNextPayday(currentKey, null);
                toast("Next payday is back on your usual schedule.");
              }}
            >
              Use the usual date
            </button>
          </>
        )}
      </p>
    </section>
  );
}

function CurrencySection() {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-h`} className="border-t border-paper-400 pt-4">
      <SectionHeading id={`${id}-h`} title="Currency" />
      <p className="text-[0.9375rem]">
        Indian rupee, with Indian digit grouping: <span className="tnum font-semibold">₹1,00,000</span>.
      </p>
      <p className="mt-1 text-sm text-ink-600">Other currencies aren&apos;t available in this version.</p>
    </section>
  );
}

function CategoriesSection() {
  const { data, actions } = useStore();
  const { toast, confirm } = useFeedback();
  const id = useId();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState<{ name: string; group: CategoryGroup }>({ name: "", group: "flexible" });

  const saveRename = (c: Category) => {
    const name = editing?.name.trim() ?? "";
    if (!name) return;
    actions.updateCategory(c.id, { name });
    setEditing(null);
    toast("Category renamed.");
  };

  const remove = async (c: Category) => {
    const ok = await confirm({
      title: `Remove ${c.name}?`,
      body: "If any transactions, bills or plans use it, it's archived instead: hidden from pickers but kept in your history.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    const outcome = actions.removeCategory(c.id);
    toast(outcome === "archived" ? `${c.name} archived. Its history is kept.` : `${c.name} deleted.`);
  };

  return (
    <section aria-labelledby={`${id}-h`} className="border-t border-paper-400 pt-4">
      <SectionHeading
        id={`${id}-h`}
        title="Categories"
        summary="Where a category sits decides how its spending counts: planned groups use their plan line, flexible ones come out of your daily allowance."
      />
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = data.categories.filter((c) => c.group === g);
          if (items.length === 0) return null;
          return (
            <div key={g}>
              <h3 className="mb-1 font-sans text-sm font-semibold text-ink-700">{GROUP_LABELS[g]}</h3>
              <ul className="divide-y divide-paper-300 border-y border-paper-300">
                {items.map((c) => (
                  <li key={c.id} className="flex min-h-12 items-center gap-2 py-1.5">
                    {editing?.id === c.id ? (
                      <form
                        className="flex flex-1 items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveRename(c);
                        }}
                      >
                        <label htmlFor={`${id}-rn-${c.id}`} className="sr-only">
                          New name for {c.name}
                        </label>
                        <input
                          id={`${id}-rn-${c.id}`}
                          className="field min-h-10 flex-1"
                          autoFocus
                          maxLength={60}
                          value={editing.name}
                          onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                        />
                        <button type="submit" className="btn btn-quiet btn-icon btn-sm" aria-label="Save name" disabled={!editing.name.trim()}>
                          <Check size={16} aria-hidden />
                        </button>
                        <button type="button" className="btn btn-quiet btn-icon btn-sm" aria-label="Cancel rename" onClick={() => setEditing(null)}>
                          <X size={16} aria-hidden />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className={`flex-1 ${c.archived ? "text-ink-600" : ""}`}>
                          {c.name}
                          {c.archived && <span className="ml-2 text-xs">(archived)</span>}
                          {c.system && <span className="ml-2 text-xs text-ink-600">(built in)</span>}
                        </span>
                        {!c.system && !c.archived && (
                          <>
                            <label htmlFor={`${id}-grp-${c.id}`} className="sr-only">
                              Group for {c.name}
                            </label>
                            <select
                              id={`${id}-grp-${c.id}`}
                              className="field min-h-9 w-auto py-1 text-sm"
                              value={c.group}
                              onChange={(e) => {
                                actions.updateCategory(c.id, { group: e.target.value as CategoryGroup });
                                toast(`${c.name} moved to ${GROUP_LABELS[e.target.value as CategoryGroup]}.`);
                              }}
                            >
                              {GROUPS.filter((x) => x !== "income").map((x) => (
                                <option key={x} value={x}>
                                  {GROUP_LABELS[x]}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-quiet btn-icon btn-sm"
                          aria-label={`Rename ${c.name}`}
                          onClick={() => setEditing({ id: c.id, name: c.name })}
                        >
                          <Pencil size={15} aria-hidden />
                        </button>
                        {!c.system &&
                          (c.archived ? (
                            <button
                              type="button"
                              className="btn btn-quiet btn-icon btn-sm"
                              aria-label={`Restore ${c.name}`}
                              onClick={() => {
                                actions.updateCategory(c.id, { archived: false });
                                toast(`${c.name} restored.`);
                              }}
                            >
                              <ArchiveRestore size={15} aria-hidden />
                            </button>
                          ) : (
                            <button type="button" className="btn btn-quiet btn-icon btn-sm" aria-label={`Remove ${c.name}`} onClick={() => remove(c)}>
                              {data.transactions.some((t) => t.categoryId === c.id) ? <Archive size={15} aria-hidden /> : <Trash2 size={15} aria-hidden />}
                            </button>
                          ))}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <form
        className="mt-6 grid gap-3 border border-paper-400 bg-paper-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const name = adding.name.trim();
          if (!name) return;
          if (data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && !c.archived)) {
            toast(`There's already a category called ${name}.`);
            return;
          }
          actions.addCategory({ name, group: adding.group });
          setAdding({ name: "", group: adding.group });
          toast(`${name} added to ${GROUP_LABELS[adding.group]}.`);
        }}
      >
        <Field id={`${id}-new`} label="New category">
          <input id={`${id}-new`} className="field" maxLength={60} placeholder="e.g. Gym, Course fees" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
        </Field>
        <Field id={`${id}-newg`} label="Group">
          <select id={`${id}-newg`} className="field" value={adding.group} onChange={(e) => setAdding({ ...adding, group: e.target.value as CategoryGroup })}>
            {GROUPS.map((x) => (
              <option key={x} value={x}>
                {GROUP_LABELS[x]}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className="btn btn-primary" disabled={!adding.name.trim()}>
          Add category
        </button>
      </form>
    </section>
  );
}

function DataSection() {
  const { data, actions } = useStore();
  const { confirm, toast } = useFeedback();
  const id = useId();
  const stamp = todayISO();

  return (
    <section aria-labelledby={`${id}-h`} className="border-t border-paper-400 pt-4">
      <SectionHeading id={`${id}-h`} title="Your data" />
      <div className="max-w-[62ch] space-y-2 text-[0.9375rem] text-ink-700">
        <p>
          Everything you enter is stored in this browser on this device, in its local storage. Nothing is sent to a server,
          and there&apos;s no account or sync.
        </p>
        <p>
          Clearing your browser&apos;s site data deletes it, and another browser or phone won&apos;t see it. Export a copy now
          and then if it matters to you.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            downloadText(`salarysurvival-transactions-${stamp}.csv`, transactionsToCSV(data), "text/csv");
            toast(`Exported ${data.transactions.length} transactions as CSV.`);
          }}
        >
          <Download size={16} aria-hidden />
          Transactions (CSV)
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            downloadText(`salarysurvival-backup-${stamp}.json`, dataToJSON(data), "application/json");
            toast("Exported everything as JSON.");
          }}
        >
          <Download size={16} aria-hidden />
          Everything (JSON)
        </button>
      </div>

      <div className="mt-8 divide-y divide-paper-300 border-y border-paper-300">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="max-w-[46ch]">
            <p className="font-medium">Load the sample data</p>
            <p className="text-sm text-ink-600">Replaces what&apos;s here with the ₹15,000 example, so you can explore safely.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              const ok = await confirm({
                title: "Replace your data with the sample?",
                body: data.isSample
                  ? "The sample data is reset to how it started."
                  : "Your plan, bills and transactions are replaced by the sample. Export first if you want to keep them.",
                confirmLabel: "Load sample data",
                tone: data.isSample ? "default" : "danger",
              });
              if (ok) {
                actions.resetToSample();
                toast("Sample data loaded.");
              }
            }}
          >
            {data.isSample ? "Reset sample data" : "Load sample data"}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="max-w-[46ch]">
            <p className="font-medium text-red-800">Clear all data</p>
            <p className="text-sm text-ink-600">Deletes your plan, bills, transactions and settings from this browser. This can&apos;t be undone.</p>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              const ok = await confirm({
                title: "Clear all data?",
                body: (
                  <>
                    This permanently deletes {data.transactions.length} transactions, {data.bills.length} bills and every plan from
                    this browser. Export a copy first if you might need it.
                  </>
                ),
                confirmLabel: "Delete everything",
                tone: "danger",
              });
              if (ok) {
                actions.clearAll();
                toast("All data cleared.");
              }
            }}
          >
            <Trash2 size={16} aria-hidden />
            Clear all data
          </button>
        </div>
      </div>
    </section>
  );
}
