// app/parent/wrestlers/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type WrestlerSummary = any;
type Interest = any;
type Match = any;

export default function ParentWrestlerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const wrestlerId = Number(params.id);

  const [summary, setSummary] = useState<WrestlerSummary | null>(null);
  const [interests, setInterests] = useState<Interest[] | null>(null);
  const [pendingMatches, setPendingMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!wrestlerId) return;

    let on = true;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const [summaryRes, interestsRes, pendingRes] = await Promise.all([
          fetch(`/api/wrestlers/${wrestlerId}/dashboard/summary`, {
            cache: "no-store",
          }),
          fetch(`/api/wrestlers/${wrestlerId}/interests`, {
            cache: "no-store",
          }),
          fetch(`/api/matches?wrestlerId=${wrestlerId}&status=pending`, {
            cache: "no-store",
          }),
        ]);

        const summaryJson = await summaryRes.json();
        const interestsJson = await interestsRes.json();
        const pendingJson = await pendingRes.json();

        if (!on) return;

        if (!summaryRes.ok || !summaryJson.ok) {
          throw new Error(summaryJson?.message || "Failed to load wrestler");
        }

        setSummary(summaryJson.summary ?? summaryJson.data ?? null);
        setInterests(interestsJson.ok ? interestsJson.interests ?? [] : []);
        setPendingMatches(pendingJson.ok ? pendingJson.matches ?? [] : []);
      } catch (e: any) {
        if (!on) return;
        console.error("Parent wrestler page load error", e);
        setErr(e?.message || "Failed to load wrestler data");
      } finally {
        on && setLoading(false);
      }
    })();

    return () => {
      on = false;
    };
  }, [wrestlerId]);

  const handleBack = () => {
    router.push("/parent");
  };

  // --- Safe name resolution (fixed TypeScript error)
  const displayName = summary?.name
    ? summary.name
    : (
        `${summary?.first_name ?? ""} ${summary?.last_name ?? ""}`
          .trim() || "Athlete"
      );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={handleBack}
              className="mb-2 text-xs text-slate-400 hover:text-slate-200"
            >
              ← Back to dashboard
            </button>

            {/* Fixed name logic */}
            <h1 className="text-2xl font-semibold">{displayName}</h1>

            {summary?.event_name && (
              <p className="text-sm text-slate-300">{summary.event_name}</p>
            )}
          </div>

          <div className="flex gap-2">

            {/* Critical: Messages button → correct location */}
            <Link
              href={`/parent/wrestlers/${wrestlerId}/messages`}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Messages
            </Link>

            <button
              onClick={handleBack}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-100 border border-slate-700 hover:bg-slate-700"
            >
              Back
            </button>

          </div>
        </div>

        {err && (
          <div className="rounded border border-red-600 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* Summary Cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Profile
            </h2>
            <p>Name: <span className="text-slate-100">{displayName}</span></p>
            {summary?.age_group && <p>Age Group: <span className="text-slate-100">{summary.age_group}</span></p>}
            {summary?.weight_class && <p>Weight: <span className="text-slate-100">{summary.weight_class}</span></p>}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Interests
            </h2>
            <p>Total Interests: <span className="text-slate-100">{interests?.length ?? 0}</span></p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pending Matches
            </h2>
            <p>Pending: <span className="text-slate-100">{pendingMatches?.length ?? 0}</span></p>
          </div>
        </section>

        {/* Interests Table */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Event Interests</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Event</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Age Group</th>
                  <th className="px-3 py-2 text-left">Weight</th>
                </tr>
              </thead>
              <tbody>
                {interests && interests.length > 0 ? (
                  interests.map((i: any) => (
                    <tr key={i.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">{i.event_name ?? "—"}</td>
                      <td className="px-3 py-2">{i.event_date ?? "—"}</td>
                      <td className="px-3 py-2">{i.age_group ?? "—"}</td>
                      <td className="px-3 py-2">{i.weight_class ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-slate-400">
                      No interests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pending Matches */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Pending Matches</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Event</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingMatches && pendingMatches.length > 0 ? (
                  pendingMatches.map((m: any) => (
                    <tr key={m.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">
                        {m.event_name ?? "Event"}
                        {m.event_date ? ` • ${m.event_date}` : ""}
                      </td>
                      <td className="px-3 py-2 capitalize">{m.status ?? "pending"}</td>

                      <td className="px-3 py-2">
                        <Link
                          href={`/parent/wrestlers/${wrestlerId}/messages?match=${m.id}`}
                          className="text-xs rounded bg-slate-800 px-3 py-1 hover:bg-slate-700 border border-slate-700"
                        >
                          Message coach
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-sm text-slate-400">
                      No pending matches yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}
