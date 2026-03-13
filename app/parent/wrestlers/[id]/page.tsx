// app/parent/wrestlers/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ShareButton from "@/components/shared/ShareButton";
import AthleteRecruitingCard from "@/components/athlete/AthleteRecruitingCard";

type WrestlerSummary = {
  id?: number;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  event_name?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
};

type Interest = {
  id: number;
  event_name?: string | null;
  event_date?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  notes?: string | null;
};

type Match = {
  id: number;
  event_name?: string | null;
  event_date?: string | null;
  status?: string | null;
};

function fmtDate(raw?: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
}

export default function ParentWrestlerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const wrestlerId = Number(params.id);

  const [summary, setSummary] = useState<WrestlerSummary | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

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
        if (on) setLoading(false);
      }
    })();

    return () => {
      on = false;
    };
  }, [wrestlerId]);

  const handleBack = () => {
    router.push("/parent");
  };

  const displayName = useMemo(() => {
    if (summary?.name) return summary.name;
    const combined = `${summary?.first_name ?? ""} ${summary?.last_name ?? ""}`.trim();
    return combined || "Athlete";
  }, [summary]);

  const pageTitle = displayName !== "Athlete" ? displayName : "Athlete Profile";

  const handleHeaderMessagesClick = () => {
    if (pendingMatches.length > 0 && pendingMatches[0].id) {
      router.push(`/messages/${pendingMatches[0].id}`);
    } else {
      console.log("No pending matches to message yet");
    }
  };

  const shareTitle = `${displayName} | Ready Roster`;
  const shareText = `Check out ${displayName}'s athlete profile on Ready Roster`;
  const shareUrl = origin ? `${origin}/athletes/${wrestlerId}` : undefined;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <button
              onClick={handleBack}
              className="mb-2 text-xs text-slate-400 hover:text-slate-200"
            >
              ← Back to dashboard
            </button>

            <h1 className="text-2xl font-semibold">{pageTitle}</h1>

            {summary?.event_name && (
              <p className="text-sm text-slate-300">{summary.event_name}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <ShareButton
              title={shareTitle}
              text={shareText}
              url={shareUrl}
              className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
            />

            <button
              type="button"
              onClick={handleHeaderMessagesClick}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Messages
            </button>

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

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading wrestler...
          </div>
        ) : (
          <>
            <div className="rounded-xl">
              <AthleteRecruitingCard
                firstName={summary?.first_name ?? ""}
                lastName={summary?.last_name ?? ""}
                ageGroup={summary?.age_group ?? null}
                weightClass={summary?.weight_class ?? null}
                city={summary?.city ?? null}
                state={summary?.state ?? null}
                eventName={summary?.event_name ?? null}
                notes={summary?.notes ?? null}
              />
            </div>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Profile
                </h2>
                <p>
                  Name: <span className="text-slate-100">{displayName}</span>
                </p>
                {summary?.age_group && (
                  <p>
                    Age Group:{" "}
                    <span className="text-slate-100">{summary.age_group}</span>
                  </p>
                )}
                {summary?.weight_class && (
                  <p>
                    Weight:{" "}
                    <span className="text-slate-100">{summary.weight_class}</span>
                  </p>
                )}
                {(summary?.city || summary?.state) && (
                  <p>
                    Location:{" "}
                    <span className="text-slate-100">
                      {[summary?.city, summary?.state].filter(Boolean).join(", ")}
                    </span>
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Interests
                </h2>
                <p>
                  Total Interests:{" "}
                  <span className="text-slate-100">{interests.length}</span>
                </p>

                <div className="mt-3">
                  <Link
                    href={`/parent/wrestlers/${wrestlerId}/interests`}
                    className="inline-flex rounded-md bg-slate-800 px-3 py-2 text-xs text-slate-100 border border-slate-700 hover:bg-slate-700"
                  >
                    Manage Interests
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pending Matches
                </h2>
                <p>
                  Pending:{" "}
                  <span className="text-slate-100">{pendingMatches.length}</span>
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Event Interests
              </h2>
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
                    {interests.length > 0 ? (
                      interests.map((i) => (
                        <tr key={i.id} className="border-t border-slate-800">
                          <td className="px-3 py-2">{i.event_name ?? "—"}</td>
                          <td className="px-3 py-2">{fmtDate(i.event_date)}</td>
                          <td className="px-3 py-2">{i.age_group ?? "—"}</td>
                          <td className="px-3 py-2">{i.weight_class ?? "—"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-sm text-slate-400"
                        >
                          No interests yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Pending Matches
              </h2>
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
                    {pendingMatches.length > 0 ? (
                      pendingMatches.map((m) => (
                        <tr key={m.id} className="border-t border-slate-800">
                          <td className="px-3 py-2">
                            {m.event_name ?? "Event"}
                            {m.event_date ? ` - ${fmtDate(m.event_date)}` : ""}
                          </td>
                          <td className="px-3 py-2 capitalize">
                            {m.status ?? "pending"}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => router.push(`/messages/${m.id}`)}
                              className="text-xs rounded bg-slate-800 px-3 py-1 hover:bg-slate-700 border border-slate-700"
                            >
                              Message coach
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-sm text-slate-400"
                        >
                          No pending matches yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}