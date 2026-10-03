"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cycleKeyForDate, getCycle, shiftCycleKey } from "@/lib/calc/cycle";
import { resolvePlan } from "@/lib/calc/plan";
import { todayISO } from "@/lib/dates";
import { emptyData, newId } from "@/lib/defaults";
import { sampleData } from "@/lib/sample";
import { createLocalStorageRepository, type DataRepository } from "@/lib/storage";
import type { AppData, Bill, Category, CycleKey, ISODate, Plan, Settings, StartingPoint, Transaction } from "@/lib/types";

export type LoadNotice =
  | { kind: "repaired"; dropped: number }
  | { kind: "unreadable"; backupKey: string | null }
  | { kind: "save-failed"; error: string };

export type TransactionInput = Omit<Transaction, "id" | "createdAt">;
export type BillInput = Omit<Bill, "id">;

interface Actions {
  addTransaction(input: TransactionInput): Transaction;
  updateTransaction(id: string, input: TransactionInput): void;
  deleteTransaction(id: string): void;
  markBillPaid(billId: string, dueDate: ISODate, paidOn: ISODate, amount?: number): void;
  unmarkBillPaid(billId: string, dueDate: ISODate): void;
  addBill(input: BillInput): Bill;
  updateBill(id: string, input: BillInput): void;
  /** Deletes the schedule. Past payments stay as ordinary transactions. */
  deleteBill(id: string): void;
  savePlan(key: CycleKey, plan: Plan): void;
  updateSettings(patch: Partial<Settings>): void;
  setStartingPoint(sp: StartingPoint | null): void;
  setNextPayday(currentKey: CycleKey, date: ISODate | null): void;
  addCategory(input: Omit<Category, "id">): Category;
  updateCategory(id: string, patch: Partial<Pick<Category, "name" | "group" | "archived">>): void;
  /** Deletes an unused category; archives it if anything still refers to it. Returns what happened. */
  removeCategory(id: string): "deleted" | "archived";
  keepSampleAsMine(): void;
  resetToSample(): void;
  startEmpty(): void;
  clearAll(): void;
}

