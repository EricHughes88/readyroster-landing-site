// app/signup/page.tsx
import Link from "next/link";
import type { Route } from "next";

type Role = "Athlete" | "Coach" | "Parent";

type RoleCardProps = {
  role: Role;
  description: string;
  href: Route | string;
  icon: React.ReactNode;
};

function RoleCard({ role, description, href, icon }: RoleCardProps) {
  return (
    <Link
      href={href as Route}
      className="group block rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 transition-colors p-6"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-slate-800/70 p-3 text-slate-200">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{role}</h3>
          <p className="mt-1 text-sm text-slate-300">{description}</p>
          <span className="mt-3 inline-flex items-center text-sm text-slate-200/80 group-hover:text-white">
            Get started
            <svg className="ml-1 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold">Create your Ready Roster account</h1>
        <p className="mt-2 text-slate-300">
          Choose the role that fits how you’ll use Ready Roster.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <RoleCard
          role="Athlete"
          description="Post your details and get matched with teams looking for your weight class and age group."
          href={"/create-account?role=Athlete" as Route}
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
              <path
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 20a8 8 0 0116 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />

        <RoleCard
          role="Coach"
          description="Post team needs, review matched athletes, and confirm matches with messaging built in."
          href={"/create-account?role=Coach" as Route}
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
              <path
                d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />

        <RoleCard
          role="Parent"
          description="Create and manage profiles for one or more wrestlers, track interests, matches, and messages."
          href={"/create-account?role=Parent" as Route}
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
              <path
                d="M16 11a4 4 0 10-8 0M3 20a9 9 0 0118 0M7 9a3 3 0 10-6 0M23 20a7 7 0 00-10-6.326"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </section>

      <p className="mt-8 text-sm text-slate-400">
        Already have an account?{" "}
        <Link href={"/login" as Route} className="underline underline-offset-4 hover:text-white">
          Log in
        </Link>
        .
      </p>
    </main>
  );
}
