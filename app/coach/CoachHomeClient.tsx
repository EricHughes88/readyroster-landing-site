// app/coach/CoachHomeClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import CoachRadar from "@/components/coach/CoachRadar";
import FollowedAthletesPanel from "@/components/coach/FollowedAthletesPanel";
import RecruitingMap from "@/components/coach/RecruitingMap";

type UserLike = {
  id: number | string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

type NeedRow = {
  id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  city: string | null;
  state: string | null;
  status?: string | null;
};

type NeedsApiResponse =
  | {
      ok?: boolean;
      needs?: NeedRow[];
    }
  | NeedRow[];

type TeamProfile = {
  teamName: string;
  coachName: string;
  contactEmail: string;
  logoPath?: string | null;
};

type TeamApiResponse = {
  ok: boolean;
  team: TeamProfile | null;
  message?: string;
};

function fmtDate(raw: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtLocation(city: string | null, state: string | null) {
  if (!city && !state) return "—";
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? "—";
}

function fmtStatus(status?: string | null) {
  if (!status) return "Open";
  const lower = status.toLowerCase();
  if (lower === "closed") return "Closed";
  return "Open";
}

export default function CoachHomeClient({ user }: { user: UserLike }) {
  const router = useRouter();

  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [loadingNeeds, setLoadingNeeds] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [team, setTeam] = useState<TeamProfile | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [loadingTeam, setLoadingTeam] = useState<boolean>(true);

  useEffect(() => {
    if (!user?.id) return;

    const saved = {
      id: Number(user.id),
      email: user.email ?? null,
      name: user.name ?? null,
      role: (user.role as "Coach" | "Parent" | "Athlete" | "Admin") ?? "Coach",
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("rr_user", JSON.stringify(saved));
    }
  }, [user]);

  useEffect(() => {
    const role = (user.role || "").toLowerCase();
    if (role && role !== "coach") {
      if (role === "parent") router.replace("/parent" as any);
      else if (role === "athlete") router.replace("/athlete" as any);
      else if (role === "admin") router.replace("/admin" as any);
      else router.replace("/login?callbackUrl=/coach" as any);
    }
  }, [router, user.role]);

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      setLoadingNeeds(true);
      setErr(null);
      try {
        const coachId = Number(user.id);
        if (!coachId) {
          setNeeds([]);
          setLoadingNeeds(false);
          return;
        }

        const qs = new URLSearchParams({
          coachUserId: String(coachId),
          limit: "6",
        });

        const res = await fetch(`/api/coach/needs?${qs.toString()}`, {
          cache: "no-store",
        });

        const data = (await res.json()) as NeedsApiResponse;

        if (Array.isArray(data)) setNeeds(data);
        else if (data && Array.isArray(data.needs)) setNeeds(data.needs);
        else setNeeds([]);
      } catch (e: any) {
        console.error("coach dashboard needs error", e);
        setErr(e?.message || "Failed to load your team needs.");
        setNeeds([]);
      } finally {
        setLoadingNeeds(false);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      setLoadingTeam(true);
      setTeamError(null);
      try {
        const res = await fetch("/api/coach/team-profile", {
          cache: "no-store",
        });
        const data = (await res.json()) as TeamApiResponse;

        if (!res.ok || !data.ok) {
          throw new Error(data?.message || "Failed to load team profile");
        }

        setTeam(data.team ?? null);
      } catch (e: any) {
        console.error("coach team profile error", e);
        setTeam(null);
        setTeamError(e?.message || "Failed to load team profile.");
      } finally {
        setLoadingTeam(false);
      }
    })();
  }, [user?.id]);

  const handlePostNeed = () => router.push("/coach/needs/new");
  const handleViewNeeds = () => router.push("/coach/needs");
  const handleMatchRequests = () => router.push("/coach/matches?status=pending");
  const handlePending = () => router.push("/coach/matches?status=pending");
  const handleConfirmed = () => router.push("/coach/matches?status=confirmed");
  const handleMessages = () => router.push("/coach/matches?status=confirmed");
  const handleEditTeamProfile = () => router.push("/coach/team-profile" as any);

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("rr_user");
      }
    } finally {
      await signOut({ callbackUrl: "/login" });
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-1 text-2xl font-semibold">Coach Dashboard</h1>

              <p className="mb-1 text-sm text-slate-300">
                Welcome, {user?.name ?? "Coach"}
                {user?.email ? (
                  <span className="text-slate-400"> ({user.email})</span>
                ) : null}
              </p>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Team:</span>
                <span className="text-xs font-semibold text-white">
                  {loadingTeam ? "Loading…" : team?.teamName || "No team set yet"}
                </span>
                <button
                  onClick={handleEditTeamProfile}
                  className="text-xs text-blue-300 underline hover:text-blue-200"
                >
                  Edit team profile
                </button>
                {teamError && (
                  <span className="text-[10px] text-rose-300">({teamError})</span>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="h-8 rounded border border-slate-700 bg-slate-800 px-3 text-xs hover:bg-slate-700"
              title="Logout"
            >
              Logout
            </button>
          </div>

          <div className="mt-1 flex flex-wrap gap-3">
            <button
              onClick={handlePostNeed}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Post a Need
            </button>

            <button
              onClick={handleViewNeeds}
              className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              View My Needs
            </button>

            <button
              onClick={handleMatchRequests}
              className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              Match Requests
            </button>

            <button
              onClick={handlePending}
              className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              Pending
            </button>

            <button
              onClick={handleConfirmed}
              className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              Confirmed
            </button>

            <button
              onClick={handleMessages}
              className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              Messages
            </button>
          </div>
        </div>

        <div className="mb-8">
          <CoachRadar />
        </div>

        <div className="mb-8">
          <FollowedAthletesPanel />
        </div>

        <div className="mb-8">
          <RecruitingMap />
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Your Recent Needs</h2>
            <Link
              href="/coach/needs"
              className="text-xs text-slate-300 underline hover:text-white"
            >
              Manage all
            </Link>
          </div>

          {err && (
            <div className="mb-4 rounded border border-red-600 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          )}

          {loadingNeeds ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-sm text-slate-300">
              Loading your needs…
            </div>
          ) : needs.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-sm text-slate-300">
              No needs yet. Click{" "}
              <button onClick={handlePostNeed} className="text-slate-100 underline">
                Post a Need
              </button>{" "}
              to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full overflow-hidden rounded-xl border border-slate-800 text-sm">
                <thead className="bg-slate-900/80 text-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Event</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Weight</th>
                    <th className="px-3 py-2 text-left">Age Group</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {needs.map((n) => (
                    <tr key={n.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">{n.event_name ?? "Untitled event"}</td>
                      <td className="px-3 py-2">{fmtDate(n.event_date)}</td>
                      <td className="px-3 py-2">{n.weight_class ?? "—"}</td>
                      <td className="px-3 py-2">{n.age_group ?? "—"}</td>
                      <td className="px-3 py-2">{fmtLocation(n.city, n.state)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            (n.status ?? "").toLowerCase() === "closed"
                              ? "bg-rose-900/60 text-rose-200"
                              : "bg-emerald-900/50 text-emerald-200"
                          }`}
                        >
                          {fmtStatus(n.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/coach/needs/${n.id}/matches`}
                          className="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                        >
                          Find Matches
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}