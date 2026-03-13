"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FollowedCoach = {
  coach_user_id: number;
  followed_at: string | null;

  firstname: string | null;
  lastname: string | null;
  email: string | null;
  role: string | null;

  teamid: number | null;
  teamname: string | null;
  coach_name: string | null;
  contactemail: string | null;
  city: string | null;
  state: string | null;
  logopath: string | null;

  latest_need_id: number | null;
  latest_need_event_name: string | null;
  latest_need_event_date: string | null;
  latest_need_weight_class: string | null;
  latest_need_age_group: string | null;
  latest_need_city: string | null;
  latest_need_state: string | null;
  latest_need_created_at: string | null;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  coaches: FollowedCoach[];
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function displayCoachName(row: FollowedCoach) {
  const first = String(row.firstname ?? "").trim();
  const last = String(row.lastname ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;

  const coachName = String(row.coach_name ?? "").trim();
  if (coachName) return coachName;

  return "Coach";
}

function locationText(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(", ") || "—";
}

export default function FollowingPage() {
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState<FollowedCoach[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/following/coaches", {
        cache: "no-store",
      });

      const data: ApiResponse = await res.json();

      if (!data?.ok) {
        setMessage(data?.message ?? "Failed to load followed coaches");
        setCoaches([]);
        return;
      }

      setCoaches(Array.isArray(data.coaches) ? data.coaches : []);
    } catch (error) {
      console.error("Failed to load followed coaches:", error);
      setMessage("Failed to load followed coaches");
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUnfollow(coachUserId: number) {
    try {
      setBusyId(coachUserId);

      const res = await fetch(`/api/coaches/${coachUserId}/follow`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data?.ok) {
        alert(data?.message ?? "Failed to unfollow coach");
        return;
      }

      setCoaches((prev) =>
        prev.filter((row) => row.coach_user_id !== coachUserId)
      );
    } catch (error) {
      console.error("Failed to unfollow coach:", error);
      alert("Failed to unfollow coach");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-white">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Ready Roster
        </div>
        <h1 className="mt-2 text-3xl font-bold">Teams You’re Following</h1>
        <p className="mt-2 text-sm text-slate-400">
          Track coaches and teams you want to keep an eye on.
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="text-sm text-slate-300">
          Total followed coaches:{" "}
          <span className="font-semibold text-white">{coaches.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-slate-300">
          Loading followed coaches...
        </div>
      ) : message ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-red-200">
          {message}
        </div>
      ) : coaches.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-slate-300">
          You are not following any coaches yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {coaches.map((coach) => (
            <div
              key={coach.coach_user_id}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Coach Profile
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {displayCoachName(coach)}
                  </h2>
                  <div className="mt-1 text-sm text-slate-400">
                    {coach.teamname || "No team name yet"}
                  </div>
                </div>

                <div className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300">
                  Following
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div>
                  <span className="text-slate-500">Team:</span>{" "}
                  {coach.teamname || "—"}
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>{" "}
                  {coach.contactemail || coach.email || "—"}
                </div>
                <div>
                  <span className="text-slate-500">Location:</span>{" "}
                  {locationText(coach.city, coach.state)}
                </div>
                <div>
                  <span className="text-slate-500">Followed:</span>{" "}
                  {formatDate(coach.followed_at)}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">
                    Latest Open Need
                  </div>

                  {coach.latest_need_id ? (
                    <span className="rounded-full bg-emerald-600/20 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                      Open
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                      None
                    </span>
                  )}
                </div>

                {coach.latest_need_id ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div>
                      <span className="text-slate-500">Event:</span>{" "}
                      {coach.latest_need_event_name || "—"}
                    </div>
                    <div>
                      <span className="text-slate-500">Date:</span>{" "}
                      {formatDate(coach.latest_need_event_date)}
                    </div>
                    <div>
                      <span className="text-slate-500">Age Group:</span>{" "}
                      {coach.latest_need_age_group || "—"}
                    </div>
                    <div>
                      <span className="text-slate-500">Weight:</span>{" "}
                      {coach.latest_need_weight_class || "—"}
                    </div>
                    <div>
                      <span className="text-slate-500">Location:</span>{" "}
                      {locationText(
                        coach.latest_need_city,
                        coach.latest_need_state
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500">Posted:</span>{" "}
                      {formatDate(coach.latest_need_created_at)}
                    </div>

                    <div className="pt-2">
                      <Link
                        href={`/coach/needs/${coach.latest_need_id}/matches` as const}
                        className="inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
                      >
                        View Need Matches
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-400">
                    This coach has no open team needs right now.
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/coaches/${coach.coach_user_id}` as const}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                >
                  View Profile
                </Link>

                <button
                  type="button"
                  onClick={() => handleUnfollow(coach.coach_user_id)}
                  disabled={busyId === coach.coach_user_id}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {busyId === coach.coach_user_id ? "Removing..." : "Unfollow"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}