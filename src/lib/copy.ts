import { formatWithWeekday } from "./dates";
import { formatINR } from "./money";
import type { CycleSummary } from "./calc/summary";
import type { BillOccurrence } from "./calc/bills";

/**
 * Sentences built from figures. Kept together so wording stays consistent
 * across pages and can be translated later.
 */

const inr = (p: number) => formatINR(p, { wholeRupees: true });

export function daysPhrase(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

export interface AllowanceCopy {
  /** Parts of the headline sentence; the amount is rendered separately for emphasis. */
  lead: string;
  amount: string | null;
  tail: string;
  detail: string;
  tone: "positive" | "critical" | "neutral";
}

export function allowanceCopy(s: CycleSummary, today: string): AllowanceCopy {
  const payday = formatWithWeekday(s.cycle.nextPayday);
  if (s.timeframe === "past") {
    const left = s.safeToSpend;
    return {
      lead: "This cycle has ended.",
      amount: null,
      tail: "",
      detail:
        left >= 0
          ? `You finished with ${inr(left)} of flexible money unspent.`
          : `You finished ${inr(-left)} past your flexible money.`,
      tone: "neutral",
    };
  }
  if (s.timeframe === "future") {
    return {
      lead: "Your plan allows",
      amount: inr(s.plannedDailyShare),
      tail: "a day in this cycle.",
      detail: `This cycle hasn't started. It begins on ${formatWithWeekday(s.cycle.start)} and runs ${daysPhrase(s.cycle.length)}.`,
      tone: "neutral",
    };
  }
  const isPayday = today === s.cycle.start;
  const when = isPayday
    ? `Salary day. That's for each of the next ${daysPhrase(s.daysLeft)}, until ${payday}.`
    : `Payday is ${payday}: ${daysPhrase(s.daysLeft)} away, counting today.`;
  switch (s.state) {
    case "no-plan":
      return {
        lead: "Add your take-home pay and payday to see what you can spend each day.",
        amount: null,
        tail: "",
        detail: "It takes a minute. Everything else is optional.",
        tone: "neutral",
      };
    case "short":
      return {
        lead: "You're",
        amount: inr(-s.safeToSpend),
        tail: "past your flexible money this cycle.",
        detail: `Any more spending now comes out of money planned for other things. ${when}`,
        tone: "critical",
      };
    case "zero":
      return {
        lead: "Your flexible money for this cycle is used up.",
        amount: null,
        tail: "",
        detail: `Planned categories like food and travel still have their own amounts. ${when}`,
        tone: "neutral",
      };
    case "tight":
      return {
        lead: "You have",
        amount: inr(s.dailyAllowance),
        tail: "a day until payday.",
        detail: `That's under half of the ${inr(s.plannedDailyShare)} a day your plan allows. ${when}`,
        tone: "neutral",
      };
    default:
      return {
        lead: "You have",
        amount: inr(s.dailyAllowance),
        tail: "a day until payday.",
        detail: when,
        tone: "positive",
      };
  }
}

export function billsDueSentence(total: number, count: number): string {
  if (count === 0) return "No bills left to pay before payday.";
  return `${inr(total)} is still due before payday, across ${count === 1 ? "1 bill" : `${count} bills`}.`;
}

export function billStatusLabel(o: BillOccurrence): string {
  switch (o.status) {
    case "paid":
      return "Paid";
    case "overdue":
      return o.daysUntil === -1 ? "Overdue by 1 day" : `Overdue by ${-o.daysUntil} days`;
    case "due-soon":
      return o.daysUntil === 0 ? "Due today" : o.daysUntil === 1 ? "Due tomorrow" : `Due in ${o.daysUntil} days`;
    default:
      return `Due in ${o.daysUntil} days`;
  }
}

export function planBalanceSentence(flexible: number): string {
  if (flexible > 0) return `You have room for ${inr(flexible)} in flexible spending.`;
  if (flexible === 0) return "Every rupee is planned. Nothing is left for flexible spending.";
  return `Your plan is ${inr(-flexible)} over your take-home pay.`;
}
