---
name: SalarySurvival
description: A pay cycle drawn as a milk card of days, on warm paper, with one honest number per day.
colors:
  paper-50: "#fcfaf4"
  paper-100: "#f6f2e7"
  paper-200: "#eee8d9"
  paper-300: "#e2dac7"
  paper-400: "#cbc0a8"
  paper-500: "#a3987f"
  ink-600: "#645e50"
  ink-700: "#4a463c"
  ink-900: "#22221e"
  forest-50: "#edf2eb"
  forest-100: "#dce7da"
  forest-200: "#bcd2bd"
  forest-300: "#9fbca4"
  forest-600: "#2a6446"
  forest-700: "#1f5137"
  forest-800: "#1a442e"
  forest-900: "#153826"
  rail-muted: "#b6ccbb"
  amber-100: "#f5e6c6"
  amber-200: "#ecd29c"
  amber-600: "#a9741c"
  amber-800: "#74490b"
  red-100: "#f4dcd5"
  red-600: "#a33b2d"
  red-800: "#862a1e"
typography:
  display:
    fontFamily: "Besley, Anek Latin, Georgia, serif"
    fontSize: "3.25rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Besley, Anek Latin, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Besley, Anek Latin, Georgia, serif"
    fontSize: "1.3125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  body:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  stamp:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 640
    lineHeight: "1rem"
    letterSpacing: "0.06em"
rounded:
  none: "0px"
  xs: "2px"
  sm: "3px"
spacing:
  hairline: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.forest-700}"
    textColor: "{colors.paper-50}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.forest-800}"
  button-secondary:
    backgroundColor: "{colors.paper-50}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-200}"
  button-quiet:
    textColor: "{colors.ink-900}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.red-600}"
    textColor: "{colors.paper-50}"
    rounded: "{rounded.sm}"
    padding: "0 15px"
    height: "40px"
  button-danger-hover:
    backgroundColor: "{colors.red-800}"
  field:
    backgroundColor: "{colors.paper-50}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "44px"
  stamp-due:
    backgroundColor: "{colors.amber-100}"
    textColor: "{colors.amber-800}"
    typography: "{typography.stamp}"
    rounded: "{rounded.xs}"
    padding: "2px 6px 2px"
  stamp-overdue:
    backgroundColor: "{colors.red-100}"
    textColor: "{colors.red-800}"
    typography: "{typography.stamp}"
    rounded: "{rounded.xs}"
    padding: "2px 6px 2px"
  stamp-paid:
    textColor: "{colors.forest-700}"
    typography: "{typography.stamp}"
    rounded: "{rounded.xs}"
    padding: "2px 6px 2px"
  nav-rail:
    backgroundColor: "{colors.forest-900}"
    textColor: "{colors.paper-100}"
    width: "240px"
  nav-rail-item-active:
    backgroundColor: "{colors.paper-100}"
    textColor: "{colors.forest-900}"
    rounded: "{rounded.sm}"
    height: "40px"
  nav-bar-mobile:
    backgroundColor: "{colors.paper-50}"
    textColor: "{colors.ink-600}"
    height: "56px"
  day-box:
    backgroundColor: "{colors.paper-100}"
    textColor: "{colors.ink-600}"
    rounded: "{rounded.none}"
    padding: "6px"
  day-box-today:
    backgroundColor: "{colors.forest-700}"
    textColor: "{colors.paper-50}"
  day-box-ahead:
    backgroundColor: "{colors.paper-50}"
  toast:
    backgroundColor: "{colors.ink-900}"
    textColor: "{colors.paper-50}"
    rounded: "{rounded.sm}"
    padding: "10px 8px 10px 14px"
---

# Design System: SalarySurvival

## Overview

**Creative North Star: "The Milk Card"**

The pay cycle is drawn the way a doodhwala's monthly card is: a ruled grid of day boxes, each holding what that day took, today's box filled solid, and payday rubber-stamped at the end. Everything else in the system is ruled paper around that card. Surfaces are one warm paper ramp, text is charcoal ink, and a solid forest-green field holds the navigation like the cover of a ledger. The single loudest element on any screen that carries it is the daily-allowance sentence, set in a Clarendon-style serif with the rupee figure coloured inline.

Density is high but calm. Information sits in ruled rows and ruled cells rather than cards; a hairline in the paper ramp does the work that a box and a shadow would do elsewhere. Money is always set in tabular lining figures so columns line up. State changes are instant: a paid bill gets a stamp, not an animation.

The system rejects the category default of KPI tiles in a row with a donut chart, and the product's confirmed rejections apply: no purple-blue gradients, glowing blobs, glassmorphism, rounded cards around every element, emoji icons, or decorative charts.

