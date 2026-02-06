// app/login/page.tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

type RRSavedUser = {
  id: number;
  email: string | null;
  name: string | null;
  role: "Coach" | "Parent" | "Athlete" | "Admin";
};

// Normalize any role string from the DB / session
function normalizeRole(rawRole: unknown): RRSavedUser["role"] {
  const r = String(rawRole || "").trim().toLowerCase();
  if (r === "coach") return "Coach";
  if (r === "athlete") return "Athlete";
  if (r === "admin") return "Admin";
  return "Parent";
}

function defaultRouteForRole(role: RRSavedUser["role"]) {
  if (role === "Admin") return "/admin";
  if (role === "Coach") return "/coach";
  if (role === "Athlete") return "/athlete"; // change if your athlete home differs
  return "/parent";
}

async function fetchSessionUser(): Promise<RRSavedUser | null> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    const u = data?.user;
    if (!u?.id) return null;

    const role = normalizeRole(u.role);

    const saved: RRSavedUser = {
      id: Number(u.id),
      email: u.email ?? null,
      name: u.name ?? null,
      role,
    };

    // Never let localStorage failures crash login (Safari private mode, blocked storage, etc.)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("rr_user", JSON.stringify(saved));
      } catch {
        // ignore storage errors
      }
    }

    return saved;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();

  // Preserve callbackUrl if it’s a safe internal path
  const rawCallback = search.get("callbackUrl");
  const callbackUrl =
    rawCallback && rawCallback.startsWith("/") ? rawCallback : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Map NextAuth errors → friendly text
  useEffect(() => {
    const e = search.get("error");
    if (!e) return setErr(null);

    const map: Record<string, string> = {
      CredentialsSignin: "Invalid email or password.",
      missing_credentials: "Please provide both email and password.",
      user_not_found: "No account found for that email.",
      bad_password: "Invalid email or password.",
      default: "Could not sign in. Please try again.",
    };

    setErr(map[e] ?? map.default);
  }, [search]);

  // If already logged in, redirect appropriately
  useEffect(() => {
    (async () => {
      try {
        const u = await fetchSessionUser();
        if (!u) return;

        if (callbackUrl) router.replace(callbackUrl as any);
        else router.replace(defaultRouteForRole(u.role) as any);
      } catch (e) {
        console.error("[login] pre-redirect crash", e);
        // do not crash the page
      }
    })();
  }, [router, callbackUrl]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    startTransition(async () => {
      try {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl: callbackUrl ?? "/",
        });

        if (result?.error) {
          const map: Record<string, string> = {
            CredentialsSignin: "Invalid email or password.",
            missing_credentials: "Please provide both email and password.",
            user_not_found: "No account found for that email.",
            bad_password: "Invalid email or password.",
            default: "Could not sign in. Please try again.",
          };
          setErr(map[result.error] ?? map.default);
          return;
        }

        const u = await fetchSessionUser();
        if (!u) {
          setErr("Login succeeded but could not load session.");
          return;
        }

        const dest = callbackUrl ?? defaultRouteForRole(u.role);
        router.push(dest as any);
      } catch (e: any) {
        console.error("[login] crashed:", e);
        setErr(`Login crashed: ${String(e?.message || e)}`);
      }
    });
  }

  return (
    <main className="rr-container">
      {/* ✅ Back to Home */}
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-white underline"
        >
          ← Back to Home
        </Link>
      </div>

      <div className="rr-card">
        <h1 className="text-2xl font-semibold mb-2">Log in</h1>
        <p className="text-slate-300 mb-6">Welcome back to Ready Roster.</p>

        {err && <div className="rr-alert rr-alert-error mb-4">{err}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="rr-label">Email</span>
            <input
              className="rr-input"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="rr-label">Password</span>
            <input
              className="rr-input"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="rr-btn rr-btn-primary w-full"
            disabled={isPending}
          >
            {isPending ? "Signing in…" : "Log in"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-300">
          Don’t have an account?{" "}
          <Link href="/create-account" className="text-white underline">
            Create one
          </Link>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-200">
            Return to itsreadyroster.com
          </Link>
        </div>
      </div>
    </main>
  );
}
