# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Responsive web app. Phone browsers are the primary daily-use context; desktop and tablet must be real layouts, not a stretched or squeezed version of one another.

## Stack

Pinned by the user: Next.js App Router, TypeScript, Tailwind CSS, Recharts (only where a chart genuinely helps), Lucide icons, React Hook Form + Zod for forms and validation. Persistence is browser localStorage behind a data-access layer so a backend can replace it later. Package manager: npm (Node 24). Project root: `Projects/salary-survival`.

## Users

First-job employees in India taking home roughly ₹10,000–₹40,000 a month. Between paydays they balance rent, commuting, food, EMIs, money sent to family, and whatever savings they can manage. Their job is to get from one payday to the next without running short, and to know each day how much they can safely spend.

Everyone is paid a monthly salary on a date they choose (for example the 7th, or the last working day), and they can move the next payday when it shifts. One-off income can be recorded as a transaction, but the product does not model weekly, fortnightly, or irregular pay cycles.

## Product Purpose

SalarySurvival is a daily-use money utility for the stretch between salaries. It answers five questions at a glance: how much came in, how much is already committed, how much can safely be spent, how many days until payday, and which important bills are coming up.

Success means a user opens it daily, trusts the safe-to-spend and daily-allowance figures, and can try a change (a raise, higher rent, an EMI paid off, a planned purchase) before committing to it.

## Positioning

Most expense trackers look backwards at what was spent. SalarySurvival plans forward from payday to payday for small, tight incomes:

- A **daily allowance**: flexible money left, divided by the days until the next salary. It is never shown as a positive number when nothing is actually left.
- A **scenarios** workspace for trying changes to the plan side by side before applying them.

Money sent to family, EMIs, and irregular expenses are treated as normal parts of the plan, not edge cases.

## Operating Context

- People check it quickly on a phone, often one-handed: in the morning, while commuting, or right after spending.
- Monthly rhythm: set or adjust the plan around payday, mark bills paid as they clear, and log transactions as they happen.
- Paydays can fall on any day of the month and can move. Months have different lengths, and a recorded payday may already be in the past.
- Reminders in the MVP are in-app due indicators only. The app must never claim email, SMS, or push reminders exist.

## Capabilities and Constraints

- Sections: Overview, Monthly plan, Transactions, Bills, Scenarios, Settings. All six share one data model and one source of state.
- Currency is fixed to INR, with Indian digit grouping (₹1,00,000) and tabular numerals throughout.
- Interface language is English only for the first release. Use plain English with the Indian terms people already use (salary, EMI, rent, family support). Keep copy centralized so Hindi can be added later.
- Data lives only in the user's browser. Users can export it as CSV or JSON, reset the demo data, and clear everything after a confirmation.
- No AI, no chatbot, no external services, no API keys.
- Calculation rules the product must hold to:
  - A budget target is not a transaction.
  - A paid bill that is also logged as a transaction counts once.
  - Savings are subtracted once.
  - Income is never counted as spending.
  - Planned and actual amounts stay distinct.
  - Negative and zero balances never produce NaN or misleading positive figures.
  - One documented daily-allowance formula, used everywhere.
- First-time users see deterministic sample data that is clearly labeled as sample data and can be edited or replaced. Calculations never depend on hard-coded sample values.
- Every visible control works. No placeholder buttons, dead links, or decorative inputs.

## Brand Commitments

- Name: **SalarySurvival**.
- Voice: human, practical, and never judgmental about spending. Plain statements with real figures ("You have ₹420 a day until payday." "Your plan is ₹800 over your take-home pay."). No motivational slogans or generic SaaS phrasing such as "unlock", "supercharge", "financial journey", or "AI-powered".
- Binding visual constraints from the user: editorial, minimal, warm, and practical. A warm off-white, paper-like background with deep charcoal text. Restrained forest green for positive states and actions, muted amber for upcoming bills and caution, and muted red only for real shortfalls or overdue payments. Strong typography: an editorial heading font paired with a highly legible sans-serif, and tabular numerals for every money amount. Calm, precise, and trustworthy, without imitating any existing finance product.
- Binding layout constraints from the user: mobile-first. Compact, information-dense layouts, with generous whitespace only where it matters. A clear financial hierarchy, useful tables, and restrained charts that earn their place.
- The daily spending allowance until payday is the main interaction. Every screen it appears on must make it immediately understandable.
- Explicitly rejected: generic AI SaaS layouts, generic dashboard templates, purple-blue gradients, glowing blobs, glassmorphism, excessive rounded cards (or cards around every element), emoji icons, generic hero sections, decorative charts, meaningless animation, and fake AI features.
- Standing rule for every review and implementation: preserve functional behavior while improving visual quality.

## Evidence on Hand

None yet. There are no real users, testimonials, usage data, or brand assets. The only data is the demo profile from the brief, and it must always be labeled as sample data:

| | Amount |
|---|---|
| Take-home pay | ₹15,000 |
| Rent | ₹4,000 |
| Family support | ₹2,000 |
| Travel | ₹1,500 |
| Food | ₹3,000 |
| EMI | ₹1,000 |
| Savings target | ₹1,000 |
| Flexible amount left | ₹2,500 |

Do not fabricate testimonials, user counts, security certifications, or claims about bank integrations.

## Product Principles

1. **Understandable at a glance.** The figure that matters today (what is safe to spend) comes before everything else, and the app explains how it was calculated.
2. **Honest numbers over comforting ones.** Show a shortfall plainly instead of an encouraging positive figure. Never confuse account balance with money that is safe to spend.
3. **Built for small, uneven months.** Rent, EMIs, family support, and irregular costs are first-class parts of the plan. A ₹500 decision deserves the same care as a ₹50,000 one.
4. **Decide without shame.** The copy helps people choose. It never scolds them for spending.
5. **Try before committing.** Changes made in scenarios stay temporary until the user explicitly applies them.

## Accessibility & Inclusion

- Every important action works from the keyboard. Use semantic HTML, accessible labels, and visible focus states.
- Money figures and key actions must be visible on a phone without horizontal scrolling. Forms must be easy to complete with one hand.
- Payment status (paid, due soon, overdue, upcoming) must never rely on color alone. Always pair color with text or an icon.
- Write for people who may be new to budgeting. Avoid accounting jargon.
