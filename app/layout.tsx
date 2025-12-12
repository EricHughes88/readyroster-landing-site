// app/page.tsx
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="bg-slate-950 text-white">
      {/* ================= HERO ================= */}
      <section className="relative mx-auto max-w-6xl px-6 pt-10 md:pt-16 pb-20 text-center">
        <div className="flex flex-col items-center gap-6">
          <Image
            src="/rr-icon-red.png"
            alt="Ready Roster"
            width={56}
            height={56}
            priority
            unoptimized
          />

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Ready Roster
          </h1>

          <p className="max-w-2xl text-lg md:text-xl text-slate-300 leading-relaxed">
            The digital free-agent marketplace for youth wrestling.
            <br />
            Connect athletes with teams, confirm matches, and streamline
            communication.
          </p>

          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <Link
              href="/create-account"
              className="rounded-xl bg-gradient-to-b from-[#ff3b3b] to-[#e31d2d]
                         px-8 py-4 text-base font-semibold text-white
                         shadow-lg hover:-translate-y-0.5 transition-transform"
            >
              Get Started
            </Link>

            <Link
              href="/login"
              className="rounded-xl bg-slate-800 px-8 py-4
                         text-base font-semibold text-white
                         border border-slate-700 hover:bg-slate-700 transition"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section
        id="features"
        className="bg-gradient-to-b from-slate-900 to-slate-950 py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              title="Athlete Profiles"
              text="Showcase experience, accolades, and availability so coaches can make confident decisions."
            />
            <FeatureCard
              title="Team Needs"
              text="Post exact weight classes and age groups needed for upcoming events."
            />
            <FeatureCard
              title="Match & Message"
              text="Request matches, confirm both sides, and communicate all in one place."
            />
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            How It Works
          </h2>

          <p className="text-lg text-slate-300 leading-relaxed">
            Athletes list availability. Coaches post needs.
            <br />
            Ready Roster matches them — both sides confirm — done.
          </p>
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section
        id="pricing"
        className="bg-gradient-to-b from-slate-900 to-slate-950 py-20"
      >
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Simple Pricing
          </h2>
          <p className="text-lg text-slate-300">
            Free to get started. Premium features coming soon.
          </p>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">FAQ</h2>
          <p className="text-lg text-slate-300">
            Built by wrestling people — for wrestling people.
          </p>
        </div>
      </section>
    </main>
  );
}

/* ================= COMPONENT ================= */

function FeatureCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-slate-300 leading-relaxed">{text}</p>
    </div>
  );
}
