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

// Normalize any role string from the DB / session into
// one of our canonical values with capitalized first letter.
function normalizeRole(rawRole: unknown): RRSavedUser["role"] {
  const r = String(rawRole || "").trim().toLowerCase();

  if (r === "coach") return "Coach";
  if (r === "athlete") return "Athlete";
  if (r === "admin") return "Admin";

  // default / fallback
  return "Parent";
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

    if (typeof window !== "undefined") {
      localStorage.setItem("rr_user", JSON.stringify(saved));
    }

    return saved;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();

  const rawCallback = search.get("callbackUrl");
  // Only trust relative paths; otherwise ignore
  const callbackUrl =
    rawCallback && rawCallback.startsWith("/") ? rawCallback : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Map NextAuth ?error= codes → friendly text
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

  // If already logged in, hydrate rr_user and bounce to correct dashboard
  useEffect(() => {
    (async () => {
      const u = await fetchSessionUser();
      if (!u) return; // not logged in yet

      if (callbackUrl) {
        router.replace(callbackUrl as any);
      } else if (u.role === "Coach") {
        router.replace("/coach" as any);
      } else {
        // Parent & Athlete currently share the parent dashboard
        router.replace("/parent" as any);
      }
    })();
  }, [router, callbackUrl]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false, // we control redirect
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

      if (callbackUrl) {
        router.push(callbackUrl as any);
      } else if (u.role === "Coach") {
        router.push("/coach" as any);
      } else {
        // Parent & Athlete currently share the parent dashboard
        router.push("/parent" as any);
      }
    });
  }

  return (
    <main className="rr-container">
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
      </div>
    </main>
  );
}
