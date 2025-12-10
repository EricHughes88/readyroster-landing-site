// app/athlete/availability/page.tsx
"use client";

import Link from "next/link";

export default function AthleteAvailabilityPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">Update Availability</h1>
        <p className="text-slate-300 mb-6">
          This screen will let athletes update their availability for events,
          weight classes, and dates. For now, this is just a placeholder page so
          we can deploy.
        </p>

        <Link
          href="/athlete"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700"
        >
          ← Back to Athlete Dashboard
        </Link>
      </div>
    </main>
  );
}
