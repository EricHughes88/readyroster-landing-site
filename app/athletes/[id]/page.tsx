// app/athletes/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ShareButton from "@/components/shared/ShareButton";
import AthleteRecruitingCard from "@/components/athlete/AthleteRecruitingCard";
import FollowAthleteButton from "@/components/athlete/FollowAthleteButton";

type Athlete = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  event_name?: string | null;
};

type Interest = {
  id: number;
  event_name?: string | null;
  event_date?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  notes?: string | null;
};

type ApiResponse = {
  ok: boolean;
  athlete?: Athlete;
  interests?: Interest[];
  message?: string;
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

export default function PublicAthletePage() {
  const params = useParams<{ id: string }>();
  const athleteId = Number(params.id);

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!athleteId) return;

    let active = true;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const res = await fetch(`/api/public/athletes/${athleteId}`, {
          cache: "no-store",
        });

        const data = (await res.json()) as ApiResponse;

        if (!active) return;

        if (!res.ok || !data.ok || !data.athlete) {
          throw new Error(data?.message || "Failed to load athlete");
        }

        setAthlete(data.athlete);
        setInterests(Array.isArray(data.interests) ? data.interests : []);
      } catch (e: any) {
        if (!active) return;
        setErr(e?.message || "Failed to load athlete");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [athleteId]);

  const displayName = useMemo(() => {
    const full = `${athlete?.first_name ?? ""} ${athlete?.last_name ?? ""}`.trim();
    return full || "Athlete";
  }, [athlete]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Ready Roster
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{displayName}</h1>
            <p className="mt-1 text-sm text-slate-400">Public athlete profile</p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <ShareButton
              title={`${displayName} | Ready Roster`}
              text={`Check out ${displayName}'s athlete profile on Ready Roster`}
              url={origin ? `${origin}/athletes/${athleteId}` : undefined}
              className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
            />

            <FollowAthleteButton athleteId={athleteId} />
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading athlete...
          </div>
        ) : err ? (
          <div className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-red-300">
            {err}
          </div>
        ) : !athlete ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Athlete not found.
          </div>
        ) : (
          <>
            <AthleteRecruitingCard
              firstName={athlete.first_name ?? ""}
              lastName={athlete.last_name ?? ""}
              ageGroup={athlete.age_group ?? null}
              weightClass={athlete.weight_class ?? null}
              city={athlete.city ?? null}
              state={athlete.state ?? null}
              eventName={athlete.event_name ?? null}
              notes={athlete.notes ?? null}
            />

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Profile
                </h2>
                <p>
                  Name: <span className="text-slate-100">{displayName}</span>
                </p>
                <p>
                  Age Group:{" "}
                  <span className="text-slate-100">{athlete.age_group || "—"}</span>
                </p>
                <p>
                  Weight:{" "}
                  <span className="text-slate-100">{athlete.weight_class || "—"}</span>
                </p>
                <p>
                  Location:{" "}
                  <span className="text-slate-100">
                    {[athlete.city, athlete.state].filter(Boolean).join(", ") || "—"}
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm md:col-span-2">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Notes
                </h2>
                <p className="text-slate-200">{athlete.notes || "No notes added yet."}</p>
              </div>
            </section>

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
                        <td colSpan={4} className="px-3 py-4 text-sm text-slate-400">
                          No event interests listed yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
              Interested in connecting through Ready Roster?{" "}
              <Link href="/login" className="text-red-400 hover:underline">
                Log in
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}