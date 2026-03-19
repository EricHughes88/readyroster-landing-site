// app/parent/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DeleteAccountButton from "@/components/account/DeleteAccountButton";
import TeamLogo from "@/components/team/TeamLogo";
import ParentQuickSummary from "@/components/parent/ParentQuickSummary";
import ParentRecommendedActions from "@/components/parent/ParentRecommendedActions";

type PotentialMatch = {
  wrestler_interest_id: number;
  wrestler_id?: number;
  firstname?: string | null;
  lastname?: string | null;
  coach_need_id: number;
  coach_user_id?: number;
  event_name: string | null;
  event_date?: string | null;
  weight_class: string | null;
  age_group: string | null;
  city?: string | null;
  state?: string | null;
  teamid?: number | null;
  teamname: string | null;
  coach_name: string | null;
  contactemail?: string | null;
  logopath?: string | null;
  coach_viewed?: boolean;
  coach_viewed_at?: string | null;
};

type RecentCoachViewer = {
  viewer_user_id?: number;
  viewed_at?: string | null;
  wrestler_id?: number;
  firstname?: string | null;
  lastname?: string | null;
  teamid?: number | null;
  teamname?: string | null;
  coach_name?: string | null;
  contactemail?: string | null;
  logopath?: string | null;
};

type PotentialMatchesResponse = {
  ok: boolean;
  role?: string;
  potentialMatches?: PotentialMatch[];
  recentCoachViewers?: RecentCoachViewer[];
  message?: string;
  error?: string;
};

