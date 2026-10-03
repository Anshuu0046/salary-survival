"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { isISODate } from "@/lib/dates";
import { GROUP_LABELS } from "@/lib/defaults";
import { paiseToInput, parseAmount } from "@/lib/money";
import type { Bill, CategoryGroup } from "@/lib/types";
import { useStore, type BillInput } from "@/state/store";
import { AmountInput, describedBy, Field } from "./ui/primitives";

const schema = z.object({
  name: z.string().trim().min(1, "Give the bill a name, like “Rent”.").max(80, "Keep the name under 80 characters."),
  amount: z.string().superRefine((v, ctx) => {
    const r = parseAmount(v);
    if (!r.ok) ctx.addIssue({ code: "custom", message: r.error });
  }),
  categoryId: z.string().min(1, "Choose a category."),
  recurrence: z.enum(["monthly", "every-28-days", "quarterly", "yearly", "once"]),
  dueDate: z.string().min(1, "Pick the due date.").refine(isISODate, "Enter a real date.").refine((d) => d >= "2000-01-01", "That date is too far in the past."),
  remindDaysBefore: z.string(),
  note: z.string().max(500, "Keep the note under 500 characters."),
});

type Values = z.infer<typeof schema>;

const GROUP_ORDER: CategoryGroup[] = ["fixed", "obligations", "variable", "savings", "setAside", "flexible"];

export function BillForm({ initial, onSubmit, onCancel }: { initial?: Bill; onSubmit(input: BillInput): void; onCancel(): void }) {
  const { data, today } = useStore();
  const uid = useId();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: initial?.name ?? "",
      amount: initial ? paiseToInput(initial.amount) : "",
      categoryId: initial?.categoryId ?? "",
      recurrence: initial?.recurrence ?? "monthly",
      dueDate: initial?.dueDate ?? today,
      remindDaysBefore: String(initial?.remindDaysBefore ?? 3),
      note: initial?.note ?? "",
    },
  });
  const recurrence = watch("recurrence");

  const submit = handleSubmit((v) => {
    const amount = parseAmount(v.amount);
    if (!amount.ok) return;
    onSubmit({
      name: v.name.trim(),
      amount: amount.value,
      categoryId: v.categoryId,
      recurrence: v.recurrence,
      dueDate: v.dueDate,
      remindDaysBefore: Number(v.remindDaysBefore),
      note: v.note.trim() || undefined,
    });
  });

  const id = (s: string) => `${uid}-${s}`;
  const groups = GROUP_ORDER.map((g) => ({
    g,
    items: data.categories.filter((c) => c.group === g && (!c.archived || c.id === initial?.categoryId)),
  })).filter((x) => x.items.length);

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id={id("name")} label="Name" error={errors.name?.message}>
        <input
          id={id("name")}
          className="field"
          placeholder="Rent, Phone EMI, Mobile recharge…"
          autoComplete="off"
          autoFocus={!initial}
          aria-invalid={Boolean(errors.name) || undefined}
          aria-describedby={describedBy(id("name"), errors.name?.message)}
          {...register("name")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("amount")} label="Amount" error={errors.amount?.message}>
          <AmountInput
            id={id("amount")}
            placeholder="0"
            invalid={Boolean(errors.amount)}
            describedById={describedBy(id("amount"), errors.amount?.message)}
            {...register("amount")}
          />
        </Field>
        <Field
          id={id("category")}
          label="Category"
          error={errors.categoryId?.message}
          hint="Paying the bill counts against this category's plan line."
        >
          <select
            id={id("category")}
            className="field"
            aria-invalid={Boolean(errors.categoryId) || undefined}
            aria-describedby={describedBy(id("category"), errors.categoryId?.message, true)}
            {...register("categoryId")}
          >
            <option value="">Choose a category</option>
            {groups.map(({ g, items }) => (
              <optgroup key={g} label={GROUP_LABELS[g]}>
                {items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("recurrence")} label="Repeats">
          <select id={id("recurrence")} className="field" {...register("recurrence")}>
            <option value="monthly">Every month</option>
            <option value="every-28-days">Every 28 days (prepaid recharge)</option>
            <option value="quarterly">Every 3 months</option>
            <option value="yearly">Every year</option>
            <option value="once">Just once</option>
          </select>
        </Field>
        <Field
          id={id("due")}
          label={recurrence === "once" ? "Due date" : initial ? "First due date" : "Next due date"}
          error={errors.dueDate?.message}
          hint={recurrence === "once" ? undefined : "It repeats from this date."}
        >
          <input
            id={id("due")}
            type="date"
            className="field tnum"
            aria-invalid={Boolean(errors.dueDate) || undefined}
            aria-describedby={describedBy(id("due"), errors.dueDate?.message, recurrence !== "once")}
            {...register("dueDate")}
          />
        </Field>
      </div>
      <Field
        id={id("remind")}
        label="Flag it as due soon"
        hint="Shown inside SalarySurvival only. Email, SMS and push reminders aren't available."
      >
        <select id={id("remind")} className="field" aria-describedby={`${id("remind")}-hint`} {...register("remindDaysBefore")}>
          <option value="0">On the due date</option>
          <option value="1">1 day before</option>
          <option value="3">3 days before</option>
          <option value="5">5 days before</option>
          <option value="7">7 days before</option>
          <option value="14">14 days before</option>
        </select>
      </Field>
      <Field id={id("note")} label="Note" optional error={errors.note?.message}>
        <textarea id={id("note")} rows={2} className="field resize-y" {...register("note")} />
      </Field>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {initial ? "Save bill" : "Add bill"}
        </button>
      </div>
    </form>
  );
}
