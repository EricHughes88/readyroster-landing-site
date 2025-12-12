"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

type RRRole = "Coach" | "Parent" | "Athlete" | "Admin";

export default function ClientNav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  // 🚫 Do NOT render nav on homepage (marketing page has its own header)
  const isHome = pathname === "/";
  if (isHome) return null;

  const [localRole, setLocalRole] = useState<RRRole | null>(null);

  // Pull role from localStorage for instant UI (before session loads)
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
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 mr-auto"
          aria-label="Ready Roster home"
        >
          <Image
            src="/rr-icon-white.png"
            alt="Ready Roster"
            width={26}
            height={26}
            priority
            unoptimized
          />
          <span className="text-base sm:text-lg font-bold">
            Ready Roster
          </span>
        </Link>

        {/* Right-side actions */}
        {role ? (
          <>
            <Link
              href={role === "Coach" ? "/coach" : "/parent"}
              className="rounded-lg px-3 py-2 bg-white text-slate-900 text-xs sm:text-sm font-semibold"
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 bg-slate-800 text-white text-xs sm:text-sm font-semibold"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-700 transition"
            >
              Log In
            </Link>
            <Link
              href="/create-account"
              className="rounded-lg bg-gradient-to-b from-[#ff3b3b] to-[#e31d2d] px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow hover:-translate-y-0.5 transition-transform"
            >
              Get Started
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
