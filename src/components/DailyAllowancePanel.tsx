"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { cycleName, getCycle, scheduledPayday, shiftCycleKey, validateNextPayday } from "@/lib/calc/cycle";
import { dayCells, type CycleSummary } from "@/lib/calc/summary";
import { formatWithWeekday } from "@/lib/dates";
import { allowanceCopy } from "@/lib/copy";
import { useStore } from "@/state/store";
import { DayCard } from "./DayCard";
import { Dialog } from "./ui/Dialog";
import { useFeedback } from "./ui/feedback";
import { AmountInput, describedBy, Field } from "./ui/primitives";
import { formatINR, parseAmount } from "@/lib/money";

const amountTone = {
  positive: "text-forest-700",
  critical: "text-red-800",
  neutral: "text-ink-900",
} as const;

export function DailyAllowancePanel({ summary }: { summary: CycleSummary }) {
  const { data, today } = useStore();
  const [paydayOpen, setPaydayOpen] = useState(false);
  const copy = allowanceCopy(summary, today);
  const cells = dayCells(summary, today, data.categories);
  const canChangePayday = summary.timeframe === "current" && summary.state !== "no-plan";

  return (
    <section aria-labelledby="allowance-heading" className="border-y border-paper-400 py-6 sm:py-8">
      <h2 id="allowance-heading" className="sr-only">
        Daily allowance
      </h2>
      <p className="max-w-[24ch] font-serif text-[2rem] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[2.75rem] lg:text-[3.25rem]">
        {copy.lead}
        {copy.amount && (
          <>
            {" "}
            <span className={`tnum whitespace-nowrap ${amountTone[copy.tone]}`}>{copy.amount}</span>
          </>
        )}
        {copy.tail && ` ${copy.tail}`}
      </p>
      <p className="mt-3 max-w-[62ch] text-[0.9375rem] text-ink-700 sm:text-base">
        {copy.detail}{" "}
        {canChangePayday && (
          <button type="button" className="link whitespace-nowrap" onClick={() => setPaydayOpen(true)}>
            Change payday
          </button>
        )}
        {summary.state === "no-plan" && summary.timeframe !== "past" && (
          <Link href="/plan" className="link whitespace-nowrap">
            Set up your plan
          </Link>
        )}
      </p>
      {summary.resolved.source === "starting" && <StartingNote summary={summary} />}
      {summary.state !== "no-plan" && <DayCard summary={summary} cells={cells} />}
      {paydayOpen && <ChangePaydayDialog summary={summary} onClose={() => setPaydayOpen(false)} />}
    </section>
  );
}

function StartingNote({ summary }: { summary: CycleSummary }) {
  const { data, actions } = useStore();
  const { toast } = useFeedback();
  const id = useId();
  const sp = data.startingPoint!;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(sp.amount / 100));
  const [error, setError] = useState<string | undefined>();
  return (
    <div className="mt-2 max-w-[62ch] text-sm text-ink-600">
      Your first cycle runs on the {formatINR(sp.amount)} you had to last from {formatWithWeekday(sp.date)}. Your plan starts in
      full on {formatWithWeekday(summary.cycle.nextPayday)}.{" "}
      <button type="button" className="link" onClick={() => setOpen(true)}>
        Change amount
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Money to last until payday" size="sm">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const r = parseAmount(value, { allowZero: true });
            if (!r.ok) return setError(r.error);
            actions.setStartingPoint({ ...sp, amount: r.value });
            toast("Updated. Your allowance is recalculated.");
            setOpen(false);
          }}
        >
          <Field
            id={`${id}-amt`}
            label={`What you had on ${formatWithWeekday(sp.date)}`}
            error={error}
            hint="Everything recorded since then, and bills still due before payday, comes out of this."
          >
            <AmountInput
              id={`${id}-amt`}
              value={value}
              invalid={Boolean(error)}
              describedById={describedBy(`${id}-amt`, error, true)}
              onChange={(e) => {
                setValue(e.target.value);
                setError(undefined);
              }}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save amount
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function ChangePaydayDialog({ summary, onClose }: { summary: CycleSummary; onClose(): void }) {
  const { data, today, actions } = useStore();
  const { toast } = useFeedback();
  const id = useId();
  const nextKey = shiftCycleKey(summary.cycle.key, 1);
  const usual = scheduledPayday(nextKey, data.settings.schedule, data.settings.weekendRule);
  const hasOverride = Boolean(data.settings.paydayOverrides[nextKey]);
  const [value, setValue] = useState(summary.cycle.nextPayday);
  const [error, setError] = useState<string | undefined>();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateNextPayday(value, getCycle(summary.cycle.key, data.settings), today);
    if (!check.ok) return setError(check.error);
    actions.setNextPayday(summary.cycle.key, value === usual ? null : value);
    toast(`Next payday set to ${formatWithWeekday(value)}.`);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change the next payday"
      size="sm"
      description={`This moves only the payday that starts the ${cycleName(nextKey)}. Your usual schedule stays the same.`}
    >
      <form onSubmit={save} noValidate className="space-y-4">
        <Field
          id={`${id}-date`}
          label="Next payday"
          error={error}
          hint={`Usually ${formatWithWeekday(usual)}. Your allowance is recalculated for the new number of days.`}
        >
          <input
            id={`${id}-date`}
            type="date"
            className="field tnum"
            value={value}
            min={today}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy(`${id}-date`, error, true)}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {hasOverride ? (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                actions.setNextPayday(summary.cycle.key, null);
                toast(`Back to your usual payday, ${formatWithWeekday(usual)}.`);
                onClose();
              }}
            >
              Use usual date
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save payday
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