**Key Characteristics:**
- One stepped paper ramp supplies every neutral; no stray greys.
- Forest green owns navigation, primary action, and "inside the plan".
- Amber and red are status colours, rationed.
- Ruled rows and ruled cells instead of cards; square or near-square corners (0-3px).
- Besley serif for headings and the allowance sentence; Anek Latin for UI and every figure.
- Tabular lining numerals on all money.

## Colors

A warm paper-and-ink palette with one forest green and two rationed status hues.

### Primary
- **Ledger Forest** (forest-700): primary buttons, the central Add button on phones, today's day box, links, positive money figures, the payday stamp.
- **Ledger Cover** (forest-900): the solid navigation rail on desktop and the slim header bar on phones; also the browser theme colour.
- **Forest Deep** (forest-800): hover for forest surfaces; rail divider and rail item hover.
- **Focus Forest** (forest-600): every focus ring (2px outline, 2px offset), the "nothing spent" tick, planned-category progress bars.
- **Spent Wash** (forest-100): the fill rising inside past day boxes to show spend against the day's share.
- **Pale Forest** (forest-200, forest-300, forest-50): text selection, link underline colour, toast action text and icon; forest-50 is defined but rarely reached.
- **Rail Muted** (rail-muted): secondary text on the forest rail only.

### Secondary
- **Due Amber** (amber-600 rule, amber-800 text, amber-100 ground): bills that are due. It appears as the corner notch on a day box with an unpaid bill, the border of a bill's date block, and the "Due in N days" stamp.

### Tertiary
- **Shortfall Red** (red-600 rule, red-800 text, red-100 ground): genuine shortfalls (a negative flexible or safe-to-spend figure, a purchase the plan cannot afford) and overdue bills. The build also uses it for the system's own failure and destruction states: field validation errors, the save-failed notice, and the danger button in a destructive confirmation.

### Neutral
- **Paper** (paper-100): the page ground.
- **Fresh Paper** (paper-50): raised working surfaces: fields, secondary buttons, the phone bottom bar, dialogs, days still ahead on the card, worksheet panels at desktop width.
- **Worn Paper** (paper-200): hover for quiet and secondary controls, the sample-data band, days before tracking began, empty progress tracks.
- **Hairline** (paper-300): row dividers and section rules inside content.
- **Card Rule** (paper-400): the day-grid lines, field and secondary-button borders, structural section rules (above and below the allowance block, under the figures row).
- **Faded Rule** (paper-500): field hover border, the set-aside segment of the allocation bar, strike-through colour on paid amounts.
- **Charcoal Ink** (ink-900): body text and headings, the over-share top rule on day boxes, the toast ground.
- **Soft Ink** (ink-700): secondary running text and explanatory paragraphs.
- **Pencil** (ink-600): labels, captions, metadata, placeholder text, inactive mobile tabs.

### Named Rules
**The One Ramp Rule.** Every neutral comes from paper-50 to paper-500 or ink-600 to ink-900. A grey from outside these steps is a defect.

**The Amber Is For Bills Rule.** Amber marks a bill that needs paying and nothing else. A day that went over its share is not amber; it gets a 2px charcoal top rule over its spent fill.

**The Red Means Short Rule.** Red marks money that is genuinely short, a bill that is overdue, or the system failing or destroying something. Never use red to mean "less than before" or "worse than the alternative".

**The Colour Plus Words Rule.** Status colour is never alone: every stamp carries a Lucide icon and words, every day-box notch is backed by the box's accessible description, and every over-share mark appears in the key.

## Typography

**Display Font:** Besley (with Anek Latin, then Georgia, serif)
**Body Font:** Anek Latin, variable with the wdth axis loaded (with Segoe UI, system-ui, sans-serif)

**Character:** A sturdy Clarendon-style serif gives headings the weight of a printed card; a clear Indian-foundry sans carries every control and every number. Besley has no ₹ glyph, so the serif stack deliberately falls through to Anek Latin for the rupee sign, keeping it identical in headings and in the UI.

### Hierarchy
- **Display** (Besley 600, 2rem phones / 2.75rem from 640px / 3.25rem from 1024px, line-height 1.08, -0.02em, max 24ch): the daily-allowance sentence only. One per screen.
- **Headline** (Besley 600, 1.875rem phones / 2.25rem from 640px, line-height 1.1): page titles in the page header, including the Overview greeting. Never display scale.
- **Title** (Besley 600, 1.3125rem, line-height 1.25): section headings, scenario fieldset legends; 1.25rem in dialog headers; 1.125rem for empty-state titles and verdict lines.
- **Figure** (Anek Latin 600, 1.5rem phones / 1.75rem from 640px, tabular): the four cycle figures and other summary amounts.
- **Body** (Anek Latin 400, 1rem, line-height 1.5): default text. Explanatory text sits at 0.9375rem in ink-700, held to 60-62ch.
- **Label** (Anek Latin 400, 0.8125rem, line-height 1.25rem, Pencil): the name above a figure, row metadata, captions. Sentence case.
- **Stamp** (Anek Latin 640, 0.6875rem, 0.06em tracking, uppercase): status stamps only.
- **Controls** (Anek Latin 560, 0.9375rem; 0.875rem small): buttons and text links.

