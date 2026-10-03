import type { Paise } from "./types";

/**
 * INR formatting with Indian digit grouping (₹1,00,000).
 * Amounts are integer paise; paise are shown only when the amount has them.
 */

const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const withPaise = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MINUS = "−";

export interface FormatOptions {
  /** Prefix + for positive amounts (for differences). */
  signed?: boolean;
  /** Drop paise and round toward zero. Used for allowances so we never overstate. */
  wholeRupees?: boolean;
  /** Omit the ₹ symbol. */
  bare?: boolean;
}

export function formatINR(paise: Paise, options: FormatOptions = {}): string {
  const value = Number.isFinite(paise) ? Math.trunc(paise) : 0;
  const negative = value < 0;
  const abs = Math.abs(value);
  const rupees = Math.trunc(abs / 100);
  const rest = abs % 100;
  const digits =
    options.wholeRupees || rest === 0 ? whole.format(rupees) : withPaise.format(abs / 100);
  const symbol = options.bare ? "" : "₹";
  const sign = negative ? MINUS : options.signed && value > 0 ? "+" : "";
  return `${sign}${symbol}${digits}`;
}

/** Rupees as a plain input string, e.g. 150050 → "1500.50", 150000 → "1500". */
export function paiseToInput(paise: Paise): string {
  if (!Number.isFinite(paise) || paise === 0) return "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.trunc(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, "0")}`;
}

export type ParseResult = { ok: true; value: Paise } | { ok: false; error: string };

/**
 * Parses what a person types into an amount field: "1,500", "₹ 1500.5", "1,00,000".
 * Rejects negatives, more than two decimal places, and amounts over ₹1 crore.
 */
export function parseAmount(input: string, { allowZero = false } = {}): ParseResult {
  const cleaned = input.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  if (cleaned === "") return { ok: false, error: "Enter an amount." };
  if (cleaned.startsWith("-")) return { ok: false, error: "Enter the amount without a minus sign." };
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) {
    return /^\d+\.\d{3,}$/.test(cleaned)
      ? { ok: false, error: "Use at most two digits after the decimal point." }
      : { ok: false, error: "Enter a number, like 1500 or 1,500.50." };
  }
  const [r, p = ""] = cleaned.split(".") as [string, string?];
  const value = Number(r) * 100 + Number((p ?? "").padEnd(2, "0") || "0");
  if (!allowZero && value === 0) return { ok: false, error: "The amount must be more than ₹0." };
  if (value > 1_00_00_000_00) return { ok: false, error: "That's more than ₹1 crore. Check the amount." };
  return { ok: true, value };
}

/** Integer percentage of part over total, safe for zero totals. */
export function percentOf(part: Paise, total: Paise): number {
  if (total <= 0 || part <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function sum(values: Iterable<number>): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}
