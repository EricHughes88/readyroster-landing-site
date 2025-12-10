// app/_shared/WrestlerHeaderCounts.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/app/_shared/ToastProvider";

type Summary = {
  ok: boolean;
  matches: { total: number; pending: number; confirmed: number };
  messages: { total: number; unread: number | null };
};

export default function WrestlerHeaderCounts({ wrestlerId }: { wrestlerId: number }) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const hadErrorRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { addToast } = useToast();

  const fetchSummary = async (signal?: AbortSignal) => {
    try {
      setErr(null);
      const res = await fetch(`/api/wrestlers/${wrestlerId}/dashboard/summary`, {
        method: "GET",
        signal,
        headers: { "cache-control": "no-cache" },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = (await res.json()) as Summary;
      setData(json);

      if (hadErrorRef.current) {
        addToast({
          variant: "success",
          title: "Back online",
          description: "Counts refreshed.",
        });
        hadErrorRef.current = false;
      }
    } catch {
      setErr("Failed to load");
      if (!hadErrorRef.current) {
        addToast({
          variant: "error",
          title: "Refresh failed",
          description: "Couldn’t update counts. Will retry…",
        });
        hadErrorRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetchSummary(ac.signal);

    // Auto refresh every 30s
    timerRef.current = setInterval(() => {
      const refreshCtrl = new AbortController();
      fetchSummary(refreshCtrl.signal);
    }, 30_000);

    // Refresh when the tab becomes visible again
    const onVis = () => {
      if (document.visibilityState === "visible") {
        const visCtrl = new AbortController();
        fetchSummary(visCtrl.signal);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      ac.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrestlerId]);

  const pending = data?.matches.pending ?? 0;
  const confirmed = data?.matches.confirmed ?? 0;
  const msgBubble =
    data?.messages?.unread != null && (data.messages.unread ?? 0) > 0
      ? (data.messages.unread as number)
      : data?.messages?.total ?? 0;

  // --- UI helpers ---------------------------------------------------------
  const Badge = ({ value }: { value: number }) => (
    <span className="ml-1 text-xs opacity-80">({value})</span>
  );

  const MsgPill = ({ value }: { value: number }) => (
    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1 text-xs ring-1 ring-inset ring-white/15">
      {value}
    </span>
  );

  const Btn = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link
      href={href as any}
      className="rounded-md bg-white/5 px-3 py-2 text-sm ring-1 ring-inset ring-white/10 hover:bg-white/10"
    >
      {children}
    </Link>
  );

  const Shimmer = ({ w = "w-16" }: { w?: string }) => (
    <span className={`inline-block h-4 ${w} animate-pulse rounded bg-white/10 align-middle`} />
  );

  // --- Render -------------------------------------------------------------
  if (loading) {
    return (
      <>
        <span className="rounded-md bg-white/10 px-3 py-2 text-sm ring-1 ring-inset ring-white/10">
          <Shimmer w="w-32" />
        </span>
        <span className="rounded-md bg-white/5 px-3 py-2 text-sm ring-1 ring-inset ring-white/10">
          <Shimmer />
        </span>
        <span className="rounded-md bg-white/5 px-3 py-2 text-sm ring-1 ring-inset ring-white/10">
          <Shimmer />
        </span>
        <span className="rounded-md bg-white/5 px-3 py-2 text-sm ring-1 ring-inset ring-white/10">
          <Shimmer w="w-10" />
        </span>
      </>
    );
  }

  return (
    <>
      {/* Manage Interests */}
      <Link
        href={`/parent/wrestlers/${wrestlerId}/interests` as any}
        className="rounded-md bg-white/10 px-3 py-2 text-sm ring-1 ring-inset ring-white/10 hover:bg-white/15"
        title="Add or edit interests"
      >
        Add / Manage Interests
      </Link>

      {/* Pending */}
      <Btn href={`/parent/wrestlers/${wrestlerId}/matches?status=pending`}>
        Pending <Badge value={pending} />
      </Btn>

      {/* Confirmed */}
      <Btn href={`/parent/wrestlers/${wrestlerId}/matches?status=confirmed`}>
        Confirmed <Badge value={confirmed} />
      </Btn>

      {/* Messages */}
      <Link
        href={`/parent/wrestlers/${wrestlerId}/messages` as any}
        className="relative rounded-md bg-white/5 px-3 py-2 text-sm ring-1 ring-inset ring-white/10 hover:bg-white/10"
        title={err ? "Retry loading" : "Open messages"}
        onClick={(e) => {
          if (err) {
            e.preventDefault();
            const retryCtrl = new AbortController();
            setLoading(true);
            fetchSummary(retryCtrl.signal);
          }
        }}
      >
        Messages
        <MsgPill value={msgBubble} />
      </Link>
    </>
  );
}
