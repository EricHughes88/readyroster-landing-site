"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import FollowAthleteButton from "@/components/athlete/FollowAthleteButton";

type Profile = {
  id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  city?: string | null;
  state?: string | null;
  dob?: string | null;
  parent_user_id?: number | null;
  parent_firstname?: string | null;
  parent_lastname?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
};

type Interest = {
  id: number;
  event_name?: string | null;
  event_date?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type Match = {
  id: number;
  status?: string | null;
  event_name?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  team_name?: string | null;
  team_coach_name?: string | null;
  created_at?: string | null;
};

type ApiResponse = {
  ok: boolean;
  athleteId?: number;
  profile?: Profile | null;
  interests?: Interest[];
  matches?: Match[];
  message?: string;
};

function safe(v?: string | null) {
  return (v ?? "").trim();
}

function formatDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US");
}

function formatDateTime(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

export default function CoachAthleteProfilePage() {
  const params = useParams();
  const athleteId = Number((params as any)?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/athletes/${athleteId}`, {
          cache: "no-store",
        });

        const data: ApiResponse = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message ?? "Failed to load athlete profile.");
        }

        if (cancelled) return;

        setProfile(data.profile ?? null);
        setInterests(Array.isArray(data.interests) ? data.interests : []);
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message ?? e ?? "Failed to load athlete profile."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (Number.isFinite(athleteId) && athleteId > 0) {
      load();
    } else {
      setError("Invalid athlete id.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  useEffect(() => {
    if (!Number.isFinite(athleteId) || athleteId <= 0) return;

    fetch("/api/views", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetType: "athlete",
        targetId: athleteId,
      }),
    }).catch(() => {});
  }, [athleteId]);

  const athleteName = useMemo(() => {
    const fn = safe(profile?.first_name);
    const ln = safe(profile?.last_name);
    return `${fn} ${ln}`.trim() || "Unknown Athlete";
  }, [profile]);

  const location = useMemo(() => {
    const c = safe(profile?.city);
    const s = safe(profile?.state);
    if (c && s) return `${c}, ${s}`;
    return c || s || "—";
  }, [profile]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-300">Loading athlete profile...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <Link
              href="/coach"
              className="text-slate-300 underline underline-offset-4 hover:text-white"
            >
              ← Back to dashboard
            </Link>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
            <h1 className="text-2xl font-bold">Athlete Profile</h1>
            <p className="mt-3 text-red-100">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold">Athlete Profile</h1>
            <p className="mt-2 text-slate-300">
              Review this athlete before sending a match request.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {Number.isFinite(athleteId) && athleteId > 0 && (
              <FollowAthleteButton athleteId={athleteId} />
            )}

            <Link
              href="/coach"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-xs text-slate-400">Athlete</div>
              <div className="mt-1 text-2xl font-bold">{athleteName}</div>

              <div className="mt-5">
                <div className="text-xs text-slate-400">DOB</div>
                <div className="mt-1">{formatDateOnly(profile?.dob)}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Location</div>
              <div className="mt-1 text-lg font-semibold">{location}</div>

              <div className="mt-5">
                <div className="text-xs text-slate-400">Athlete ID</div>
                <div className="mt-1">{profile?.id ?? "—"}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3 font-bold">
            Athlete Posts (Interests)
          </div>

          <div className="p-4">
            {interests.length === 0 ? (
              <div className="text-slate-400">No posts yet.</div>
            ) : (
              <div className="space-y-4">
                {interests.map((i) => (
                  <div
                    key={i.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <div className="text-lg font-bold">{i.event_name ?? "—"}</div>

                    <div className="mt-2 text-sm text-slate-300">
                      Age: {i.age_group ?? "—"} | Weight: {i.weight_class ?? "—"}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      Event Date: {formatDateOnly(i.event_date)}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      Created: {formatDateTime(i.created_at)}
                    </div>

                    {i.notes ? (
                      <div className="mt-3 text-sm text-slate-200">
                        Notes: {i.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3 font-bold">
            Existing Matches / Requests
          </div>

          <div className="p-4">
            {matches.length === 0 ? (
              <div className="text-slate-400">No matches yet.</div>
            ) : (
              <div className="space-y-4">
                {matches.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <div className="text-lg font-bold">{m.event_name ?? "—"}</div>

                    <div className="mt-2 text-sm text-slate-300">
                      Status: {m.status ?? "pending"} | Age: {m.age_group ?? "—"} | Weight:{" "}
                      {m.weight_class ?? "—"}
                    </div>

                    <div className="mt-1 text-sm text-slate-300">
                      Team: {m.team_name ?? "—"}
                      {m.team_coach_name ? ` (${m.team_coach_name})` : ""}
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      Created: {formatDateTime(m.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}