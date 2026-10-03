"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { BillOccurrence } from "@/lib/calc/bills";
import { billStatusLabel } from "@/lib/copy";
import { formatShort, formatWithWeekday, parts } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { Bill } from "@/lib/types";
import { useStore } from "@/state/store";
import { useFeedback } from "./ui/feedback";
import { MoneyAmount, StatusStamp } from "./ui/primitives";

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

const RECURRENCE_LABEL: Record<Bill["recurrence"], string> = {
  monthly: "Monthly",
  "every-28-days": "Every 28 days",
  quarterly: "Every 3 months",
  yearly: "Yearly",
  once: "One time",
};

export function recurrenceLabel(r: Bill["recurrence"]) {
  return RECURRENCE_LABEL[r];
}

/** Bill occurrences in date order, each with a direct way to mark it paid. */
export function BillList({
  occurrences,
  onEdit,
  onDelete,
  compact,
}: {
  occurrences: BillOccurrence[];
  onEdit?(bill: Bill): void;
  onDelete?(bill: Bill): void;
  compact?: boolean;
}) {
  const { data, today, actions } = useStore();
  const { toast } = useFeedback();
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "Uncategorised";

  return (
    <ul className="divide-y divide-paper-300 border-y border-paper-300">
      {occurrences.map((o) => {
        const { d } = parts(o.dueDate);
        const paid = o.status === "paid";
        const key = `${o.bill.id}|${o.dueDate}`;
        return (
          <li key={key} className="flex items-center gap-3 py-3 sm:gap-4">
            <div
              className={`flex w-11 shrink-0 flex-col items-center border py-1 leading-none ${
                o.status === "overdue"
                  ? "border-red-600 text-red-800"
                  : o.status === "due-soon"
                    ? "border-amber-600 text-amber-800"
                    : "border-paper-400 text-ink-700"
              }`}
              aria-hidden
            >
              <span className="tnum font-serif text-lg font-semibold">{d}</span>
              <span className="text-[0.625rem] uppercase tracking-wider">{MONTH.format(Date.parse(`${o.dueDate}T00:00:00Z`))}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`truncate font-medium ${paid ? "text-ink-600" : ""}`}>{o.bill.name}</span>
                <StatusStamp status={o.status}>{billStatusLabel(o)}</StatusStamp>
              </p>
              <p className="mt-0.5 truncate text-[0.8125rem] text-ink-600">
                <span className="sr-only">Due {formatWithWeekday(o.dueDate)}. </span>
                {catName(o.bill.categoryId)}
                {!compact && ` · ${recurrenceLabel(o.bill.recurrence)}`}
                {paid && o.payment && ` · paid ${formatShort(o.payment.date)}`}
              </p>
            </div>
            <MoneyAmount
              value={paid && o.payment ? o.payment.amount : o.bill.amount}
              className={`shrink-0 text-right font-semibold ${paid ? "text-ink-600 line-through decoration-paper-500" : ""}`}
            />
            <div className="flex shrink-0 items-center gap-1">
              {paid ? (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => {
                    actions.unmarkBillPaid(o.bill.id, o.dueDate);
                    toast(`${o.bill.name} marked unpaid.`);
                  }}
                  aria-label={`Mark ${o.bill.name} due ${formatShort(o.dueDate)} as unpaid`}
                >
                  Undo
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    // The payment is recorded on the day it's marked, which is when the money left.
                    actions.markBillPaid(o.bill.id, o.dueDate, today);
                    toast(`${o.bill.name} paid: ${formatINR(o.bill.amount)}. Recorded as a transaction.`, {
                      label: "Undo",
                      onClick: () => actions.unmarkBillPaid(o.bill.id, o.dueDate),
                    });
                  }}
                  aria-label={`Mark ${o.bill.name} due ${formatShort(o.dueDate)} as paid`}
                >
                  Mark paid
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  className="btn btn-quiet btn-icon btn-sm"
                  onClick={() => onEdit(o.bill)}
                  aria-label={`Edit ${o.bill.name}`}
                >
                  <Pencil size={15} aria-hidden />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="btn btn-quiet btn-icon btn-sm"
                  onClick={() => onDelete(o.bill)}
                  aria-label={`Delete ${o.bill.name}`}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
