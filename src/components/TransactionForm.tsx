"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { addDays, isISODate } from "@/lib/dates";
import { GROUP_LABELS } from "@/lib/defaults";
import { paiseToInput, parseAmount } from "@/lib/money";
import type { Category, CategoryGroup, Transaction } from "@/lib/types";
import { useStore, type TransactionInput } from "@/state/store";
import { AmountInput, describedBy, Field } from "./ui/primitives";

const GROUP_ORDER: CategoryGroup[] = ["flexible", "variable", "fixed", "obligations", "savings", "setAside", "income"];

function buildSchema(today: string) {
  return z.object({
    type: z.enum(["expense", "income"]),
    amount: z.string().superRefine((v, ctx) => {
      const r = parseAmount(v);
      if (!r.ok) ctx.addIssue({ code: "custom", message: r.error });
    }),
    date: z
      .string()
      .min(1, "Pick a date.")
      .refine(isISODate, "Enter a real date.")
      .refine((d) => d >= "2000-01-01", "That date is too far in the past.")
      .refine((d) => d <= addDays(today, 366), "Dates more than a year ahead aren't allowed."),
    description: z.string().trim().min(1, "Add a short description, like “Groceries”.").max(120, "Keep it under 120 characters."),
    categoryId: z.string().min(1, "Choose a category."),
    note: z.string().max(500, "Keep the note under 500 characters."),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export interface TransactionFormProps {
  initial?: Transaction;
  defaults?: Partial<Pick<Transaction, "type" | "categoryId" | "date" | "description">>;
  onSubmit(input: TransactionInput): void;
  onCancel(): void;
}

export function TransactionForm({ initial, defaults, onSubmit, onCancel }: TransactionFormProps) {
  const { data, today } = useStore();
  const uid = useId();
  const schema = useMemo(() => buildSchema(today), [today]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      type: initial?.type ?? defaults?.type ?? "expense",
      amount: initial ? paiseToInput(initial.amount) : "",
      date: initial?.date ?? defaults?.date ?? today,
      description: initial?.description ?? defaults?.description ?? "",
      categoryId: initial?.categoryId ?? defaults?.categoryId ?? "",
      note: initial?.note ?? "",
    },
  });

  const type = useWatch({ control, name: "type" });
  const categoryId = useWatch({ control, name: "categoryId" });

  const options = useMemo(() => {
    const visible = data.categories.filter(
      (c) => (type === "income" ? c.group === "income" : c.group !== "income") && (!c.archived || c.id === initial?.categoryId),
    );
    const groups = new Map<CategoryGroup, Category[]>();
    for (const c of visible) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({ group: g, items: groups.get(g)! }));
  }, [data.categories, type, initial?.categoryId]);

  // Keep the category consistent with the type.
  useEffect(() => {
    const valid = options.some((o) => o.items.some((c) => c.id === categoryId));
    if (!valid) setValue("categoryId", type === "income" ? "salary" : "", { shouldValidate: false });
  }, [type, options, categoryId, setValue]);

  const submit = handleSubmit((v) => {
    const amount = parseAmount(v.amount);
    if (!amount.ok) return;
    onSubmit({
      type: v.type,
      amount: amount.value,
      date: v.date,
      description: v.description.trim(),
      categoryId: v.categoryId,
      note: v.note.trim() || undefined,
      billId: initial?.billId,
      billDueDate: initial?.billDueDate,
    });
  });

  const ids = {
    amount: `${uid}-amount`,
    date: `${uid}-date`,
    description: `${uid}-description`,
    category: `${uid}-category`,
    note: `${uid}-note`,
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className="sr-only">Type</legend>
        <div className="grid grid-cols-2 rounded-[var(--radius-sm)] border border-paper-400 bg-paper-200 p-0.5">
          {(["expense", "income"] as const).map((t) => (
            <label
              key={t}
              className={`flex min-h-10 cursor-pointer items-center justify-center rounded-[var(--radius-xs)] text-[0.9375rem] font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest-600 ${
                type === t ? "bg-paper-50 text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
              }`}
            >
              <input type="radio" value={t} className="sr-only" {...register("type")} />
              {t === "expense" ? "Money out" : "Money in"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_11rem]">
        <Field id={ids.amount} label="Amount" error={errors.amount?.message}>
          <AmountInput
            id={ids.amount}
            placeholder="0"
            invalid={Boolean(errors.amount)}
            describedById={describedBy(ids.amount, errors.amount?.message)}
            autoFocus={!initial}
            {...register("amount")}
          />
        </Field>
        <Field id={ids.date} label="Date" error={errors.date?.message}>
          <input
            id={ids.date}
            type="date"
            className="field tnum"
            aria-invalid={Boolean(errors.date) || undefined}
            aria-describedby={describedBy(ids.date, errors.date?.message)}
            {...register("date")}
          />
        </Field>
      </div>

      <Field id={ids.description} label="Description" error={errors.description?.message}>
        <input
          id={ids.description}
          className="field"
          placeholder={type === "income" ? "Salary, tuition, refund…" : "Groceries, auto, recharge…"}
          autoComplete="off"
          aria-invalid={Boolean(errors.description) || undefined}
          aria-describedby={describedBy(ids.description, errors.description?.message)}
          {...register("description")}
        />
      </Field>

      <Field
        id={ids.category}
        label="Category"
        error={errors.categoryId?.message}
        hint={
          type === "expense"
            ? "Flexible categories come out of your daily allowance. Planned ones count against their plan line."
            : undefined
        }
      >
        <select
          id={ids.category}
          className="field"
          aria-invalid={Boolean(errors.categoryId) || undefined}
          aria-describedby={describedBy(ids.category, errors.categoryId?.message, type === "expense")}
          {...register("categoryId")}
        >
          <option value="">Choose a category</option>
          {options.map((o) => (
            <optgroup key={o.group} label={GROUP_LABELS[o.group]}>
              {o.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.archived ? " (archived)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field id={ids.note} label="Note" optional error={errors.note?.message}>
        <textarea id={ids.note} rows={2} className="field resize-y" {...register("note")} />
      </Field>

      {initial?.billId && (
        <p className="text-sm text-ink-600">This is the payment for a bill. Deleting it marks that bill unpaid again.</p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {initial ? "Save changes" : type === "income" ? "Add money in" : "Add money out"}
        </button>
      </div>
    </form>
  );
}
