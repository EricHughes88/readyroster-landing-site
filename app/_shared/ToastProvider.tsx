// app/_shared/ToastProvider.tsx (or app/_providers/ToastProvider.tsx)
"use client";

import React,
{
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";

/** Toast types and shape */
export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  title?: string;
  message: string;
  type?: ToastType;
  /** ms; default 3500 */
  duration?: number;
};

type AddToastInput = {
  title?: string;
  description: string;
  variant?: ToastType; // matches your usage: variant: "success" | "error" | "info"
};

type ToastContextValue = {
  show: (t: Omit<Toast, "id">) => string;
  success: (message: string, opts?: Omit<Toast, "id" | "message" | "type">) => string;
  error: (message: string, opts?: Omit<Toast, "id" | "message" | "type">) => string;
  info: (message: string, opts?: Omit<Toast, "id" | "message" | "type">) => string;
  dismiss: (id: string) => void;
  /** shadcn-style helper: addToast({ title, description, variant }) */
  addToast: (opts: AddToastInput) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

function uid() {
  // Next/modern browsers have crypto in the client; provide a tiny fallback
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Use globalThis to avoid Node vs DOM setTimeout typing conflicts
  const timers = useRef<Map<string, ReturnType<typeof globalThis.setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = uid();
      const toast: Toast = {
        id,
        type: t.type ?? "info",
        duration: t.duration ?? 3500,
        title: t.title,
        message: t.message,
      };
      setToasts((prev) => [toast, ...prev]);

      // auto-dismiss
      const tm = globalThis.setTimeout(() => dismiss(id), toast.duration);
      timers.current.set(id, tm);

      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, opts?: Omit<Toast, "id" | "message" | "type">) =>
      show({ ...opts, message, type: "success" }),
    [show]
  );

  const error = useCallback(
    (message: string, opts?: Omit<Toast, "id" | "message" | "type">) =>
      show({ ...opts, message, type: "error" }),
    [show]
  );

  const info = useCallback(
    (message: string, opts?: Omit<Toast, "id" | "message" | "type">) =>
      show({ ...opts, message, type: "info" }),
    [show]
  );

  // New helper matching your existing usage:
  // addToast({ title, description, variant: "success" | "error" | "info" })
  const addToast = useCallback(
    (opts: AddToastInput) =>
      show({
        title: opts.title,
        message: opts.description,
        type: opts.variant ?? "info",
      }),
    [show]
  );

  const value = useMemo(
    () => ({ show, success, error, info, dismiss, addToast }),
    [show, success, error, info, dismiss, addToast]
  );

  // Clear any outstanding timers on unmount (hot reload friendliness)
  useEffect(() => {
    return () => {
      timers.current.forEach((tm) => clearTimeout(tm));
      timers.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast viewport */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex w-full justify-center px-4 sm:inset-auto sm:right-4 sm:top-4 sm:bottom-auto sm:w-auto sm:justify-end"
        aria-live="polite"
        aria-atomic="true"
      >
        <ul className="flex w-full max-w-md flex-col gap-3 sm:w-96">
          {toasts.map((t) => (
            <li key={t.id} className="pointer-events-auto">
              <ToastCard toast={t} onClose={() => dismiss(t.id)} />
            </li>
          ))}
        </ul>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const tone =
    toast.type === "success"
      ? "bg-green-500/15 text-green-100 ring-1 ring-green-400/30"
      : toast.type === "error"
      ? "bg-red-500/15 text-red-100 ring-1 ring-red-400/30"
      : "bg-slate-800/80 text-slate-100 ring-1 ring-slate-700/60";

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={`group flex w-full items-start gap-3 rounded-xl ${tone} backdrop-blur px-4 py-3 shadow-lg transition duration-200`}
    >
      <Icon type={toast.type ?? "info"} />
      <div className="flex-1">
        {toast.title ? (
          <p className="text-sm font-semibold leading-5">{toast.title}</p>
        ) : null}
        <p className="text-sm leading-5">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="ml-1 rounded-md p-1 text-slate-300/80 hover:bg-slate-700/40 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
        aria-label="Dismiss notification"
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function Icon({ type }: { type: ToastType }) {
  if (type === "success") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-5 w-5 shrink-0 text-green-300"
        aria-hidden="true"
      >
        <path
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "error") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-5 w-5 shrink-0 text-red-300"
        aria-hidden="true"
      >
        <path
          d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-5 w-5 shrink-0 text-slate-300"
      aria-hidden="true"
    >
      <path
        d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 110-16 8 8 0 010 16z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
