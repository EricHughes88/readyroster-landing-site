// app/_components/ClientNav.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

type RRRole = "Coach" | "Parent" | "Athlete" | "Admin";

function normalizeRole(raw: unknown): RRRole {
  const r = String(raw || "").trim().toLowerCase();
  if (r === "coach") return "Coach";
  if (r === "athlete") return "Athlete";
  if (r === "admin") return "Admin";
  return "Parent";
}

export default function ClientNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // ✅ Always run hooks
  const [localRole, setLocalRole] = useState<RRRole | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ✅ Mark mounted (prevents hydration edge cases)
  useEffect(() => setMounted(true), []);

  // ✅ Read role from localStorage AFTER mount
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem("rr_user");
      if (!raw) return setLocalRole(null);
      const parsed = JSON.parse(raw);
      const role = parsed?.role ? normalizeRole(parsed.role) : null;
      setLocalRole(role);
    } catch {
      setLocalRole(null);
    }
  }, [mounted]);

  // ✅ When NextAuth session becomes available, sync it into localStorage
  useEffect(() => {
    if (!mounted) return;
    if (status !== "authenticated") return;

    const u = session?.user as any;
    if (!u?.id) return;

    const saved = {
      id: Number(u.id),
      email: u.email ?? null,
      name: u.name ?? null,
      role: normalizeRole(u.role),
    };

    try {
      localStorage.setItem("rr_user", JSON.stringify(saved));
      setLocalRole(saved.role);
    } catch {
      // ignore
    }
  }, [mounted, status, session]);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // ✅ Hide nav on auth pages (after hooks)
  const hideNav = pathname === "/login" || pathname === "/create-account";
  if (hideNav) return null;

  const isHome = pathname === "/";

  // ✅ Determine role from session first, then localStorage
  const roleFromSession =
    status === "authenticated"
      ? normalizeRole((session?.user as any)?.role)
      : null;

  const role: RRRole | null = roleFromSession ?? localRole ?? null;

  // ✅ Determine "logged in" reliably
  // Show authed UI if session is authenticated OR localStorage has a user role
  const showAuthedUI = status === "authenticated" || !!localRole;

  const dashHref =
    role === "Coach"
      ? "/coach"
      : role === "Parent"
      ? "/parent"
      : role === "Athlete"
      ? "/athlete"
      : role === "Admin"
      ? "/admin"
      : "/login";

  const closeMenu = () => setMenuOpen(false);

  async function handleLogout() {
    try {
      localStorage.removeItem("rr_user");
      localStorage.removeItem("rr_selected_wrestler_id");
    } catch {
      // ignore
    }
    await signOut({ callbackUrl: "/login" });
  }

  // Don’t render nav until mounted to avoid any hydration weirdness
  if (!mounted) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-3">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 mr-auto min-w-0"
          aria-label="Ready Roster home"
          onClick={closeMenu}
        >
          <Image
            src="/rr-icon-white.png"
            alt="Ready Roster"
            width={28}
            height={28}
            priority
            unoptimized
          />
          <span className="text-lg font-bold whitespace-nowrap">Ready Roster</span>
        </Link>

        {/* Desktop links (md+) */}
        {isHome && (
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-200">
            <a href="#features" className="hover:text-red-400">
              Features
            </a>
            <a href="#how" className="hover:text-red-400">
              How it Works
            </a>
            <a href="#faq" className="hover:text-red-400">
              FAQ
            </a>
          </div>
        )}

        {/* Desktop auth buttons (md+) */}
        <div className="hidden md:flex items-center gap-3">
          {showAuthedUI ? (
            <>
              <Link
                href={dashHref as any}
                className="rounded-lg px-3 py-2 bg-white text-slate-900 text-sm font-semibold"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-2 bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition"
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
                <a
                  href="#features"
                  onClick={closeMenu}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                >
                  Features
                </a>
                <a
                  href="#how"
                  onClick={closeMenu}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                >
                  How it Works
                </a>
                <a
                  href="#faq"
                  onClick={closeMenu}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                >
                  FAQ
                </a>
              </div>
            )}

            <div className="flex gap-2">
              {showAuthedUI ? (
                <>
                  <Link
                    href={dashHref as any}
                    onClick={closeMenu}
                    className="flex-1 text-center rounded-lg bg-white px-3 py-2 font-semibold text-slate-900"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      closeMenu();
                      handleLogout();
                    }}
                    className="flex-1 rounded-lg bg-slate-800 px-3 py-2 font-semibold text-white hover:bg-slate-700 transition"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="flex-1 text-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-semibold text-white"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/create-account"
                    onClick={closeMenu}
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
