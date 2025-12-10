"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type InterestRow = {
  id: number;
  event_name: string | null;
  event_date: string | null; // "YYYY-MM-DD" or null
  weight_class: string | null;
  age_group: string | null;
  notes: string | null;
  // Optional fields if you haven't added them yet, the component still works:
  parent_ok?: boolean | null;
  coach_ok?: boolean | null;
  created_at?: string | null;
};

type ApiResponse = {
  ok: boolean;
  interests: InterestRow[];
  page: { limit: number; offset: number; total: number };
  message?: string;
};

function statusOf(i: InterestRow): "pending" | "confirmed" {
  if (i.parent_ok === true && i.coach_ok === true) return "confirmed";
  return "pending";
}

function Badge({
  children,
  kind = "default",
}: {
  children: React.ReactNode;
  kind?: "default" | "green" | "amber";
}) {
  const styles =
    kind === "green"
      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/20"
      : kind === "amber"
      ? "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/20"
      : "bg-white/5 text-gray-200 ring-1 ring-inset ring-white/10";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${styles}`}>{children}</span>
  );
}

export default function InterestsList({
  wrestlerId,
  limit = 8,
  showHeader = true,
}: {
  wrestlerId: number;
  limit?: number;
  showHeader?: boolean;
}) {
  const [rows, setRows] = useState<InterestRow[] | null>(null);
  const [tab, setTab] = useState<"all" | "pending" | "confirmed">("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/wrestlers/${wrestlerId}/interests`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        if (!mounted) return;
        if (!data.ok) {
          setErr(data.message ?? "Failed to load interests");
          setRows([]);
        } else {
          setRows(data.interests ?? []);
        }
      })
      .catch(() => {
        if (mounted) {
          setErr("Failed to load interests");
          setRows([]);
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [wrestlerId]);

  const total = rows?.length ?? 0;

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (tab === "all") return rows.slice(0, limit);
    return rows.filter((r) => statusOf(r) === tab).slice(0, limit);
  }, [rows, tab, limit]);

  if (loading && rows === null) {
    return (
      <div className="rounded-xl border border-white/10 p-4 text-sm text-gray-300">
        Loading interests…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-rose-500/30 p-4 text-sm text-rose-200">
        {err}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 p-6 text-sm text-gray-300">
        No interests yet.{" "}
        <Link
          href={`/parent/wrestlers/${wrestlerId}/interests`}
          className="underline decoration-white/30 hover:decoration-white"
        >
          Add one now
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10">
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-100">
            Saved Interests <span className="opacity-70">({total})</span>
          </h3>
          <div className="flex gap-2">
            {(["all", "pending", "confirmed"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1 rounded-md text-xs ${
                  tab === k
                    ? "bg-white/10 text-white"
                    : "text-gray-300 hover:bg-white/5"
                }`}
              >
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="divide-y divide-white/10">
        {filtered.map((i) => {
          const st = statusOf(i);
          return (
            <li
              key={i.id}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-gray-100">
                    {i.event_name ?? "Event"}{" "}
                    {i.event_date ? `• ${i.event_date}` : ""}
                  </span>
                  <Badge kind={st === "confirmed" ? "green" : "amber"}>
                    {st === "confirmed" ? "Confirmed" : "Pending"}
                  </Badge>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {i.age_group ?? "Age ?"} • {i.weight_class ?? "Weight ?"}
                  {i.notes ? (
                    <span className="ml-2 text-gray-500">— {i.notes}</span>
                  ) : null}
                </div>
              </div>
              <Link
                href={`/parent/wrestlers/${wrestlerId}/interests?focus=${i.id}`}
                className="text-xs px-2 py-1 rounded-md bg-white/5 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                title="Open in Manage Interests"
              >
                Edit
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="px-4 py-3 border-t border-white/10 text-right">
        <Link
          href={`/parent/wrestlers/${wrestlerId}/interests`}
          className="text-xs underline decoration-white/30 hover:decoration-white"
        >
          Add / Manage Interests →
        </Link>
      </div>
    </div>
  );
}
