"use client";

import { Plus } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { BillForm } from "@/components/BillForm";
import { BillList, recurrenceLabel } from "@/components/BillList";
import { PageHeader } from "@/components/PageHeader";
import { Dialog } from "@/components/ui/Dialog";
import { useFeedback } from "@/components/ui/feedback";
import { EmptyState, MoneyAmount, SectionHeading } from "@/components/ui/primitives";
import { billDueDates, billOccurrences, type BillOccurrence } from "@/lib/calc/bills";
import { cycleName, getCycle, shiftCycleKey } from "@/lib/calc/cycle";
import { addDays, diffDays, formatShort, formatWithWeekday } from "@/lib/dates";
import { formatINR, sum } from "@/lib/money";
import { daysPhrase } from "@/lib/copy";
import type { Bill } from "@/lib/types";
import { useStore } from "@/state/store";

export default function BillsPage() {
  const { data, today, currentKey, actions } = useStore();
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState<Bill | "new" | null>(null);

  const current = getCycle(currentKey, data.settings);
  const next = getCycle(shiftCycleKey(currentKey, 1), data.settings);
  const prevStart = getCycle(shiftCycleKey(currentKey, -1), data.settings).start;

  const all = useMemo(
    () => billOccurrences(data.bills, data.transactions, prevStart, next.end, today),
    [data.bills, data.transactions, prevStart, next.end, today],
  );

  const overdue = all.filter((o) => o.status === "overdue");
  const dueSoon = all.filter((o) => o.status === "due-soon");
  const later = all.filter((o) => o.status === "upcoming");
  const paidThisCycle = all.filter((o) => o.status === "paid" && o.dueDate >= current.start && o.dueDate <= current.end);

  const thisCycle = all.filter((o) => o.dueDate >= current.start && o.dueDate <= current.end);
  const totalThisCycle = sum(thisCycle.map((o) => (o.payment ? o.payment.amount : o.bill.amount)));
  const unpaidBeforePayday = sum([...overdue, ...thisCycle.filter((o) => o.status !== "paid" && o.status !== "overdue")].map((o) => o.bill.amount));
  const firstWeekAfterPayday = all.filter(
    (o) => o.status !== "paid" && o.dueDate >= next.start && o.dueDate <= addDays(next.start, 6),
  );
  const daysToPayday = diffDays(today, current.nextPayday);

  const onDelete = async (bill: Bill) => {
    const ok = await confirm({
      title: `Delete ${bill.name}?`,
      body: "Future due dates disappear. Payments you've already made stay in your transactions.",
      confirmLabel: "Delete bill",
      tone: "danger",
    });
    if (!ok) return;
    actions.deleteBill(bill.id);
    toast(`${bill.name} deleted.`);
  };

  return (
    <>
      <PageHeader
        title="Bills"
        description="Rent, EMIs, recharges and anything else that repeats. Marking a bill paid records it as a transaction, so it's counted once."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden />
            Add bill
          </button>
        }
      />

      <dl className="grid grid-cols-2 border-y border-paper-400 sm:grid-cols-3 sm:divide-x sm:divide-paper-300">
        <div className="border-b border-paper-300 py-3 pr-3 sm:border-b-0">
          <dt className="label">Bills in the {cycleName(currentKey)}</dt>
          <dd>
            <MoneyAmount value={totalThisCycle} className="text-xl font-semibold sm:text-2xl" />
            <span className="block text-[0.8125rem] text-ink-600">
              {thisCycle.length} due · {paidThisCycle.length} paid
            </span>
          </dd>
        </div>
        <div className="border-b border-paper-300 py-3 pl-3 sm:border-b-0 sm:px-5">
          <dt className="label">Still to pay before payday</dt>
          <dd>
            <MoneyAmount
              value={unpaidBeforePayday}
              tone={overdue.length ? "critical" : unpaidBeforePayday ? "caution" : "default"}
              className="text-xl font-semibold sm:text-2xl"
            />
            <span className="block text-[0.8125rem] text-ink-600">
              {overdue.length ? `Includes ${overdue.length} overdue` : "Comes out of this cycle's money"}
            </span>
          </dd>
        </div>
        <div className="col-span-2 py-3 sm:col-span-1 sm:px-5">
          <dt className="label">Next payday</dt>
          <dd>
            <span className="tnum block text-xl font-semibold sm:text-2xl">{formatWithWeekday(current.nextPayday)}</span>
            <span className="block text-[0.8125rem] text-ink-600">
              In {daysPhrase(daysToPayday)}
              {firstWeekAfterPayday.length > 0 &&
                ` · ${formatINR(sum(firstWeekAfterPayday.map((o) => o.bill.amount)))} due in the week after`}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-10 space-y-10">
        {data.bills.length === 0 ? (
          <EmptyState
            title="No bills yet"
            body="Add the payments that come round every month: rent, EMIs, money you send home, your phone recharge. They'll be flagged here before they're due."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
                Add your first bill
              </button>
            }
          />
        ) : (
          <>
            {overdue.length > 0 && (
              <section aria-labelledby="overdue-h">
                <SectionHeading
                  id="overdue-h"
                  title="Overdue"
                  summary={`${formatINR(sum(overdue.map((o) => o.bill.amount)))} past its due date and not marked paid.`}
                />
                <BillList occurrences={overdue} onEdit={setEditing} onDelete={onDelete} />
              </section>
            )}
            <section aria-labelledby="soon-h">
              <SectionHeading
                id="soon-h"
                title="Due soon"
                summary={
                  dueSoon.length
                    ? `${formatINR(sum(dueSoon.map((o) => o.bill.amount)))} within each bill's reminder window.`
                    : "Nothing due in the next few days."
                }
              />
              {dueSoon.length > 0 && <BillList occurrences={dueSoon} onEdit={setEditing} onDelete={onDelete} />}
            </section>
            <section aria-labelledby="later-h">
              <SectionHeading id="later-h" title="Later" summary={`Up to the end of the ${cycleName(next.key)}.`} />
              {later.length > 0 ? <LaterWithPayday occurrences={later} payday={current.nextPayday} onEdit={setEditing} onDelete={onDelete} /> : (
                <p className="border-y border-paper-300 py-4 text-sm text-ink-600">No other bills before {formatShort(next.end)}.</p>
              )}
            </section>
            {paidThisCycle.length > 0 && (
              <section aria-labelledby="paid-h">
                <SectionHeading id="paid-h" title="Paid this cycle" summary="Undo if you marked one by mistake." />
                <BillList occurrences={paidThisCycle} onEdit={setEditing} />
              </section>
            )}
            <section aria-labelledby="all-h">
              <SectionHeading id="all-h" title="All bills" summary="Each schedule and when it next falls due." />
              <BillSchedules bills={data.bills} onEdit={setEditing} onDelete={onDelete} />
            </section>
          </>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add a bill" : "Edit bill"}
        description={editing === "new" ? "A payment that comes round on a schedule." : undefined}
      >
        {editing !== null && (
          <BillForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => {
              if (editing === "new") {
                actions.addBill(input);
                toast(`${input.name} added.`);
              } else {
                actions.updateBill(editing.id, input);
                toast(`${input.name} saved.`);
              }
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </>
  );
}

/** Upcoming bills with the next payday drawn between them, so it's clear which money pays which bill. */
function LaterWithPayday({
  occurrences,
  payday,
  onEdit,
  onDelete,
}: {
  occurrences: BillOccurrence[];
  payday: string;
  onEdit(b: Bill): void;
  onDelete(b: Bill): void;
}) {
  const before = occurrences.filter((o) => o.dueDate < payday);
  const after = occurrences.filter((o) => o.dueDate >= payday);
  return (
    <div>
      {before.length > 0 && <BillList occurrences={before} onEdit={onEdit} onDelete={onDelete} />}
      <div className="flex items-center gap-3 py-3" role="separator" aria-label={`Payday, ${formatWithWeekday(payday)}`}>
        <span className="stamp text-forest-700">Payday</span>
        <span className="tnum text-sm font-semibold text-forest-700">{formatWithWeekday(payday)}</span>
        <span className="h-px flex-1 bg-forest-300" aria-hidden />
        <span className="text-xs text-ink-600">Below this, paid from the next salary</span>
      </div>
      {after.length > 0 && <BillList occurrences={after} onEdit={onEdit} onDelete={onDelete} />}
    </div>
  );
}

function BillSchedules({ bills, onEdit, onDelete }: { bills: Bill[]; onEdit(b: Bill): void; onDelete(b: Bill): void }) {
  const { data, today } = useStore();
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const rows = bills
    .map((b) => ({ b, next: billDueDates(b, today, addDays(today, 800))[0] }))
    .sort((x, y) => (x.next ?? "9999") < (y.next ?? "9999") ? -1 : 1);
  return (
    <div className="overflow-x-auto border-y border-paper-300">
      <table className="w-full min-w-[34rem] text-[0.9375rem]">
        <thead>
          <tr className="border-b border-paper-300 text-left text-xs text-ink-600">
            <th scope="col" className="py-2 pr-3 font-medium">Bill</th>
            <th scope="col" className="py-2 pr-3 font-medium">Repeats</th>
            <th scope="col" className="py-2 pr-3 font-medium">Next due</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Amount</th>
            <th scope="col" className="py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-paper-300">
          {rows.map(({ b, next }) => (
            <Fragment key={b.id}>
              <tr>
                <td className="py-2.5 pr-3">
                  <span className="font-medium">{b.name}</span>
                  <span className="block text-xs text-ink-600">{catName(b.categoryId)}</span>
                </td>
                <td className="py-2.5 pr-3 text-ink-700">{recurrenceLabel(b.recurrence)}</td>
                <td className="tnum py-2.5 pr-3 text-ink-700">{next ? formatShort(next) : "No more due dates"}</td>
                <td className="tnum py-2.5 pr-3 text-right font-semibold">{formatINR(b.amount)}</td>
                <td className="py-2.5 text-right">
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => onEdit(b)} aria-label={`Edit ${b.name}`}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-quiet btn-sm text-red-800" onClick={() => onDelete(b)} aria-label={`Delete ${b.name}`}>
                    Delete
                  </button>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
