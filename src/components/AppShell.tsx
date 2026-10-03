"use client";

import {
  ArrowLeftRight,
  ClipboardList,
  Ellipsis,
  House,
  Plus,
  ReceiptText,
  Settings2,
  Split,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Transaction } from "@/lib/types";
import { useStore, type TransactionInput } from "@/state/store";
import { TransactionForm, type TransactionFormProps } from "./TransactionForm";
import { Dialog } from "./ui/Dialog";
import { useFeedback } from "./ui/feedback";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: House },
  { href: "/plan", label: "Monthly plan", icon: ClipboardList },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/bills", label: "Bills", icon: ReceiptText },
  { href: "/scenarios", label: "Scenarios", icon: Split },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

const MOBILE_PRIMARY = ["/", "/transactions"];
const MOBILE_SECONDARY = ["/bills"];
const MOBILE_MORE = ["/plan", "/scenarios", "/settings"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/* ------------------------------------------------------------------ */
/* Global composer: "Add transaction" works from every page.           */
/* ------------------------------------------------------------------ */

interface ComposerValue {
  addTransaction(defaults?: TransactionFormProps["defaults"]): void;
  editTransaction(txn: Transaction): void;
}

const ComposerContext = createContext<ComposerValue | null>(null);

export function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error("useComposer must be used inside AppShell");
  return ctx;
}

function Composer({ children }: { children: ReactNode }) {
  const { actions } = useStore();
  const { toast } = useFeedback();
  const [state, setState] = useState<
    { mode: "add"; defaults?: TransactionFormProps["defaults"] } | { mode: "edit"; txn: Transaction } | null
  >(null);
  const close = useCallback(() => setState(null), []);

  const value = useMemo<ComposerValue>(
    () => ({
      addTransaction: (defaults) => setState({ mode: "add", defaults }),
      editTransaction: (txn) => setState({ mode: "edit", txn }),
    }),
    [],
  );

  const onSubmit = (input: TransactionInput) => {
    if (state?.mode === "edit") {
      actions.updateTransaction(state.txn.id, input);
      toast("Transaction updated.");
    } else {
      const t = actions.addTransaction(input);
      toast(`${input.type === "income" ? "Money in" : "Money out"} added: ${input.description}.`, {
        label: "Undo",
        onClick: () => actions.deleteTransaction(t.id),
      });
    }
    setState(null);
  };

  return (
    <ComposerContext.Provider value={value}>
      {children}
      <Dialog
        open={state !== null}
        onClose={close}
        title={state?.mode === "edit" ? "Edit transaction" : "Add a transaction"}
        description={state?.mode === "edit" ? undefined : "Money you spent or received. It updates your allowance straight away."}
      >
        {state && (
          <TransactionForm
            key={state.mode === "edit" ? state.txn.id : "new"}
            initial={state.mode === "edit" ? state.txn : undefined}
            defaults={state.mode === "add" ? state.defaults : undefined}
            onSubmit={onSubmit}
            onCancel={close}
          />
        )}
      </Dialog>
    </ComposerContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif font-semibold tracking-[-0.015em] ${className}`}>
      Salary<span className="italic font-medium">Survival</span>
    </span>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { data } = useStore();
  const name = data.settings.name.trim();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-forest-900 text-[var(--rail-ink)] lg:flex">
      <div className="px-5 pb-6 pt-6">
        <Link href="/" className="block rounded-[var(--radius-xs)] text-[1.375rem] leading-none focus-visible:outline-paper-100">
          <Wordmark />
        </Link>
        <p className="mt-2 text-[0.8125rem] leading-snug text-[var(--rail-muted)]">Payday to payday, one day at a time.</p>
      </div>
      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[0.9375rem] font-medium transition-colors focus-visible:outline-paper-100 ${
                    active
                      ? "bg-paper-100 text-forest-900"
                      : "text-[var(--rail-ink)] hover:bg-forest-800"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-forest-800 px-5 py-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-[var(--radius-sm)] focus-visible:outline-paper-100"
        >
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-forest-700 font-serif text-base font-semibold"
          >
            {(name || "You").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name || "Your profile"}</span>
            <span className="block text-xs text-[var(--rail-muted)]">Saved in this browser only</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const { addTransaction } = useComposer();
  const [moreOpen, setMoreOpen] = useState(false);
  const byHref = (h: string) => NAV.find((n) => n.href === h)!;
  const moreActive = MOBILE_MORE.some((h) => isActive(pathname, h));

  const tab = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <li key={item.href} className="flex-1">
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium ${
            active ? "text-forest-700" : "text-ink-600"
          }`}
        >
          <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
          {item.label === "Monthly plan" ? "Plan" : item.label}
        </Link>
      </li>
    );
  };

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-paper-300 bg-paper-50 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto flex max-w-xl items-stretch px-1">
          {MOBILE_PRIMARY.map((h) => tab(byHref(h)))}
          <li className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => addTransaction()}
              className="grid size-12 place-items-center rounded-[var(--radius-sm)] bg-forest-700 text-paper-50 hover:bg-forest-800"
              aria-label="Add transaction"
            >
              <Plus size={22} strokeWidth={2.25} aria-hidden />
            </button>
          </li>
          {MOBILE_SECONDARY.map((h) => tab(byHref(h)))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium ${
                moreActive ? "text-forest-700" : "text-ink-600"
              }`}
            >
              <Ellipsis size={20} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <ul className="-mx-2">
          {MOBILE_MORE.map((h) => {
            const { label, icon: Icon } = byHref(h);
            const active = isActive(pathname, h);
            return (
              <li key={h}>
                <Link
                  href={h}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] px-2 text-base font-medium hover:bg-paper-200 ${
                    active ? "text-forest-700" : ""
                  }`}
                >
                  <Icon size={20} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
}

