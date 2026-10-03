"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Narrow dialogs for confirmations, wide for forms. */
  size?: "sm" | "md";
  role?: "dialog" | "alertdialog";
}

/**
 * Native <dialog>: focus is trapped, Escape closes, and the page behind is inert.
 * On phones it sits at the bottom of the screen, within reach of a thumb.
 */
export function Dialog({ open, onClose, title, description, children, size = "md", role = "dialog" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onMouseDown={(e) => {
        // A press on the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
      className={[
        "m-auto w-[calc(100%-2rem)] bg-paper-50 p-0 text-ink-900 shadow-[var(--shadow-sheet)]",
        "border border-paper-400 rounded-[var(--radius-sm)]",
        "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
        size === "sm" ? "max-w-md" : "max-w-xl",
      ].join(" ")}
    >
      {open && (
        <div className="flex max-h-[min(88dvh,52rem)] flex-col">
          <header className="flex items-start gap-4 border-b border-paper-300 px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-xl font-semibold leading-tight">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-1 text-sm text-ink-600">
                  {description}
                </div>
              )}
            </div>
            <button type="button" className="btn btn-quiet btn-icon btn-sm -mr-2 -mt-1" onClick={onClose} aria-label="Close">
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto px-5 pb-5 pt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
