// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 font-bold">
              RR
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Ready Roster
            </span>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
            <a href="#how-it-works" className="hover:text-red-300">
              How it works
            </a>
            <a href="#who-its-for" className="hover:text-red-300">
              Who it’s for
            </a>
            <a href="#features" className="hover:text-red-300">
              Features
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-300 hover:text-red-300"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-red-500"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:items-center">
          <div className="flex-1 space-y-6">
            <p className="inline rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-200">
              Built for youth wrestling
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Fill your lineup.  
              <span className="text-red-400"> Match athletes fast.</span>
            </h1>
            <p className="max-w-xl text-sm text-slate-300 sm:text-base">
              Ready Roster connects coaches with available athletes for duals,
              quads, and team events. Post your needs, see matching wrestlers,
              and lock in lineups without digging through group chats and
              spreadsheets.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-red-500"
              >
                Create free account
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Log in to dashboard
              </Link>
            </div>

            <p className="text-xs text-slate-400">
              Coaches, parents, and club directors can all use Ready Roster. No
              long setup. Just create an account and start posting needs or
              athletes.
            </p>
          </div>

          <div className="flex-1">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Live example
              </p>
              <div className="space-y-3 text-xs text-slate-200">
                <div className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2">
                  <div>
                    <p className="font-semibold">Dual at Summer Nationals</p>
                    <p className="text-[11px] text-slate-400">
                      Coach Smith • 12U • Looking for 64, 68, 72
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-300">
                    3 matches found
                  </span>
                </div>

                <div className="rounded-lg bg-slate-900 px-3 py-3">
                  <p className="mb-2 text-[11px] font-semibold text-slate-400">
                    Matching athletes
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Logan H. • 12U 64</p>
                        <p className="text-[11px] text-slate-400">
                          From 2.1 hours away • 45–18 record
                        </p>
                      </div>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300">
                        Available
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Eli M. • 12U 68</p>
                        <p className="text-[11px] text-slate-400">
                          Parents approved • Club: Titans WC
                        </p>
                      </div>
                      <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] text-amber-300">
                        Pending coach
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Coaches and parents both confirm before an athlete is locked
                  into your lineup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="mx-auto max-w-6xl px-4 py-10 space-y-6"
      >
        <h2 className="text-xl font-semibold">How Ready Roster works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-sm font-semibold mb-1">1. Post needs</p>
            <p className="text-sm text-slate-300">
              Coaches post open weights by event, age group, and location.
              Parents list their athlete&apos;s availability and travel range.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-sm font-semibold mb-1">2. Get matches</p>
            <p className="text-sm text-slate-300">
              Ready Roster matches needs and athletes in seconds instead of
              hours of messages, spreadsheets, and guesswork.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-sm font-semibold mb-1">3. Confirm together</p>
            <p className="text-sm text-slate-300">
              Both the coach and parent confirm before anything is final, so
              everyone stays on the same page.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 md:flex-row">
          <p>© {new Date().getFullYear()} Ready Roster. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#how-it-works" className="hover:text-red-300">
              How it works
            </a>
            <a href="#who-its-for" className="hover:text-red-300">
              For coaches & parents
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
