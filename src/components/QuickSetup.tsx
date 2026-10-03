"use client";

import { useId, useState } from "react";
import { getCycleForDate } from "@/lib/calc/cycle";
import { formatWithWeekday } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import type { PaySchedule, Settings } from "@/lib/types";
import { useStore } from "@/state/store";
import { useFeedback } from "./ui/feedback";
import { AmountInput, describedBy, Field } from "./ui/primitives";

/**
 * The facts needed for a first allowance: take-home pay and payday. Starting
 * partway through a cycle, it also asks what has to last until payday, because
 * the full salary is no longer there to spend.
 */
export function QuickSetup() {
  const { data, today, actions } = useStore();
  const { toast } = useFeedback();
  const id = useId();
  const [amount, setAmount] = useState("");
  const [payday, setPayday] = useState("");
  const [left, setLeft] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; payday?: string; left?: string }>({});

  const schedule: PaySchedule | null =
    payday === "" ? null : payday === "last" ? { kind: "last-working-day" } : { kind: "day-of-month", day: Number(payday) };
  const settings: Settings | null = schedule ? { ...data.settings, schedule, paydayOverrides: {} } : null;
  const cycle = settings ? getCycleForDate(today, settings) : null;
  const midCycle = cycle !== null && today !== cycle.start;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(amount);
    const parsedLeft = parseAmount(left, { allowZero: true });
    const next: typeof errors = {};
    if (!parsed.ok) next.amount = parsed.error;
    if (!schedule) next.payday = "Choose the day your salary usually arrives.";
    if (midCycle && !parsedLeft.ok) next.left = left.trim() ? parsedLeft.error : "Enter what you have until payday, even if it's 0.";
    setErrors(next);
    if (!parsed.ok || !schedule || !cycle || (midCycle && !parsedLeft.ok)) return;
    actions.updateSettings({ schedule, paydayOverrides: {} });
    actions.savePlan(cycle.key, { takeHome: parsed.value, lines: [] });
    actions.setStartingPoint(midCycle && parsedLeft.ok ? { cycleKey: cycle.key, date: today, amount: parsedLeft.value } : null);
    toast("Saved. Add rent and other commitments in your monthly plan for a truer allowance.");
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6 max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-amount`} label="Monthly take-home pay" error={errors.amount} hint="After tax and PF: what reaches your account.">
          <AmountInput
            id={`${id}-amount`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 15,000"
            invalid={Boolean(errors.amount)}
            describedById={describedBy(`${id}-amount`, errors.amount, true)}
          />
        </Field>
        <Field id={`${id}-payday`} label="Salary usually arrives" error={errors.payday}>
          <select
            id={`${id}-payday`}
            className="field"
            value={payday}
            onChange={(e) => setPayday(e.target.value)}
            aria-invalid={Boolean(errors.payday) || undefined}
            aria-describedby={describedBy(`${id}-payday`, errors.payday)}
          >
            <option value="">Choose a day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                On the {ordinal(d)}
              </option>
            ))}
            <option value="last">On the last working day</option>
          </select>
        </Field>
      </div>
      {midCycle && cycle && (
        <Field
          id={`${id}-left`}
          label={`Money you have to last until ${formatWithWeekday(cycle.nextPayday)}`}
          error={errors.left}
          hint="You're partway through this pay cycle, so your full salary isn't there to spend. Everything you pay from today until payday comes out of this, including bills still due. Your plan starts in full on payday."
          className="sm:max-w-[calc(50%-0.5rem)]"
        >
          <AmountInput
            id={`${id}-left`}
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="e.g. 4,000"
            invalid={Boolean(errors.left)}
            describedById={describedBy(`${id}-left`, errors.left, true)}
          />
        </Field>
      )}
      <button type="submit" className="btn btn-primary">
        Show my allowance
      </button>
    </form>
  );
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
