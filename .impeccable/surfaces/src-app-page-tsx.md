---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

# Overview (route `/`)

## Scope and mode

Operate. This is the app's home screen, inside the shared shell: a forest-green rail on desktop and a bottom bar on phones. It is production fidelity and fully working.

The shipped phone bar is Overview, Transactions, a central Add button, Bills, and More (Monthly plan, Scenarios, Settings). Adding a transaction is the daily action, so it takes the thumb slot. The plan is edited about once a cycle.

Brief-pinned header: the user's brief specifies the Overview header as `Greeting such as "Your money, in view."`. Keep it at page-title scale, never display scale. The allowance sentence stays the only display line.

## Job

A first-job earner checks this screen on their phone several times a day. Within seconds it must answer five questions: what came in, what is committed, what is safe to spend, how many days are left until payday, and which bills are next. From here they can mark a bill paid, add a transaction, change the next payday, and switch pay cycles.

## Confirmed decisions

- **Cycle.** A "month" means the pay cycle. It runs from the latest payday on or before today to the day before the next payday, and is named after the month the salary arrives (for example, "October cycle · 7 Oct – 6 Nov").
- **Daily allowance (plan + actual).** Daily allowance = max(0, safe to spend now) ÷ days left, counting today, where:
  - **Money in** = the recorded salary, or the planned take-home marked "expected" if none is recorded yet, plus any extra income.
  - **Flexible** = money in − committed. Committed means fixed costs, variable targets, savings, and sinking funds.
  - **Safe to spend now** = flexible − flexible spending so far − overspend in planned categories. Underspending a planned category never adds to it.
- **Shortfall.** When safe to spend is zero or below, show "₹0 a day" and a plain-language shortfall line. Never show a positive figure.
- **Bills.** Every bill belongs to a plan category. Marking a bill paid creates one linked transaction, so it counts exactly once.

## States to design

- **Allowance:** sample data, normal, tight (under ₹100 a day), zero, short, payday today.
- **Payday:** a past payday rolls forward; a one-off payday override applies to this cycle only.
- **Bills:** paid, due within 7 days, overdue, upcoming, and none due ("Nothing due in the next seven days.").
- **Empty:** no transactions; no plan yet.
- **Data ranges:** 0–40 transactions, 0–12 bills, 3–10 categories, ₹10–₹40,000 amounts, cycles of 28–31 days.

## Direction contract

THESIS: The pay cycle is a milk card of days, like the doodhwala's monthly card. Today's box holds today's allowance, past boxes show what each day took, and payday is stamped at the end. It refuses the category default of KPI tiles in a row with a donut chart.

OWN-WORLD:
- Ground: paper tones from one fixed stepped ramp, with no stray greys.
- Ink: charcoal.
- Navigation rail: a solid forest-green field.
- Status colours: amber only for bills that are due; muted red only for shortfalls and overdue bills. A day over its share is marked with an ink top rule, not amber.
- Type: Clarendon-style serif headings, a legible sans, tabular numerals.
- Structure: ruled cells and rules instead of cards.
- State changes: instant. Paid is a stamp, not a transition.

STORY: The visitor sees how much they can spend today and why. They come to trust it because the working is shown and it never flatters. Then they log a spend or mark a bill paid.

FIRST VIEWPORT:
- Greeting and cycle switcher at the top.
- The daily allowance at headline scale, with the payday date, days left, and "Change payday".
- Directly under it, a full-width strip of day boxes. Desktop shows two rows of 16. Phones show eight columns and four rows of whole boxes, because two rows of 16 would make 22px boxes, below the touch target. There's no sideways scroll at any width. Every box carries its figure: compact on phones ("1.2k", no ₹), full on wider screens. Today's box shows the live allowance.
- Then one ruled row of four figures: take-home, committed, flexible, safe to spend now, with "How this is worked out" expanding inline.
- Primary action: "Add transaction", within thumb reach on phones and in the page header on desktop.

FORM: The Milk Card, candidate 5 of 7 on the grounded list (seed key e2b8668a). The day box is the page's module, and one number (the daily allowance) owns the screen.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved for the build

- **Typefaces.** Candidates are Besley for headings and an Indian-foundry sans with a Devanagari sibling for the interface. The sans qualifies only if it has tabular figures.
- **Day-box interaction.** Spending a box shows must be exactly what the calculation produces: on past days, actual spend against that day's share.
