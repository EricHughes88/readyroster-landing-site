// components/parent/ParentRecommendedActions.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Route } from "next";

type ActionPriority = "high" | "medium" | "low";

type ParentActionRoute =
  | "/parent"
  | "/parent/wrestlers"
  | "/parent/matches"
  | "/parent/messages"
  | "/parent/notifications"
  | "/parent/interests";

type ParentRecommendedAction = {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  ctaLabel: string;
  href: ParentActionRoute;
  count?: number;
};

type ApiResponse = {
  ok: boolean;
  actions: ParentRecommendedAction[];
  message?: string;
};

function priorityPill(priority: ActionPriority) {
  switch (priority) {
    case "high":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "medium":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function priorityLabel(priority: ActionPriority) {
  switch (priority) {
    case "high":
      return "High Priority";
    case "medium":
      return "Recommended";
    default:
      return "Suggestion";
  }
}

export default function ParentRecommendedActions() {
  const [actions, setActions] = useState<ParentRecommendedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/parent/actions", { cache: "no-store" });
      const data: ApiResponse = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to load recommended actions");
      }

      setActions(Array.isArray(data.actions) ? data.actions : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load recommended actions");
      setActions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#06122b] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Recommended Actions</h2>
          <p className="mt-1 text-sm text-slate-300">
            The most important things to do next for your wrestlers.
          </p>
        </div>

        {!loading && actions.length > 0 ? (
          <div className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-1 text-sm font-semibold text-cyan-300">
            {actions.length} action{actions.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 pt-4">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-2xl border border-white/10 bg-[#081735] p-4"
              >
                <div className="mb-3 h-4 w-36 rounded bg-white/10" />
                <div className="mb-2 h-6 w-2/3 rounded bg-white/10" />
                <div className="h-4 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : actions.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            You’re in a great spot right now. No urgent actions are waiting.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {actions.map((action) => (
              <div
                key={action.id}
                className="rounded-2xl border border-white/10 bg-[#081735] p-4 transition hover:border-cyan-400/30"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityPill(
                      action.priority
                    )}`}
                  >
                    {priorityLabel(action.priority)}
                  </span>

                  <div className="text-xs text-slate-400">
                    {typeof action.count === "number"
                      ? `${action.count} item${action.count === 1 ? "" : "s"}`
                      : ""}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white">{action.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {action.description}
                </p>

                <div className="mt-4">
                  <Link
                    href={action.href as Route}
                    className="inline-flex rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
                  >
                    {action.ctaLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}