function safeText(value: unknown, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function formatEventDate(value?: string | null) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatViewedAt(value?: string | null) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWrestlerName(firstname?: string | null, lastname?: string | null) {
  const first = safeText(firstname, "").trim();
  const last = safeText(lastname, "").trim();
  const full = `${first} ${last}`.trim();
  return full || "Wrestler";
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([]);
  const [recentCoachViewers, setRecentCoachViewers] = useState<RecentCoachViewer[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [matchesError, setMatchesError] = useState("");

  useEffect(() => {
    const u = getSessionUser();

    if (!u) {
      router.replace("/login");
      return;
    }

    const role = String(u.role || "").trim().toLowerCase();

    if (role === "coach") {
      router.replace("/coach");
      return;
    }

    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    async function loadPotentialMatches() {
      try {
        setLoadingMatches(true);
        setMatchesError("");

        const res = await fetch("/api/matches/potential", {
          cache: "no-store",
        });

        const data: PotentialMatchesResponse = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.message || "Failed to load potential matches");
        }

        if (!cancelled) {
          setPotentialMatches(
            Array.isArray(data.potentialMatches) ? data.potentialMatches : []
          );
          setRecentCoachViewers(
            Array.isArray(data.recentCoachViewers) ? data.recentCoachViewers : []
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          setMatchesError(err?.message || "Failed to load potential matches");
          setPotentialMatches([]);
          setRecentCoachViewers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMatches(false);
        }
      }
    }

    loadPotentialMatches();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const totalPotentialMatches = useMemo(
    () => potentialMatches.length,
    [potentialMatches]
  );

  if (!ready) {
    return null;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100">
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-semibold">Parent Dashboard</h1>
        <p className="text-slate-300">
          Manage your wrestler profiles, interests, matches, and messages.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/parent/wrestlers"
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 transition-colors hover:border-slate-500 hover:bg-slate-900/90"
        >
          <h2 className="mb-1 font-semibold">My Wrestlers</h2>
          <p className="text-xs text-slate-300">
            View and manage wrestler profiles you&apos;ve added.
          </p>
        </Link>

        <Link
          href="/parent/wrestlers/new"
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 transition-colors hover:border-slate-500 hover:bg-slate-900/90"
        >
          <h2 className="mb-1 font-semibold">Add Wrestler</h2>
          <p className="text-xs text-slate-300">
            Create a new wrestler profile to get started.
          </p>
        </Link>

        <Link
          href="/parent/matches"
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 transition-colors hover:border-slate-500 hover:bg-slate-900/90"
        >
          <h2 className="mb-1 font-semibold">Matches</h2>
          <p className="text-xs text-slate-300">
            Review pending and confirmed team matches.
          </p>
        </Link>

        <Link
          href="/parent/messages"
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 transition-colors hover:border-slate-500 hover:bg-slate-900/90"
        >
          <h2 className="mb-1 font-semibold">Messages</h2>
          <p className="text-xs text-slate-300">
            Chat with coaches once a match is made.
          </p>
        </Link>
      </section>

      <section className="mt-10">
        <ParentQuickSummary />
      </section>

      <section className="mt-10">
        <ParentRecommendedActions />
      </section>

      <section className="mt-10 rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
        <div className="flex flex-col gap-3 border-b border-slate-700 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Recently Viewed By Coaches</h2>
            <p className="mt-1 text-sm text-slate-300">
              Coaches who have recently looked at your athletes.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full border border-cyan-700 bg-cyan-900/40 px-4 py-2 text-sm font-semibold text-cyan-300">
            {loadingMatches
              ? "Loading..."
              : `${recentCoachViewers.length} recent view${
                  recentCoachViewers.length === 1 ? "" : "s"
                }`}
          </div>
        </div>

        {loadingMatches ? (
          <div className="py-8 text-sm text-slate-300">Loading recent views...</div>
        ) : recentCoachViewers.length === 0 ? (
          <div className="py-8 text-sm text-slate-400">
            No recent coach profile views yet.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {recentCoachViewers.map((viewer, idx) => {
              const wrestlerName = formatWrestlerName(viewer.firstname, viewer.lastname);
              const viewedAt = formatViewedAt(viewer.viewed_at);

              return (
                <div
                  key={`${viewer.viewer_user_id}-${viewer.wrestler_id}-${idx}`}
                  className="rounded-2xl border border-slate-700 bg-slate-950/50 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        Recently Viewed
                      </div>
                      <h3 className="mt-1 text-lg font-bold text-white">
                        {safeText(viewer.coach_name, "A coach")}
                      </h3>
                      <p className="mt-1 text-sm text-slate-300">
                        Team: {safeText(viewer.teamname, "Unnamed Team")}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Wrestler: {wrestlerName}
                      </p>
                      {viewedAt ? (
                        <p className="mt-1 text-xs text-slate-400">
                          Viewed: {viewedAt}
                        </p>
                      ) : null}
                    </div>

                    <TeamLogo
                      logoPath={viewer.logopath ?? null}
                      teamName={viewer.teamname ?? "Team"}
                      size={56}
                      rounded={false}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
        <div className="flex flex-col gap-3 border-b border-slate-700 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Potential Matches</h2>
            <p className="mt-1 text-sm text-slate-300">
              Teams and coaches that currently match your wrestler interests.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-300">
            {loadingMatches
              ? "Loading..."
              : `${totalPotentialMatches} opportunit${
                  totalPotentialMatches === 1 ? "y" : "ies"
                }`}
          </div>
        </div>

        {loadingMatches ? (
          <div className="py-10 text-sm text-slate-300">
            Loading potential matches...
          </div>
        ) : matchesError ? (
          <div className="mt-6 rounded-xl border border-red-700 bg-red-950/40 p-4 text-sm text-red-300">
            {matchesError}
          </div>
        ) : totalPotentialMatches === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-600 bg-slate-950/40 p-8 text-center">
            <div className="text-lg font-semibold text-white">
              No potential matches yet
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Once your wrestler interests line up with coach needs, they will show up here.
            </p>
            <Link
              href="/parent/wrestlers"
              className="mt-4 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Manage Wrestlers
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {potentialMatches.map((match) => {
              const eventDate = formatEventDate(match.event_date);
              const viewedAt = formatViewedAt(match.coach_viewed_at);
              const location =
                [safeText(match.city, ""), safeText(match.state, "")]
                  .filter(Boolean)
                  .join(", ") || null;

              const wrestlerName = formatWrestlerName(
                match.firstname,
                match.lastname
              );

              return (
                <div
                  key={`${match.wrestler_interest_id}-${match.coach_need_id}`}
                  className="rounded-2xl border border-slate-700 bg-slate-950/50 p-5 shadow-sm transition hover:border-slate-500"
                >
                  <div className="mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-300">
                      Wrestler
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-white">
                      {wrestlerName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {safeText(match.age_group)} • {safeText(match.weight_class)}
                    </p>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-lg font-bold text-white">
                        {safeText(match.teamname, "Unnamed Team")}
                      </h4>
                      <p className="mt-1 text-sm text-slate-300">
                        Coach: {safeText(match.coach_name)}
                      </p>
                    </div>

                    <TeamLogo
                      logoPath={match.logopath ?? null}
                      teamName={match.teamname ?? "Team"}
                      size={56}
                      rounded={false}
                    />
                  </div>

                  {match.coach_viewed ? (
                    <div className="mt-4 rounded-xl border border-emerald-700 bg-emerald-950/40 px-3 py-2">
                      <div className="text-sm font-semibold text-emerald-300">
                        👀 {safeText(match.coach_name, "A coach")} viewed this athlete
                      </div>
                      {viewedAt ? (
                        <div className="mt-1 text-xs text-emerald-200/80">
                          Last viewed: {viewedAt}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-800/70 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Event
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">
                        {safeText(match.event_name)}
                      </div>
                      {eventDate ? (
                        <div className="mt-1 text-xs text-slate-300">
                          {eventDate}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl bg-slate-800/70 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Division
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">
                        {safeText(match.age_group)} • {safeText(match.weight_class)}
                      </div>
                    </div>
                  </div>

                  {location ? (
                    <div className="mt-3 text-sm text-slate-300">
                      Location: {location}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/matches/create?wrestler_interest_id=${match.wrestler_interest_id}&coach_need_id=${match.coach_need_id}` as any}
                      className="inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                      Send Match Request
                    </Link>

                    <Link
                      href="/parent/matches"
                      className="inline-flex rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                    >
                      View My Matches
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Account Settings</h2>

        <div className="max-w-md">
          <DeleteAccountButton />
        </div>
      </section>
    </main>
  );
}