Headings h1-h3 use `text-wrap: balance` and -0.01em tracking.

### Named Rules
**The Tabular Money Rule.** Every money amount, date numeral, and percentage in a column is set with tabular lining figures. A rupee amount in proportional figures is a defect.

**The One Big Number Rule.** Display scale belongs to the allowance sentence. Page titles stay at headline scale even when the page has nothing larger.

## Layout

Mobile-first, in a single centred column capped at 72rem, with 16px side padding on phones and 32px from 640px. Content starts 24px below the header on phones and 40px on desktop; the bottom of the page leaves 112px on phones so the fixed bar never covers content.

**Shell.** From 1024px a fixed 240px forest rail sits on the left and content is offset by it. Below 1024px the rail becomes a 48px forest header bar carrying the wordmark, and navigation moves to a fixed paper-50 bottom bar (56px tall, safe-area aware): Overview, Transactions, a central 48px forest Add button, Bills, and More (a sheet holding Monthly plan, Scenarios, Settings).

**The day grid.** Eight columns on phones (boxes about 44px, square, never below 40px), 16 columns from 640px (5:6 boxes). The grid never scrolls sideways. Phones show compact figures without ₹ ("1.2k"); wider screens show the full amount. The payday stamp occupies the cell after the last day.

**The figures row.** Two columns on phones (a ruled 2x2), four from 640px divided by vertical hairlines.

**Two-column pages.** From 1024px, Overview places Bills and Recent activity beside Where it went; Plan and Scenarios place the form left and a worksheet panel right.

**Spacing rhythm.** A 4px base. Rows breathe at 10-12px vertical padding; section blocks at 24px (32px from 640px); gaps between controls at 8px; page-header margin 24px (32px desktop).

## Elevation & Depth

