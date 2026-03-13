"use client";

import { useEffect, useState } from "react";

type AttendanceRow = {
  id: number;
  event_name: string;
  event_date: string | null;
};

export default function EventTracker() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function loadRows() {
    try {
      setLoading(true);
      const res = await fetch("/api/event-attendance", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) {
        setRows(Array.isArray(data.rows) ? data.rows : []);
      }
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function addEvent() {
    if (!eventName.trim()) return;

    try {
      setWorking(true);

      await fetch("/api/event-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName, eventDate: eventDate || null }),
      });

      setEventName("");
      setEventDate("");
      await loadRows();
    } catch (err) {
      console.error("Failed to add event:", err);
    } finally {
      setWorking(false);
    }
  }

  async function removeEvent(name: string) {
    try {
      setWorking(true);

      await fetch("/api/event-attendance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName: name }),
      });

      await loadRows();
    } catch (err) {
      console.error("Failed to remove event:", err);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold">Events I’m Attending</h3>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="Event name"
          className="rounded-xl border px-3 py-2"
        />
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
        <button
          type="button"
          onClick={addEvent}
          disabled={working}
          className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          Add Event
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading events...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No events added yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-xl border px-3 py-2"
              >
                <div>
                  <div className="font-medium">{row.event_name}</div>
                  <div className="text-sm text-gray-500">
                    {row.event_date || "No date selected"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeEvent(row.event_name)}
                  className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}