interface StoreValue {
  ready: boolean;
  data: AppData;
  today: ISODate;
  currentKey: CycleKey;
  viewKey: CycleKey;
  setViewKey(key: CycleKey): void;
  notice: LoadNotice | null;
  dismissNotice(): void;
  actions: Actions;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, repository }: { children: ReactNode; repository?: DataRepository }) {
  const repo = useMemo(() => repository ?? createLocalStorageRepository(), [repository]);
  const [data, setData] = useState<AppData>(() => emptyData());
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState<ISODate>(() => todayISO());
  const [viewKey, setViewKeyState] = useState<CycleKey | null>(null);
  const [notice, setNotice] = useState<LoadNotice | null>(null);
  const skipSave = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Load once on the client.
  useEffect(() => {
    const t = todayISO();
    const result = repo.load();
    if (result.status === "ok") setData(result.data);
    else if (result.status === "repaired") {
      setData(result.data);
      setNotice({ kind: "repaired", dropped: result.dropped });
    } else if (result.status === "unreadable") {
      setData(sampleData(t));
      setNotice({ kind: "unreadable", backupKey: result.backupKey });
    } else setData(sampleData(t));
    setToday(t);
    setReady(true);
  }, [repo]);

  // Persist every change after load.
  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) {
      skipSave.current = false;
      // First run: write the sample so a reload shows the same data.
      const r = repo.save(data);
      if (!r.ok) setNotice({ kind: "save-failed", error: r.error });
      return;
    }
    const r = repo.save(data);
    if (!r.ok) setNotice({ kind: "save-failed", error: r.error });
  }, [data, ready, repo]);

  // Keep "today" honest when the tab stays open past midnight.
  useEffect(() => {
    const refresh = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()));
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const currentKey = useMemo(() => cycleKeyForDate(today, data.settings), [today, data.settings]);
  const effectiveViewKey = viewKey ?? currentKey;

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((d) => ({ ...fn(d), updatedAt: Date.now() }));
  }, []);

  const actions = useMemo<Actions>(
    () => ({
      addTransaction(input) {
        const t: Transaction = { ...input, id: newId("txn"), createdAt: Date.now() };
        update((d) => ({ ...d, transactions: [...d.transactions, t] }));
        return t;
      },
      updateTransaction(id, input) {
        update((d) => ({
          ...d,
          transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...input, id, createdAt: t.createdAt } : t)),
        }));
      },
      deleteTransaction(id) {
        update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
      },
      markBillPaid(billId, dueDate, paidOn, amount) {
        update((d) => {
          const bill = d.bills.find((b) => b.id === billId);
          if (!bill) return d;
          if (d.transactions.some((t) => t.billId === billId && t.billDueDate === dueDate)) return d;
          const t: Transaction = {
            id: newId("txn"),
            type: "expense",
            amount: amount ?? bill.amount,
            date: paidOn,
            description: bill.name,
            categoryId: bill.categoryId,
            billId,
            billDueDate: dueDate,
            createdAt: Date.now(),
          };
          return { ...d, transactions: [...d.transactions, t] };
        });
      },
      unmarkBillPaid(billId, dueDate) {
        update((d) => ({
          ...d,
          transactions: d.transactions.filter((t) => !(t.billId === billId && t.billDueDate === dueDate)),
        }));
      },
      addBill(input) {
        const b: Bill = { ...input, id: newId("bill") };
        update((d) => ({ ...d, bills: [...d.bills, b] }));
        return b;
      },
      updateBill(id, input) {
        update((d) => ({ ...d, bills: d.bills.map((b) => (b.id === id ? { ...input, id } : b)) }));
      },
      deleteBill(id) {
        update((d) => ({
          ...d,
          bills: d.bills.filter((b) => b.id !== id),
          // Keep payment history, but detach it from the deleted schedule.
          transactions: d.transactions.map((t) =>
            t.billId === id ? { ...t, billId: undefined, billDueDate: undefined } : t,
          ),
        }));
      },
      savePlan(key, plan) {
        update((d) => ({ ...d, plans: { ...d.plans, [key]: plan } }));
      },
      updateSettings(patch) {
        update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
      },
      setStartingPoint(sp) {
        update((d) => {
          const { startingPoint: _old, ...rest } = d;
          return sp ? { ...rest, startingPoint: sp } : rest;
        });
      },
      setNextPayday(currentKeyArg, date) {
        const nextKey = shiftCycleKey(currentKeyArg, 1);
        update((d) => {
          const overrides = { ...d.settings.paydayOverrides };
          if (date) overrides[nextKey] = date;
          else delete overrides[nextKey];
          return { ...d, settings: { ...d.settings, paydayOverrides: overrides } };
        });
      },
      addCategory(input) {
        const c: Category = { ...input, id: newId("cat") };
        update((d) => ({ ...d, categories: [...d.categories, c] }));
        return c;
      },
      updateCategory(id, patch) {
        update((d) => ({
          ...d,
          categories: d.categories.map((c) => {
            if (c.id !== id) return c;
            // System categories keep their group.
            return c.system ? { ...c, name: patch.name ?? c.name } : { ...c, ...patch };
          }),
        }));
      },
      removeCategory(id) {
        const d0 = dataRef.current;
        const used =
          d0.transactions.some((t) => t.categoryId === id) ||
          d0.bills.some((b) => b.categoryId === id) ||
          Object.values(d0.plans).some((p) => p.lines.some((l) => l.categoryId === id));
        update((d) =>
          used
            ? { ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)) }
            : { ...d, categories: d.categories.filter((c) => c.id !== id) },
        );
        return used ? "archived" : "deleted";
      },
      keepSampleAsMine() {
        update((d) => ({ ...d, isSample: false }));
      },
      resetToSample() {
        setViewKeyState(null);
        setData(sampleData(todayISO()));
      },
      startEmpty() {
        setViewKeyState(null);
        setData(emptyData());
      },
      clearAll() {
        repo.clear();
        setViewKeyState(null);
        setData(emptyData());
      },
    }),
    [update, repo],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      data,
      today,
      currentKey,
      viewKey: effectiveViewKey,
      setViewKey: (key) => setViewKeyState(key === currentKey ? null : key),
      notice,
      dismissNotice: () => setNotice(null),
      actions,
    }),
    [ready, data, today, currentKey, effectiveViewKey, notice, actions],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** Convenience: categories visible in pickers, optionally filtered by type. */
export function useCategories(type?: "income" | "expense") {
  const { data } = useStore();
  return useMemo(
    () =>
      data.categories.filter(
        (c) => !c.archived && (type === undefined || (type === "income" ? c.group === "income" : c.group !== "income")),
      ),
    [data.categories, type],
  );
}

/** The plan in force for a cycle, and the cycle itself. */
export function useCyclePlan(key: CycleKey) {
  const { data } = useStore();
  return useMemo(
    () => ({ cycle: getCycle(key, data.settings), ...resolvePlan(data.plans, key) }),
    [data.plans, data.settings, key],
  );
}
