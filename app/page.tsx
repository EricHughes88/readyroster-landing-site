"use client";

import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* ===== Navbar ===== */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <a href="/" className="flex items-center gap-3">
          {/* Icon-only logo (white) */}
          <Image
            src="/rr-icon-white.png"
            alt="Ready Roster"
            width={36}
            height={36}
            priority
          />
          <span className="text-xl font-bold">Ready Roster</span>
        </a>
        <nav className="flex gap-6">
          <a href="#features" className="hover:text-red-400">Features</a>
          <a href="#how" className="hover:text-red-400">How it Works</a>
          <a href="#pricing" className="hover:text-red-400">Pricing</a>
          <a href="#faq" className="hover:text-red-400">FAQ</a>
        </nav>
      </header>

      {/* ===== Hero ===== */}
      <section className="flex flex-col items-center text-center py-20 px-6">
        {/* Title row: icon slightly offset left */}
        <div className="flex items-center justify-center mb-4">
          <Image
            src="/rr-icon-red.png"
            alt="Ready Roster Icon"
            width={64}
            height={64}
            priority
            className="relative left-[-10px] mr-2"
          />
          <h1 className="text-5xl font-extrabold text-white">Ready Roster</h1>
        </div>

        <p className="text-lg text-slate-300 max-w-2xl mb-6">
          The digital free-agent marketplace for youth wrestling. Connect athletes
          with teams, confirm matches, and streamline communication.
        </p>

        <div className="flex gap-4">
          <a
            href="#get-started"
            className="px-6 py-3 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition"
          >
            Get Started
          </a>
          <a
            href="#login"
            className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-semibold hover:bg-slate-700 transition"
          >
            Log In
          </a>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="scroll-mt-24 py-20 px-6 bg-slate-900">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="p-6 bg-slate-800 rounded-xl shadow">
            <h3 className="text-xl font-semibold mb-2">Athlete Profiles</h3>
            <p className="text-slate-300">
              Showcase your experience, accolades, and availability to get noticed by coaches.
            </p>
          </div>
          <div className="p-6 bg-slate-800 rounded-xl shadow">
            <h3 className="text-xl font-semibold mb-2">Team Needs</h3>
            <p className="text-slate-300">
              Coaches can post weight class needs and instantly connect with available athletes.
            </p>
          </div>
          <div className="p-6 bg-slate-800 rounded-xl shadow">
            <h3 className="text-xl font-semibold mb-2">Messaging</h3>
            <p className="text-slate-300">
              Built-in chat between coaches and athletes once a match is confirmed.
            </p>
          </div>
        </div>
      </section>

      {/* ===== How It Works ===== */}
      <section id="how" className="scroll-mt-24 py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="max-w-4xl mx-auto space-y-6 text-slate-300">
          <p>1. Athletes create a profile with their age, weight class, and event availability.</p>
          <p>2. Coaches post team needs for specific events and weight classes.</p>
          <p>3. The system matches athletes and coaches based on event + weight class.</p>
          <p>4. Both sides confirm → once matched, messaging opens and the athlete is marked as filled.</p>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="scroll-mt-24 py-20 px-6 bg-slate-900">
        <h2 className="text-3xl font-bold text-center mb-12">Pricing</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="p-8 bg-slate-800 rounded-xl shadow text-center">
            <h3 className="text-2xl font-semibold mb-4">Athletes</h3>
            <p className="text-slate-300 mb-6">Free to create a profile and get discovered.</p>
            <p className="text-4xl font-bold mb-6">$10/mo</p>
            <a
              href="#signup"
              className="px-6 py-3 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition"
            >
              Get Started
            </a>
          </div>
          <div className="p-8 bg-slate-800 rounded-xl shadow text-center">
            <h3 className="text-2xl font-semibold mb-4">Coaches</h3>
            <p className="text-slate-300 mb-6">
              Affordable plans for unlimited team needs and athlete connections.
            </p>
            <p className="text-4xl font-bold mb-6">$10/mo</p>
            <a
              href="#signup"
              className="px-6 py-3 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition"
            >
              Get Started
            </a>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="scroll-mt-24 py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-12">FAQ</h2>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h3 className="text-xl font-semibold">Can I do multiple events at a time?</h3>
            <p className="text-slate-300">
              Yes - Athlete or Coach can put their entire schedule out there and it will match them to that specific event.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">Can I use it on my phone?</h3>
            <p className="text-slate-300">
              Yes — it works great on mobile browsers, and you can install it as an app (PWA).
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">What events are supported?</h3>
            <p className="text-slate-300">
              Any wrestling event — simply enter the event name when creating a need or profile.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="py-8 px-6 border-t border-slate-800 text-center text-slate-400">
        <div className="flex justify-center mb-4">
          {/* Small icon in footer */}
          <Image
            src="/rr-icon-white.png"
            alt="Ready Roster Icon"
            width={28}
            height={28}
          />
        </div>
        <p>&copy; {new Date().getFullYear()} Ready Roster. All rights reserved.</p>
      </footer>
    </main>
  );
}

