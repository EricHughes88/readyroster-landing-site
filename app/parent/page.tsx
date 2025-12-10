// app/parent/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/session";

type RRRole = "Coach" | "Parent" | "Athlete" | "Admin";

export default function ParentDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getSessionUser();

    // Not logged in → go to login
    if (!u) {
      router.replace("/login");
      return;
    }

    const role = String(u.role || "").trim().toLowerCase();

    // If this user is actually a coach, send them to Coach dashboard
    if (role === "coach") {
      router.replace("/coach");
      return;
    }

    // Parent / Athlete are allowed to see this page
    setReady(true);
  }, [router]);

  // While we’re deciding where they belong, don't flash the wrong dashboard
  if (!ready) {
    return null; // or a small "Loading…" message if you prefer
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Parent Dashboard</h1>
        <p className="text-slate-300">
          Manage your wrestler profiles, interests, matches, and messages.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* My Wrestlers */}
        <Link
          href="/parent/wrestlers"
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 hover:border-slate-500 hover:bg-slate-900/90 transition-colors"
        >
          <h2 className="font-semibold mb-1">My Wrestlers</h2>
          <p className="text-xs text-slate-300">
            View and manage wrestler profiles you&apos;ve added.
          </p>
        </Link>

        {/* Add Wrestler */}
        <Link
          href="/parent/wrestlers/new"
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 hover:border-slate-500 hover:bg-slate-900/90 transition-colors"
        >
          <h2 className="font-semibold mb-1">Add Wrestler</h2>
          <p className="text-xs text-slate-300">
            Create a new wrestler profile to get started.
          </p>
        </Link>

        {/* Matches */}
        <Link
          href="/parent/matches"
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 hover:border-slate-500 hover:bg-slate-900/90 transition-colors"
        >
          <h2 className="font-semibold mb-1">Matches</h2>
          <p className="text-xs text-slate-300">
            Review pending and confirmed team matches.
          </p>
        </Link>

        {/* Messages */}
        <Link
          href="/parent/messages"
          className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 hover:border-slate-500 hover:bg-slate-900/90 transition-colors"
        >
          <h2 className="font-semibold mb-1">Messages</h2>
          <p className="text-xs text-slate-300">
            Chat with coaches once a match is made.
          </p>
        </Link>
      </section>
    </main>
  );
}
