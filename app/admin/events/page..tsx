"use client";

import { useEffect, useState } from "react";

type EventRow = {
  event_name: string;
  total_athletes: number;
  avg_travel_miles: number | null;
  max_travel_miles: number | null;
  out_of_state_count: number;
};

function formatMiles(v?: number | null) {
  if (!v) return "—";
  return `${Math.round(v)} mi`;
}

export default function AdminEventsPage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/events/analytics", {
        cache: "no-store",
      });
      const data = await res.json();
      setRows(data.rows || []);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-3xl font-extrabold mb-6">
        Event Intelligence
      </h1>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Athletes</th>
                <th className="px-4 py-3 text-left">Avg Travel</th>
                <th className="px-4 py-3 text-left">Max Travel</th>
                <th className="px-4 py-3 text-left">Out-of-State</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold">
                    {r.event_name}
                  </td>
                  <td className="px-4 py-3">
                    {r.total_athletes}
                  </td>
                  <td className="px-4 py-3">
                    {formatMiles(r.avg_travel_miles)}
                  </td>
                  <td className="px-4 py-3">
                    {formatMiles(r.max_travel_miles)}
                  </td>
                  <td className="px-4 py-3">
                    {r.out_of_state_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}