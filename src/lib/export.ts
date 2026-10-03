import type { AppData } from "./types";

/** CSV of every transaction, amounts in rupees, ready for a spreadsheet. */
export function transactionsToCSV(data: AppData): string {
  const catName = new Map(data.categories.map((c) => [c.id, c.name]));
  const billName = new Map(data.bills.map((b) => [b.id, b.name]));
  const header = ["Date", "Type", "Description", "Category", "Amount (INR)", "Bill", "Note"];
  const rows = [...data.transactions]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((t) => [
      t.date,
      t.type === "income" ? "Income" : "Expense",
      t.description,
      catName.get(t.categoryId) ?? "Uncategorised",
      (t.amount / 100).toFixed(2),
      t.billId ? (billName.get(t.billId) ?? "") : "",
      t.note ?? "",
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string): string {
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function dataToJSON(data: AppData): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: "SalarySurvival", ...data }, null, 2);
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
