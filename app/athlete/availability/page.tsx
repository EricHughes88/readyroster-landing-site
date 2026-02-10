"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export default function AthleteAvailabilityPage() {
  const [eventName, setEventName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [weightClass, setWeightClass] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [notes, setNotes] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/athlete/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: eventName,
            age_group: ageGroup,
            weight_class: weightClass,
            city: city || null,
            state: stateVal || null,
            notes: notes || null,
            is_available: isAvailable,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          setErr(data?.message || `Save failed (${res.status})`);
          return;
        }

        setMsg("Availability saved! This will now appear in Admin traction analytics.");
        setEventName("");
        setAgeGroup("");
        setWeightClass("");
        setCity("");
        setStateVal("");
        setNotes("");
        setIsAvailable(true);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Update Availability</h1>
            <p className="text-slate-300 mt-1">
              Tell coaches what event/age/weight you’re available for. This also powers Admin traction analytics.
            </p>
          </div>

          <Link
            href="/athlete"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700"
          >
            ← Back
          </Link>
        </div>

        {err && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-100">
            {err}
          </div>
        )}
        {msg && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-100">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Event Name *</label>
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-slate-400"
              placeholder="e.g., Freakshow Nationals"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Age Group *</label>
              <input
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-slate-400"
                placeholder="e.g., 12U"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Weight Class *</label>
              <input
                value={weightClass}
                onChange={(e) => setWeightClass(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-slate-400"
                placeholder="e.g., 130"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">City (optional)</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-slate-400"
                placeholder="e.g., Elmira"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">State (optional)</label>
              <input
                value={stateVal}
                onChange={(e) => setStateVal(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-slate-400"
                placeholder="e.g., NY"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[90px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-slate-400"
              placeholder="Anything coaches should know..."
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="h-4 w-4"
            />
            I’m currently available
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-4 py-2 font-semibold"
          >
            {isPending ? "Saving..." : "Save Availability"}
          </button>
        </form>
      </div>
    </main>
  );
}