function Notices() {
  const { data, notice, dismissNotice, actions } = useStore();
  const { confirm, toast } = useFeedback();

  return (
    <>
      {notice && (
        <div
          role={notice.kind === "save-failed" ? "alert" : "status"}
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-8 ${
            notice.kind === "save-failed" ? "bg-red-100 text-red-800" : "bg-paper-200 text-ink-900"
          }`}
        >
          <p className="flex-1">
            {notice.kind === "repaired" &&
              `Some saved records couldn't be read (${notice.dropped}), so they were skipped. Everything else loaded normally.`}
            {notice.kind === "unreadable" &&
              `Your saved data couldn't be read, so sample data is shown instead.${notice.backupKey ? " A copy of the unreadable data was kept in this browser." : ""}`}
            {notice.kind === "save-failed" && notice.error}
          </p>
          <button type="button" className="btn btn-quiet btn-sm" onClick={dismissNotice}>
            Dismiss
          </button>
        </div>
      )}
      {data.isSample && (
        <div className="border-b border-paper-300 bg-paper-200">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-8">
            <p className="min-w-[16rem] flex-1 text-sm text-ink-900">
              <strong className="font-semibold">Sample data.</strong> A ₹15,000 salary paid on the 7th, so you can see how
              things work. Edit anything, or start with your own numbers.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Start with your own numbers?",
                    body: "This removes the sample salary, plan, bills and transactions. You'll set up your take-home pay and payday next.",
                    confirmLabel: "Remove sample data",
                  });
                  if (ok) {
                    actions.startEmpty();
                    toast("Sample data removed. Start by adding your take-home pay.");
                  }
                }}
              >
                Start fresh
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => {
                  actions.keepSampleAsMine();
                  toast("Kept. These numbers are now treated as yours.");
                }}
              >
                Keep as my data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready } = useStore();
  return (
    <Composer>
      <a
        href="#main"
        className="sr-only z-50 bg-paper-50 px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="min-h-dvh lg:pl-60">
        <header className="flex h-12 items-center justify-between bg-forest-900 px-4 text-[var(--rail-ink)] lg:hidden">
          <Link href="/" className="text-lg leading-none focus-visible:outline-paper-100">
            <Wordmark />
          </Link>
          <Link href="/settings" className="text-xs text-[var(--rail-muted)] underline-offset-2 hover:underline">
            Saved in this browser
          </Link>
        </header>
        {ready && <Notices />}
        <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-8 lg:pb-16 lg:pt-10">
          {ready ? children : <p className="py-24 text-center text-ink-600">Opening your numbers…</p>}
        </main>
      </div>
      <MobileNav />
    </Composer>
  );
}
