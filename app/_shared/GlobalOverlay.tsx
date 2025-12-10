"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type OverlayCtx = {
  show: (message?: string) => void;
  hide: () => void;
  withOverlay: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
};

const Ctx = createContext<OverlayCtx | null>(null);

export function GlobalOverlayProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const lockCount = useRef(0);

  const show = useCallback((msg?: string) => {
    lockCount.current += 1;
    setMessage(msg);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    lockCount.current = Math.max(0, lockCount.current - 1);
    if (lockCount.current === 0) {
      setOpen(false);
      setMessage(undefined);
    }
  }, []);

  const withOverlay = useCallback(async <T,>(fn: () => Promise<T>, msg?: string) => {
    show(msg);
    try {
      return await fn();
    } finally {
      hide();
    }
  }, [show, hide]);

  const value = useMemo(() => ({ show, hide, withOverlay }), [show, hide, withOverlay]);

  return (
    <Ctx.Provider value={value}>
      {children}

      {/* Render overlay ONLY when open */}
      {open && (
        <div
          className="fixed inset-0 z-[2000] opacity-100"
          aria-hidden={false}
          role="presentation"
        >
          {/* Backdrop blocks clicks */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          {/* Center content */}
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="flex min-w-[220px] max-w-[90vw] items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-2xl">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              <div className="text-sm text-slate-100">
                {message ?? "Loading…"}
              </div>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useOverlay() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOverlay must be used within <GlobalOverlayProvider>");
  return ctx;
}
