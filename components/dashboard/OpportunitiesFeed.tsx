// components/dashboard/OpportunitiesFeed.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Route } from "next";

type OpportunityPriority = "high" | "medium" | "low";

type AppRoute =
  | "/coach"
  | "/coach/matches"
  | "/coach/notifications"
  | "/parent"
  | "/parent/matches"
  | "/parent/notifications"
  | "/athlete"
  | "/athlete/matches"
  | "/athlete/notifications"
  | "/admin"
  | "/admin/notifications"
  | "/matches"
  | "/notifications"
  | "/";

type OpportunityItem = {
  id: string;
  type:
    | "potential_matches"
    | "pending_matches"
    | "unread_notifications"
    | "stale_profile"
    | "expiring_interest";
  title: string;
  message: string;
  priority: OpportunityPriority;
  count?: number;
  href?: AppRoute | null;
  createdAt?: string | null;
};

type ApiResponse = {
  ok: boolean;
  opportunities: OpportunityItem[];
  message?: string;
};

function priorityClasses(priority: OpportunityPriority) {
  switch (priority) {
    case "high":
      return "border-red-200 bg-red-50 text-red-800";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function priorityLabel(priority: OpportunityPriority) {
  switch (priority) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    default:
      return "Low";
  }
}

export default function OpportunitiesFeed() {
  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/user/opportunities", { cache: "no-store" });
      const data: ApiResponse = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to load opportunities");
      }

      setItems(Array.isArray(data.opportunities) ? data.opportunities : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load opportunities");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Opportunities Feed</h2>
          <p className="text-sm text-slate-600">
            Personalized updates, action items, and new opportunities.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="animate-pulse rounded-xl border border-slate-200 p-4"
            >
              <div className="mb-2 h-4 w-40 rounded bg-slate-200" />
              <div className="h-3 w-full rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No new opportunities right now. Once new matches, notifications, or action
          items show up, they’ll appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const content = (
              <div className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{item.message}</div>
                  </div>

                  <span
                    className={`rounded-full border px-2 py-1 text-xs font-semibold ${priorityClasses(
                      item.priority
                    )}`}
                  >
                    {priorityLabel(item.priority)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {typeof item.count === "number"
                      ? `${item.count} item${item.count === 1 ? "" : "s"}`
                      : "Update"}
                  </div>

                  <div className="text-sm font-medium text-red-600">
                    {item.href ? "View" : "Info"}
                  </div>
                </div>
              </div>
            );

            if (item.href) {
              return (
                <Link key={item.id} href={item.href as Route} className="block">
                  {content}
                </Link>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
        </div>
      )}
    </section>
  );
}