import { AlertCircle, CalendarClock, Check, Clock } from "lucide-react";
import type { ReactNode } from "react";
import type { BillStatus } from "@/lib/calc/bills";
import { formatINR, type FormatOptions } from "@/lib/money";

/* ------------------------------------------------------------------ */
/* MoneyAmount                                                         */
/* ------------------------------------------------------------------ */

type Tone = "default" | "positive" | "caution" | "critical" | "muted";

const toneClass: Record<Tone, string> = {
  default: "",
  positive: "text-forest-700",
  caution: "text-amber-800",
  critical: "text-red-800",
  muted: "text-ink-600",
};

export function MoneyAmount({
  value,
  tone = "default",
  className = "",
  ...options
}: { value: number; tone?: Tone; className?: string } & FormatOptions) {
  return <span className={`tnum ${toneClass[tone]} ${className}`}>{formatINR(value, options)}</span>;
}

/* ------------------------------------------------------------------ */
/* Status stamp: colour is always paired with words and an icon.       */
/* ------------------------------------------------------------------ */

const statusStyle: Record<BillStatus, { className: string; icon: typeof Check }> = {
  paid: { className: "text-forest-700", icon: Check },
  overdue: { className: "text-red-800 bg-red-100", icon: AlertCircle },
  "due-soon": { className: "text-amber-800 bg-amber-100", icon: Clock },
  upcoming: { className: "text-ink-600", icon: CalendarClock },
};

export function StatusStamp({ status, children }: { status: BillStatus; children: ReactNode }) {
  const { className, icon: Icon } = statusStyle[status];
  return (
    <span className={`stamp ${className}`}>
      <Icon size={11} strokeWidth={2.5} aria-hidden />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Section heading inside a page                                       */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  id,
  title,
  summary,
  actions,
}: {
  id?: string;
  title: string;
  summary?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="text-[1.3125rem] font-semibold leading-tight">
          {title}
        </h2>
        {summary && <p className="mt-0.5 text-sm text-ink-600">{summary}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-paper-400 px-5 py-7 text-center">
      <p className="font-serif text-lg font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-[46ch] text-sm text-ink-600">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field wrapper                                                       */
/* ------------------------------------------------------------------ */

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className = "",
  optional,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-900">
        {label}
        {optional && <span className="font-normal text-ink-600"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-sm text-red-800">
          <AlertCircle size={14} aria-hidden className="shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria-describedby wiring for an input inside <Field>. */
export function describedBy(id: string, error?: string, hint?: unknown) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

/** Amount input with a fixed ₹ prefix and a numeric keypad on phones. */
export function AmountInput({
  id,
  invalid,
  describedById,
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; invalid?: boolean; describedById?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-600">
        ₹
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        className="field tnum pl-7"
        {...rest}
      />
    </div>
  );
}
