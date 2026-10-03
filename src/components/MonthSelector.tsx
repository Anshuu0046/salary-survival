"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cycleName, cycleRange, getCycle, shiftCycleKey } from "@/lib/calc/cycle";
import { useStore } from "@/state/store";

/** Switches the pay cycle every page is looking at. */
export function MonthSelector() {
  const { data, viewKey, setViewKey, currentKey } = useStore();
  const cycle = getCycle(viewKey, data.settings);
  const isCurrent = viewKey === currentKey;
  const atLimit = viewKey >= shiftCycleKey(currentKey, 12);

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Pay cycle">
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={() => setViewKey(shiftCycleKey(viewKey, -1))}
        aria-label="Previous cycle"
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <div className="min-w-[9.5rem] px-2 text-center" aria-live="polite">
        <div className="text-[0.9375rem] font-semibold leading-tight">{cycleName(viewKey)}</div>
        <div className="tnum text-xs text-ink-600">{cycleRange(cycle)}</div>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={() => setViewKey(shiftCycleKey(viewKey, 1))}
        disabled={atLimit}
        aria-label="Next cycle"
      >
        <ChevronRight size={18} aria-hidden />
      </button>
      {!isCurrent && (
        <button type="button" className="btn btn-quiet btn-sm ml-1" onClick={() => setViewKey(currentKey)}>
          Back to now
        </button>
      )}
    </div>
  );
}
