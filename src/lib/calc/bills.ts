import { addDays, addMonths, diffDays, parts } from "../dates";
import { sum } from "../money";
import type { Bill, ISODate, Paise, Transaction } from "../types";
import type { Cycle } from "./cycle";

/**
 * Bills and their due dates.
 *
 * A bill is a schedule. Each due date is an "occurrence". An occurrence is paid
 * when a transaction is linked to it (billId + billDueDate). The transaction is
 * the only record of the payment, so a paid bill can never be counted twice.
 */

export type BillStatus = "paid" | "overdue" | "due-soon" | "upcoming";

export interface BillOccurrence {
  bill: Bill;
  dueDate: ISODate;
  status: BillStatus;
  /** Days from today to the due date (negative when overdue). */
  daysUntil: number;
  payment?: Transaction;
}

/** Due dates of one bill between two dates, inclusive. Never before the bill's first due date. */
export function billDueDates(bill: Bill, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  if (to < from) return out;
  const anchor = bill.dueDate;
  if (bill.recurrence === "once") {
    if (anchor >= from && anchor <= to) out.push(anchor);
    return out;
  }
  if (bill.recurrence === "every-28-days") {
    const skip = Math.max(0, Math.floor(diffDays(anchor, from) / 28) - 1);
    for (let i = skip; ; i++) {
      const d = addDays(anchor, i * 28);
      if (d > to) break;
      if (d >= from) out.push(d);
    }
    return out;
  }
  const step = bill.recurrence === "monthly" ? 1 : bill.recurrence === "quarterly" ? 3 : 12;
  const anchorDay = parts(anchor).d;
  const a = parts(anchor);
  const f = parts(from);
  const monthsApart = (f.y - a.y) * 12 + (f.m - a.m);
  const skip = Math.max(0, Math.floor(monthsApart / step) - 1);
  for (let i = skip; ; i++) {
    const d = addMonths(anchor, i * step, anchorDay);
    if (d > to) break;
    if (d >= from) out.push(d);
  }
  return out;
}

function paymentKey(billId: string, dueDate: ISODate) {
  return `${billId}|${dueDate}`;
}

export function indexPayments(transactions: Transaction[]): Map<string, Transaction> {
  const map = new Map<string, Transaction>();
  for (const t of transactions) {
    if (t.billId && t.billDueDate) map.set(paymentKey(t.billId, t.billDueDate), t);
  }
  return map;
}

export function statusOf(dueDate: ISODate, today: ISODate, remindDaysBefore: number, paid: boolean): BillStatus {
  if (paid) return "paid";
  const days = diffDays(today, dueDate);
  if (days < 0) return "overdue";
  if (days <= Math.max(0, remindDaysBefore)) return "due-soon";
  return "upcoming";
}

export function billOccurrences(
  bills: Bill[],
  transactions: Transaction[],
  from: ISODate,
  to: ISODate,
  today: ISODate,
): BillOccurrence[] {
  const payments = indexPayments(transactions);
  const out: BillOccurrence[] = [];
  for (const bill of bills) {
    for (const dueDate of billDueDates(bill, from, to)) {
      const payment = payments.get(paymentKey(bill.id, dueDate));
      out.push({
        bill,
        dueDate,
        payment,
        status: statusOf(dueDate, today, bill.remindDaysBefore, Boolean(payment)),
        daysUntil: diffDays(today, dueDate),
      });
    }
  }
  return out.sort((x, y) => (x.dueDate === y.dueDate ? x.bill.name.localeCompare(y.bill.name) : x.dueDate < y.dueDate ? -1 : 1));
}

/**
 * Bill occurrences that belong to a cycle's money:
 * - every due date inside the cycle, and
 * - for the current cycle, anything still unpaid from the previous cycle,
 *   since that money now has to come out of this one.
 */
export function cycleBillOccurrences(
  bills: Bill[],
  transactions: Transaction[],
  cycle: Cycle,
  previousCycleStart: ISODate,
  today: ISODate,
): BillOccurrence[] {
  const isCurrent = today >= cycle.start && today <= cycle.end;
  const inCycle = billOccurrences(bills, transactions, cycle.start, cycle.end, today);
  if (!isCurrent) return inCycle;
  const carried = billOccurrences(bills, transactions, previousCycleStart, addDays(cycle.start, -1), today).filter(
    (o) => o.status === "overdue",
  );
  return [...carried, ...inCycle];
}

export function unpaidTotal(occurrences: BillOccurrence[]): Paise {
  return sum(occurrences.filter((o) => o.status !== "paid").map((o) => o.bill.amount));
}

const STATUS_ORDER: Record<BillStatus, number> = { overdue: 0, "due-soon": 1, upcoming: 2, paid: 3 };

/** Overdue first, then by due date. Used for "next bills" lists. */
export function sortForAttention(occurrences: BillOccurrence[]): BillOccurrence[] {
  return [...occurrences].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0),
  );
}
