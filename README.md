# SalarySurvival

Plan your money from payday to payday. SalarySurvival is a salary planner for first-job earners in India taking home roughly ₹10,000–₹40,000 a month. It shows what came in, what's already committed, what's safe to spend, how many days until payday, and which bills are coming up. Its main figure is a **daily allowance**: flexible money left, divided by the days until your next salary.

It runs entirely in the browser. There's no account, no server and no AI.

## Getting started

Requires Node 20+ (developed on Node 24) and npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

On first visit the app loads a **sample profile** (₹15,000 take-home, paid on the 7th). A band at the top of every page labels it as sample data, with options to start fresh or keep it as your own.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (includes the TypeScript check) |
| `npm start` | Serve the production build |
| `npm test` | Unit tests for the calculation and storage layers (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |

## Pages

- **Overview**: the daily allowance as a sentence ("You have ₹208 a day until payday."), the *day card* (one box per day of the pay cycle), the cycle in four figures with the full working one click away, bills before payday with mark-paid, spending by category, and recent activity.
- **Monthly plan**: take-home pay, payday, and five sections: fixed costs, family & EMIs, everyday spending, savings, and set-asides for irregular costs. Each section shows its subtotal and what's left after it. A live allocation bar shows how the plan uses your take-home pay. Lines can be added, removed and reordered, and you can create custom categories. Blank lines are skipped, so you don't have to fill in every category.
- **Transactions**: an add/edit/delete ledger with search, filters (cycle or all time, type, category, bill payments), money-in/out totals, and confirmation and undo for deletes.
- **Bills**: monthly, every-28-days (prepaid recharge), quarterly, yearly and one-time bills. They're grouped into overdue, due soon, later and paid, with the next payday drawn between them. Each bill also has a schedule table. Mark-paid creates the payment transaction.
- **Scenarios**: try a raise, a rent change, extra savings, an EMI paid off or a planned purchase against your plan. "Now" sits beside "with changes", with the difference. Nothing is saved until you choose *Apply*.
- **Settings**: name, salary schedule (day of month or last working day, plus a weekend rule), categories (rename, regroup, archive, add), INR display, CSV/JSON export, load or reset sample data, and clear all data.

## Architecture

```
src/
  lib/                 framework-free logic, unit tested
    types.ts           data model
    dates.ts           calendar-date maths (UTC-safe ISO dates)
    money.ts           INR formatting (en-IN grouping), amount parsing
    calc/
      cycle.ts         pay cycles, paydays, weekend rules, days left
      plan.ts          plan resolution (carry-forward), totals, running remainders
      bills.ts         due dates per recurrence, paid/overdue/due-soon status
      summary.ts       THE cycle summary: money in, committed, safe to spend, allowance, day card, breakdown
      scenario.ts      plan-vs-adjusted comparison, purchase affordability
      calc.test.ts     61 tests
    storage.ts         DataRepository interface + localStorage implementation + record-level validation (Zod)
    sample.ts          deterministic sample profile
    copy.ts            sentences built from figures (allowance, bill status, plan balance)
    export.ts          CSV / JSON export
  state/store.tsx      React context: one AppData, actions, persistence, "today", selected cycle
  components/          AppShell, DayCard, DailyAllowancePanel, CycleFigures, BillList, TransactionForm, …
  app/                 Next.js App Router pages (/, /plan, /transactions, /bills, /scenarios, /settings)
```

Business rules live in `src/lib` and know nothing about React. Components never touch `localStorage`: they go through `DataRepository`, so a server-backed repository can replace `createLocalStorageRepository()` without UI changes.

Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, React Hook Form + Zod, Lucide icons, Vitest. Recharts was considered and left out. The only charts are a spending bar per category and the plan's allocation bar, and both are plain HTML. A chart library added nothing.

## Data model

All money is stored as **integer paise** (₹1 = 100). Dates are local calendar dates stored as `YYYY-MM-DD`. See `src/lib/types.ts`.

- `Settings`: name, `schedule` (`day-of-month` 1–31 or `last-working-day`), `weekendRule`, and one-off `paydayOverrides` keyed by cycle.
- `Category`: id, name, `group` (`fixed`, `obligations`, `variable`, `savings`, `setAside`, `flexible` or `income`), and `archived`/`system` flags.
- `Plan` per cycle key: `takeHome` plus ordered `lines` (category, amount, optional label, `oneOff`).
- `Transaction`: income or expense, amount, date, description, category, note. Bill payments also carry `billId` and `billDueDate`.
- `Bill`: name, amount, category, `recurrence`, first `dueDate`, `remindDaysBefore`, note.
- `StartingPoint` (optional): when someone starts partway through a cycle.

## Calculation rules

**Pay cycle.** A cycle starts on a payday and ends the day before the next one. It's named after the month the salary arrives: a salary on 7 October opens the "October cycle" (7 Oct – 6 Nov). A payday on the 29th–31st moves to the last day in shorter months. Weekend paydays follow your rule (Friday before, Monday after, or as-is). "Change payday" moves only the next payday. Nothing assumes you're paid on the 1st, and cycle dates aren't shown until you've set your payday.

**Plans carry forward.** A cycle without its own plan uses the most recent earlier plan, minus one-off lines. Saving the plan for a cycle applies from that cycle on.

**The daily allowance** (`src/lib/calc/summary.ts`, one formula used everywhere):

```
money in          = salary recorded this cycle
                    (or the planned take-home, marked "expected", until one is recorded)
                    + other income recorded this cycle
committed         = everything in the plan: fixed costs, family & EMIs,
                    everyday targets, savings, set-asides
flexible          = money in − committed
safe to spend now = flexible
                    − flexible-category spending so far
                    − flexible-category bills still due this cycle
                    − overruns: per planned category, max(0, spent + bills still due − planned)
daily allowance   = max(0, safe to spend) ÷ days until payday (counting today), rounded down to whole rupees
```

It uses **plan and actuals together**: the plan sets the budget, and recorded spending and unpaid bills adjust it.

- **No double counting.** A budget target is never a transaction. Income is never spending. Savings count once, inside "committed": a savings transfer up to the planned amount doesn't reduce safe-to-spend again.
- **Paid bills count once.** A bill is paid only through its linked transaction. Once paid, that transaction is the actual and the bill stops counting as "still due".
- **Underspending doesn't add to the allowance.** Spending less than planned in a category leaves that money in the category, because it may still be needed before payday.
- **Unpaid bills from the previous cycle** carry into the current one as overdue.
- **Shortfalls are shown plainly.** When safe-to-spend is zero or negative, the allowance shows ₹0 and the headline names the shortfall ("You're ₹800 past your flexible money this cycle."). It's never a misleading positive number, and never NaN.
- **"Tight"** means the allowance has fallen below half of the plan's own daily share, not a fixed rupee figure.
- **Safe to spend is not your bank balance.** The UI says so.
- **Starting partway through a cycle.** If you set up mid-cycle, the setup asks what you have to last until payday. That first cycle runs on that amount from that day: nothing is pre-committed, and earlier transactions and bills are ignored. The full plan starts on the next payday. Without this, a new user would get their whole salary spread over the few days left.

**Scenarios** compare plans only: daily share = flexible ÷ days in the cycle. They don't predict interest, investment returns or loan payoff dates.

## Persistence and safety

- Data is saved to `localStorage` under `salarysurvival:data:v1` after every change.
- On load, every record is validated on its own. Malformed records are dropped and the rest is kept, with a notice saying how many were skipped. Unreadable JSON is copied to a backup key before sample data is shown. Corrupted storage can't crash the app.
- Destructive actions (delete a transaction or bill, discard plan changes, load sample over your data, clear all) ask for confirmation. Adding a transaction and marking a bill paid offer Undo.

## Accessibility

Built with semantic landmarks and headings, labelled inputs with linked error messages, native `<dialog>` for modals (focus is trapped, Escape closes), visible focus rings, and arrow-key navigation across the day card. Every status pairs colour with words and an icon. Money uses tabular numerals throughout. Touch targets grow on coarse pointers, and the phone layout has a bottom bar with a central Add button.

## Design

Covered in `PRODUCT.md` (product context) and `DESIGN.md` (visual system, written from the built app). Fonts: **Besley** for headings and **Anek Latin** (Ek Type, which also makes a Devanagari sibling) for the interface and figures. Both have true tabular figures. Besley has no ₹ glyph, so Anek supplies it in headings.

## Current MVP limitations

- **Single device.** Data lives in one browser. There's no sync, backup service or account. Use JSON export for a copy. (There's no import yet.)
- **No real reminders.** "Due soon" is an in-app flag only. No email, SMS or push notifications are sent.
- **Monthly salary only.** One salary a month on a chosen day. Weekly, fortnightly or irregular pay cycles aren't modelled. One-off income can be recorded as a transaction.
- **INR and English only.** Copy that's built from figures is centralised in `src/lib/copy.ts`. Static interface labels still live in the components, so translation would need more work.
- **Plans per cycle, not per category over time.** Editing a carried-forward plan saves a new plan from that cycle on. Past cycles keep the plan they had.
- **Editing a recurring bill's first due date** can detach earlier payments from their occurrences. Those payments stay as ordinary transactions.
- **No bank import** or SMS parsing. Everything is entered by hand.
- **Light theme only.**
