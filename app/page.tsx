"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* ===== Navbar ===== */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/rr-icon-white.png"
            alt="Ready Roster"
            width={36}
            height={36}
            priority
          />
          <span className="text-xl font-bold">Ready Roster</span>
        </Link>

        <nav className="flex gap-6">
          <a href="#features" className="hover:text-red-400">Features</a>
          <a href="#how" className="hover:text-red-400">How it Works</a>
          <a href="#pricing" className="hover:text-red-400">Pricing</a>
          <a href="#faq" className="hover:text-red-400">FAQ</a>
          <Link href="/login" className="hover:text-red-400 font-semibold">
            Log In
          </Link>
        </nav>
      </header>

      {/* ===== Hero ===== */}
      <section className="flex flex-col items-center text-center py-20 px-6">
        <div className="flex items-center justify-center mb-4">
          <Image
            src="/rr-icon-red.png"
            alt="Ready Roster Icon"
            width={64}
            height={64}
            priority
            className="relative -left-2 mr-2"
          />
          <h1 className="text-5xl font-extrabold">Ready Roster</h1>
        </div>

        <p className="text-lg text-slate-300 max-w-2xl mb-6">
          The digital free-agent marketplace for youth wrestling. Connect athletes
          with teams, confirm matches, and streamline communication.
        </p>

        <div className="flex gap-4">
          <Link
            href="/create-account"
            className="px-6 py-3 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition"
          >
            Get Started
          </Link>

          <Link
            href="/login"
            className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-semibold hover:bg-slate-700 transition"
          >
            Log In
          </Link>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="scroll-mt-24 py-20 px-6 bg-slate-900">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Feature
            title="Athlete Profiles"
            text="Showcase your experience, accolades, and availability to get noticed by coaches."
          />
          <Feature
            title="Team Needs"
            text="Coaches can post weight class needs and instantly connect with available athletes."
          />
          <Feature
            title="Messaging"
            text="Built-in chat between coaches and athletes once a match is confirmed."
          />
        </div>
      </section>

      {/* ===== How It Works ===== */}
      <section id="how" className="scroll-mt-24 py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="max-w-4xl mx-auto space-y-6 text-slate-300">
          <p>1. Athletes create a profile with their age, weight class, and availability.</p>
          <p>2. Coaches post team needs for specific events.</p>
          <p>3. Ready Roster matches athletes and coaches.</p>
          <p>4. Both sides confirm → messaging opens.</p>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="scroll-mt-24 py-20 px-6 bg-slate-900">
        <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {["Athletes", "Coaches"].map((role) => (
            <div
              key={role}
              className="p-8 bg-slate-800 rounded-xl shadow text-center"
            >
              <h3 className="text-2xl font-semibold mb-4">{role}</h3>
              <p className="text-slate-300 mb-6">$10 / month</p>
              <Link
                href="/create-account"
                className="px-6 py-3 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition"
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="scroll-mt-24 py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-12">FAQ</h2>
        <p className="text-center text-slate-300">
          Built by wrestling people — for wrestling people.
        </p>
      </section>

      {/* ===== Footer ===== */}
      <footer className="py-8 px-6 border-t border-slate-800 text-center text-slate-400">
        <div className="flex justify-center mb-4">
          <Image
            src="/rr-icon-white.png"
            alt="Ready Roster Icon"
            width={28}
            height={28}
          />
        </div>
        <p>© {new Date().getFullYear()} Ready Roster. All rights reserved.</p>
      </footer>
    </main>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-6 bg-slate-800 rounded-xl shadow">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-slate-300">{text}</p>
    </div>
  );
}
