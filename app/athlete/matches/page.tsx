// app/athlete/matches/page.tsx
"use client";

import Link from "next/link";

export default function AthleteMatchesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">Your Matches</h1>
        <p className="text-slate-300 mb-6">
          This page will eventually show this athlete&apos;s pending and
          confirmed matches. For now, it&apos;s a placeholder so the app can
          deploy cleanly.
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
