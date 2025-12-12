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

  const [localRole, setLocalRole] = useState<RRRole | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const sessionRole = (session?.user && (session.user as any).role) || null;
  const role: RRRole | null = (sessionRole as RRRole) ?? localRole;

  function handleLogout() {
    try {
      localStorage.removeItem("rr_user");
    } catch {
      // ignore
    }
    signOut({ callbackUrl: "/" });
  }

  const dashHref = role === "Coach" ? "/coach" : "/parent";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-3">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 mr-auto min-w-0"
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
          <span className="text-lg font-bold whitespace-nowrap">
            Ready Roster
          </span>
        </Link>

        {/* Desktop links (only on md+) */}
        {isHome && (
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-200">
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
          </div>
        )}

        {/* Desktop auth buttons (md+) */}
        <div className="hidden md:flex items-center gap-3">
          {role ? (
            <>
              <Link
                href={dashHref}
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
        </div>

        {/* Mobile menu button (below md) */}
        <button
          type="button"
          className="md:hidden rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95">
          <div className="mx-auto max-w-6xl px-4 py-3 space-y-3 text-sm">
            {isHome && (
              <div className="grid grid-cols-2 gap-2 text-slate-200">
                <a href="#features" className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  Features
                </a>
                <a href="#how" className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  How it Works
                </a>
                <a href="#pricing" className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  Pricing
                </a>
                <a href="#faq" className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  FAQ
                </a>
              </div>
            )}

            <div className="flex gap-2">
              {role ? (
                <>
                  <Link
                    href={dashHref}
                    className="flex-1 text-center rounded-lg bg-white px-3 py-2 font-semibold text-slate-900"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex-1 rounded-lg bg-slate-800 px-3 py-2 font-semibold text-white"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex-1 text-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-semibold text-white"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/create-account"
                    className="flex-1 text-center rounded-lg bg-gradient-to-b from-[#ff3b3b] to-[#e31d2d] px-3 py-2 font-semibold text-white"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
