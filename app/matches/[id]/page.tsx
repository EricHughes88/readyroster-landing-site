// app/matches/[id]/page.tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MatchDetails = {
  id: number;
  status: "pending" | "confirmed";
  parent_ok: boolean | null;
  coach_ok: boolean | null;
  confirmed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  notes: string | null;
  weight_class: string | null;
  age_group: string | null;

  // event data (from need or interest)
  event_name: string | null;
  event_date: string | null;
  interest_event_name: string | null;
  interest_event_date: string | null;
  need_weight_class: string | null;
  need_age_group: string | null;

  wrestler_first_name: string | null;
  wrestler_last_name: string | null;
  wrestler_city: string | null;
  wrestler_state: string | null;

  team_name: string | null;
  team_coach_name: string | null;
  team_logo_path: string | null;
};

type ApiResponse = {
  ok: boolean;
  match: MatchDetails;
  message?: string;
};

export default function MatchDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = Number(params.id);

  const [data, setData] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) {
      setErr("Invalid match id");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/matches/${matchId}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json?.message || "Failed to load match");
        }

        setData(json.match);
      } catch (e: any) {
        setErr(e?.message || "Failed to load match");
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  function fmtDate(raw?: string | null) {
    if (!raw) return "—";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  }

  function fmtDateTime(raw?: string | null) {
    if (!raw) return "—";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  function statusLabel(d: MatchDetails | null) {
    if (!d) return "";
    if (d.status === "confirmed") return "Confirmed";
    if (d.coach_ok && !d.parent_ok) return "Waiting on Parent";
    if (d.parent_ok && !d.coach_ok) return "Waiting on Coach";
    return "Pending";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <p className="text-slate-300">Loading match…</p>
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <p className="text-red-300 mb-4">{err ?? "Match not found."}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded bg-slate-800 border border-slate-600"
        >
          Go back
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Match Details</h1>
          <p className="text-sm text-slate-400">
            Match ID #{data.id} • {statusLabel(data)}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/messages/match/${data.id}` as any}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 border border-slate-500 text-sm"
          >
            Message
          </Link>

          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm"
          >
            Back
          </button>
        </div>
      </div>

      {/* TEAM + WRESTLER */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Team Card */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex gap-3">
          {data.team_logo_path ? (
            <img
              src={data.team_logo_path}
              alt={data.team_name ?? "Team logo"}
              className="w-14 h-14 rounded-full object-cover border border-slate-700"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
              {data.team_name
                ?.split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2) ?? "RR"}
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-1">
              {data.team_name ?? "Team Not Set"}
            </h2>
            <p className="text-sm text-slate-300">
              Coach:{" "}
              <span className="font-medium">
                {data.team_coach_name ?? "—"}
              </span>
            </p>
          </div>
        </section>

        {/* Wrestler Card */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">Wrestler</h2>
          <p className="text-sm font-medium">
            {data.wrestler_first_name} {data.wrestler_last_name}
          </p>
          <p className="text-sm text-slate-300 mt-1">
            {data.wrestler_city && data.wrestler_state
              ? `${data.wrestler_city}, ${data.wrestler_state}`
              : "Location Not Set"}
          </p>
        </section>
      </div>

      {/* EVENT DETAILS */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Event & Division</h2>
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <div>
            <p className="text-slate-400">Event</p>
            <p className="font-medium">
              {data.event_name ?? data.interest_event_name ?? "—"}
            </p>
          </div>

          <div>
            <p className="text-slate-400">Date</p>
            <p className="font-medium">
              {fmtDate(data.event_date ?? data.interest_event_date)}
            </p>
          </div>

          <div>
            <p className="text-slate-400">Division</p>
            <p className="font-medium">
              {(data.need_age_group ?? data.age_group ?? "—") +
                " • " +
                (data.need_weight_class ?? data.weight_class ?? "—") +
                " lbs"}
            </p>
          </div>
        </div>
      </section>

      {/* STATUS */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Status</h2>
        <ul className="text-sm space-y-1">
          <li>
            <span className="font-medium">Created:</span>{" "}
            {fmtDateTime(data.created_at)}
          </li>
          <li>
            <span className="font-medium">Last Updated:</span>{" "}
            {fmtDateTime(data.updated_at)}
          </li>
          <li>
            <span className="font-medium">Coach Response:</span>{" "}
            {data.coach_ok ? "Confirmed" : "Not yet"}
          </li>
          <li>
            <span className="font-medium">Parent Response:</span>{" "}
            {data.parent_ok ? "Confirmed" : "Not yet"}
          </li>
          <li>
            <span className="font-medium">Match Status:</span>{" "}
            {statusLabel(data)}
          </li>
          <li>
            <span className="font-medium">Confirmed At:</span>{" "}
            {fmtDateTime(data.confirmed_at)}
          </li>
        </ul>
      </section>

      {/* NOTES */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-2">Notes</h2>
        <p className="text-sm text-slate-200">
          {data.notes?.trim() ? data.notes : "No additional notes."}
        </p>
      </section>
    </main>
  );
}
