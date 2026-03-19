// components/parent/ParentQuickSummary.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Route } from "next";

type ParentSummaryRoute =
  | "/parent/notifications"
  | "/parent/matches"
  | "/parent/wrestlers";

type ParentSummaryItem = {
  id: string;
  label: string;
  value: number;
  href: ParentSummaryRoute;
  tone: "cyan" | "emerald" | "amber" | "red";
};

type ApiResponse = {
  ok: boolean;
  summary: ParentSummaryItem[];
  message?: string;
};

function toneClasses(tone: ParentSummaryItem["tone"]) {
  switch (tone) {
    case "red":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "cyan":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
    case "emerald":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "amber":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-slate-200";
  }
}

function valueClasses(tone: ParentSummaryItem["tone"]) {
  switch (tone) {
    case "red":
      return "text-red-300";
    case "cyan":
      return "text-cyan-300";
    case "emerald":
      return "text-emerald-300";
    case "amber":
      return "text-amber-300";
    default:
      return "text-white";
  }
}

export default function ParentQuickSummary() {
  const [summary, setSummary] = useState<ParentSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/parent/summary", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();

      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error(
          "Parent summary API returned HTML instead of JSON. Check app/api/parent/summary/route.ts and restart the dev server."
        );
      }

      let data: ApiResponse;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Parent summary API returned invalid JSON.");
      }

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to load quick summary");
      }

      setSummary(Array.isArray(data.summary) ? data.summary : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load quick summary");
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#06122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">Quick Summary</h2>
        <p className="mt-1 text-sm text-slate-300">
          Your at-a-glance snapshot for this week.
        </p>
      </div>

      <div className="border-t border-white/10 pt-4">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-2xl border border-white/10 bg-[#081735] p-4"
              >
                <div className="mb-3 h-4 w-24 rounded bg-white/10" />
                <div className="h-8 w-16 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map((item) => (
              <Link
                key={item.id}
                href={item.href as Route}
                className={`rounded-2xl border p-4 transition hover:scale-[1.01] ${toneClasses(
                  item.tone
                )}`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
                  {item.label}
                </div>
                <div className={`mt-3 text-3xl font-bold ${valueClasses(item.tone)}`}>
                  {item.value}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}