The system is flat. Depth is carried by ruled lines and by the paper ramp: paper-50 sits "above" paper-100, and paper-200 sits "below". Shadows appear only on things that genuinely float over the page.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 18px 40px -16px rgb(34 34 30 / 0.28), 0 2px 6px -2px rgb(34 34 30 / 0.12)`): dialogs, bottom sheets, and toasts. Nothing that sits in the page flow.
- **Backdrop** (`rgb(34 34 30 / 0.38)`): behind modal dialogs.

### Named Rules
**The Paper Doesn't Float Rule.** In-flow content never carries a shadow. If something needs separation, give it a rule or step it one paper tone.

## Shapes

Corners are square or nearly so. Day boxes, rows, worksheet panels, progress bars, and the empty-state frame are square (0px). Controls (buttons, fields, rail items, dialogs, toasts) take a barely softened 3px corner; stamps, focus rings, and tiny inline targets take 2px. Nothing is pill-shaped or generously rounded.

Lines do the structural work: 1px hairlines between rows, 1px card rules on the grid, a 2px charcoal top rule for "over", and a 1px dashed paper-400 frame for empty states. On phones, dialogs become bottom sheets: full width, top corners only, no side or bottom border.

## Components

### Buttons
Plain, firm, quick to read.
- **Shape:** gently squared corners (3px), 40px tall (32px small), 44px and 40px on coarse pointers.
- **Primary:** forest-700 on paper-50 text, weight 560. Hover darkens to forest-800. One per view region.
- **Secondary:** paper-50 with a paper-400 border; hover steps to paper-200.
- **Quiet:** no ground; hover to paper-200. Used for Undo, Dismiss, icon-only edit and delete.
- **Danger:** red-600, hover red-800. Only in destructive confirmations.
- **Icon buttons** are square at the button's height and always carry an accessible label.
- **Transitions:** background, border and colour at 120ms ease-out; disabled at 55% opacity.

### Links
Forest-700, weight 560, underlined in forest-300 at a 3px offset; the underline darkens to the text colour on hover. Inline actions such as "Change payday" are links set inside the sentence they act on.

### Status Stamp (signature)
A small rubber-stamp label: 1px border in the text colour, 2px corners, uppercase 0.6875rem at weight 640, with a Lucide icon. Paid is forest-700 with a check; due soon is amber-800 on amber-100 with a clock; overdue is red-800 on red-100 with an alert; upcoming is Pencil with a calendar. On the day card the payday stamp is rotated -6 degrees in forest-700.

### Rows and Tables (in place of cards)
- Lists and tables sit between a top and bottom hairline (paper-300) with hairline dividers between rows.
- A bill row leads with a square date block (day numeral in Besley over a small uppercase month), bordered paper-400, amber-600 when due, red-600 when overdue.
- Paid amounts go to Pencil with a paper-500 strike-through.
- Category rows carry a 6px progress bar on a paper-200 track: forest-600 for planned lines, ink-700 for flexible, ink-900 with a tick mark when over plan.
- **Worksheet panel:** on phones ruled top and bottom; from 1024px a square paper-50 panel with a paper-400 border and 20px padding. No shadow, no radius.

### Inputs / Fields
- **Style:** paper-50 ground, 1px paper-400 border, 3px corners, 44px tall, 16px text. Amounts use a fixed ₹ prefix in Pencil and a decimal keypad.
- **Hover:** border to paper-500.
- **Focus:** 2px forest-600 outline at no offset, border to forest-600.
- **Error:** border red-600, message in red-800 with an alert icon below the field. Hints sit below in Pencil at 0.875rem.
- **Labels:** 0.875rem weight 500 in ink-900 above the field; "(optional)" in Pencil.
- **Segmented choice:** a paper-200 trough with paper-400 border; the selected segment is paper-50.

### Navigation
- **Rail (1024px and up):** forest-900 field, 240px. Wordmark in Besley with "Survival" italic, a one-line strapline in rail-muted. Items are 40px, 0.9375rem weight 500 with 18px Lucide icons; the active item inverts to paper-100 with forest-900 text. Profile sits at the foot above a forest-800 rule.
- **Phones:** paper-50 bottom bar with a paper-300 top rule; tabs are icon over 0.6875rem label, Pencil when idle and forest-700 when active; the central Add button is a 48px forest-700 square with 3px corners.

### Dialogs and Feedback
- **Dialog:** native modal dialog, paper-50, paper-400 border, 3px corners, sheet shadow; header separated by a hairline; 28rem for confirmations, 36rem for forms. Bottom sheet on phones.
- **Toast:** ink-900 strip with paper-50 text, a forest-300 check, and an underlined forest-200 action (usually Undo). Bottom-centre above the phone bar; bottom-right on desktop.
- **Notices:** full-width bands; the sample-data band is paper-200 with a hairline under it.

### Day Card (signature)
The page's module. A grid of square cells ruled in paper-400. Past days are paper-100 with a forest-100 fill rising from the bottom in proportion to spend against the day's share (minimum 12%); a day over its share fills fully and gets a 2px ink-900 top rule, with its figure in ink-900 weight 600. A day with nothing spent shows a forest-600 check. Today is solid forest-700 with paper-50 text showing the live allowance. Days ahead are paper-50 showing their share in Pencil. Days before tracking began are paper-200. A 10px corner notch marks an unpaid bill: amber-600, or red-600 if overdue. Selection is a 2px inset ink-900 outline, and the selected day's plain-language description is printed under the grid, followed by a key.

## Do's and Don'ts

### Do:
- **Do** take every neutral from the paper and ink ramps (paper-50 to paper-500, ink-600 to ink-900).
- **Do** set every money figure in tabular lining numerals, with Indian digit grouping.
- **Do** separate content with hairlines (paper-300) and card rules (paper-400) rather than boxes.
- **Do** pair every status colour with words and a Lucide icon.
- **Do** mark a day over its share with a 2px ink-900 top rule over the spent fill.
- **Do** keep the allowance sentence the only display-scale text, with the figure coloured inline (forest-700 normally, red-800 when short).
- **Do** keep corners at 0px for structure, 3px for controls, 2px for stamps.
- **Do** make state changes instant; motion is limited to 120ms colour transitions and the chevron on "How this is worked out", and is removed under reduced motion.
- **Do** write UI copy as plain statements with real figures ("You have ₹43 a day until payday."), never scolding about spending and never using SaaS slogans such as "unlock" or "supercharge".

### Don't:
- **Don't** use amber for anything except bills that are due.
- **Don't** use red for "worse than before" or a less favourable comparison; red is for real shortfalls, overdue bills, and system errors or destructive actions.
- **Don't** wrap sections in rounded, shadowed cards; the only bordered panels are the square worksheet panel and dialogs.
- **Don't** put a shadow on anything in the page flow.
- **Don't** show a positive allowance when nothing is safe to spend.
- **Don't** let the day grid scroll sideways, or shrink boxes below 40px to fit more columns.
- **Don't** use KPI tiles in a row or a donut chart for the cycle summary.
- **Don't** use emoji or glyph icons; icons are Lucide line icons.
