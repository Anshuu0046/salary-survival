"use client";

import { Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog } from "./Dialog";

/* ------------------------------------------------------------------ */
/* Toast: short confirmations, announced to screen readers.           */
/* ------------------------------------------------------------------ */

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; onClick(): void };
}

interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
}

interface FeedbackValue {
  toast(message: string, action?: ToastItem["action"]): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve(v: boolean): void }) | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, action?: ToastItem["action"]) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, action }]);
      window.setTimeout(() => dismiss(id), action ? 7000 : 4000);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = (result: boolean) => {
    pending?.resolve(result);
    setPending(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Dialog open={pending !== null} onClose={() => close(false)} title={pending?.title ?? ""} size="sm" role="alertdialog">
        <div className="text-[0.9375rem] text-ink-700">{pending?.body}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => close(false)} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${pending?.tone === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={() => close(true)}
          >
            {pending?.confirmLabel}
          </button>
        </div>
      </Dialog>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-[var(--radius-sm)] bg-ink-900 py-2.5 pl-3.5 pr-2 text-sm text-paper-50 shadow-[var(--shadow-sheet)]"
          >
            <Check size={16} className="shrink-0 text-forest-300" aria-hidden />
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="rounded-[var(--radius-xs)] px-2 py-1 font-semibold text-forest-200 underline underline-offset-2 hover:text-paper-50"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="grid size-7 place-items-center rounded-[var(--radius-xs)] text-paper-300 hover:text-paper-50"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}
