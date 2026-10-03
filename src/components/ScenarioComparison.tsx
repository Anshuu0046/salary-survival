import type { ScenarioResult } from "@/lib/calc/scenario";
import { formatINR } from "@/lib/money";

const ROWS: { key: keyof ScenarioResult["current"]; label: string; good: "up" | "down" | "none"; hint?: string }[] = [
  { key: "takeHome", label: "Take-home pay", good: "up" },
  { key: "committed", label: "Committed", good: "none", hint: "Includes savings" },
  { key: "savings", label: "Savings", good: "up" },
  { key: "flexible", label: "Flexible money", good: "up" },
  { key: "dailyShare", label: "Daily share", good: "up", hint: "Flexible ÷ days in the cycle" },
];

/** Current plan beside the adjusted plan, with the difference for each figure. */
export function ScenarioComparison({ result }: { result: ScenarioResult }) {
  return (
    <table className="w-full text-[0.9375rem]">
      <caption className="sr-only">Current plan compared with the adjusted plan</caption>
      <thead>
        <tr className="border-b border-paper-400 text-right text-xs text-ink-600">
          <th scope="col" className="py-2 pr-2 text-left font-medium">
            <span className="sr-only">Figure</span>
          </th>
          <th scope="col" className="px-2 py-2 font-medium">Now</th>
          <th scope="col" className="px-2 py-2 font-medium text-ink-900">With changes</th>
          <th scope="col" className="py-2 pl-2 font-medium">Difference</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-paper-300">
        {ROWS.map(({ key, label, good, hint }) => {
          const now = result.current[key];
          const adj = result.adjusted[key];
          const diff = result.difference[key];
          const tone =
            // Better is green; worse is plain ink. Red is kept for real shortfalls (a negative adjusted figure).
            diff === 0 || good === "none" ? "text-ink-600" : (diff > 0) === (good === "up") ? "text-forest-700" : "text-ink-900";
          const strong = key === "flexible" || key === "dailyShare";
          const fmt = (v: number, signed = false) => formatINR(v, { signed, wholeRupees: key === "dailyShare" });
          return (
            <tr key={key} className={strong ? "font-semibold" : ""}>
              <th scope="row" className="py-2.5 pr-2 text-left font-[inherit]">
                {label}
                {hint && <span className="block text-xs font-normal text-ink-600">{hint}</span>}
              </th>
              <td className={`tnum px-2 py-2.5 text-right text-ink-700 ${now < 0 ? "text-red-800" : ""}`}>{fmt(now)}</td>
              <td className={`tnum px-2 py-2.5 text-right ${adj < 0 ? "text-red-800" : ""}`}>{fmt(adj)}</td>
              <td className={`tnum py-2.5 pl-2 text-right ${tone}`}>{diff === 0 ? "No change" : fmt(diff, true)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
