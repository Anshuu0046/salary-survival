"use client";

import { Link2, Pencil, Trash2 } from "lucide-react";
import { formatShort, formatWithWeekday } from "@/lib/dates";
import { formatINR, MINUS } from "@/lib/money";
import type { Transaction } from "@/lib/types";
import { useStore } from "@/state/store";

/** Recent activity and the full ledger. Income is marked + and green; expenses − in ink. */
export function TransactionList({
  transactions,
  onEdit,
  onDelete,
  showNotes,
}: {
  transactions: Transaction[];
  onEdit?(t: Transaction): void;
  onDelete?(t: Transaction): void;
  showNotes?: boolean;
}) {
  const { data } = useStore();
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "Uncategorised";

  return (
    <ul className="divide-y divide-paper-300 border-y border-paper-300">
      {transactions.map((t) => {
        const income = t.type === "income";
        return (
          <li key={t.id} className="flex items-start gap-3 py-2.5 sm:items-center sm:gap-4">
            <span className="tnum w-12 shrink-0 pt-0.5 text-[0.8125rem] text-ink-600 sm:pt-0">
              <span className="sr-only">{formatWithWeekday(t.date)}</span>
              <span aria-hidden>{formatShort(t.date)}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.description}</p>
              <p className="flex items-center gap-1.5 truncate text-[0.8125rem] text-ink-600">
                {t.billId && <Link2 size={12} aria-label="Bill payment" className="shrink-0" />}
                {catName(t.categoryId)}
                {showNotes && t.note && <span className="truncate"> · {t.note}</span>}
              </p>
            </div>
            <span className={`tnum shrink-0 pt-0.5 text-right font-semibold sm:pt-0 ${income ? "text-forest-700" : ""}`}>
              <span className="sr-only">{income ? "Money in " : "Money out "}</span>
              {income ? "+" : MINUS}
              {formatINR(t.amount)}
            </span>
            {(onEdit || onDelete) && (
              <div className="-my-1 flex shrink-0 items-center">
                {onEdit && (
                  <button
                    type="button"
                    className="btn btn-quiet btn-icon btn-sm"
                    onClick={() => onEdit(t)}
                    aria-label={`Edit ${t.description}, ${formatShort(t.date)}`}
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="btn btn-quiet btn-icon btn-sm"
                    onClick={() => onDelete(t)}
                    aria-label={`Delete ${t.description}, ${formatShort(t.date)}`}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
