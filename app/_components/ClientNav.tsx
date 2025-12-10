// app/_components/ClientNav.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

type RRRole = "Coach" | "Parent" | "Athlete" | "Admin";

export default function ClientNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [localRole, setLocalRole] = useState<RRRole | null>(null);

  const isHome = pathname === "/";

  // Read role from localStorage for early render
  useEffect(() => {
    try {
      const raw = localStorage.getItem("rr_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.role) setLocalRole(parsed.role as RRRole);
      }
    } catch {
      // ignore
    }
  }, []);

  const sessionRole =
    (session?.user && (session.user as any).role) || null;

  const role: RRRole | null = (sessionRole as RRRole) ?? localRole;

  function handleLogout() {
    try {
      localStorage.removeItem("rr_user");
    } catch {
      // ignore
    }
    signOut({ callbackUrl: "/" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-3 mr-auto"
          aria-label="Ready Roster home"
        >
          <Image
            src="/rr-icon-white.png"
            alt="Ready Roster"
            width={28}
            height={28}
            priority
            unoptimized
          />
          <span className="text-lg font-bold">Ready Roster</span>
        </Link>

        {isHome && (
          <>
            <a href="#features" className="hover:text-red-400">
              Features
            </a>
            <a href="#how" className="hover:text-red-400">
              How it Works
            </a>
            <a href="#pricing" className="hover:text-red-400">
              Pricing
            </a>
            <a href="#faq" className="hover:text-red-400">
              FAQ
            </a>
          </>
        )}

        {role ? (
          <>
            <Link
              href={role === "Coach" ? "/coach" : "/parent"}
              className="rounded-lg px-3 py-2 bg-white text-slate-900 text-sm font-semibold"
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 bg-slate-800 text-white text-sm font-semibold"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-slate-700/70 bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
            >
              Log In
            </Link>
            <Link
              href="/create-account"
              className="rounded-lg bg-gradient-to-b from-[#ff3b3b] to-[#e31d2d] px-3 py-2 text-sm font-semibold text-white shadow-lg hover:-translate-y-0.5 transition-transform"
            >
              Get Started
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
