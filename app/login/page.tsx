"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

type RRRole = "Coach" | "Parent" | "Athlete" | "Admin";

type RRSavedUser = {
  id: number | string;
  email: string | null;
  name: string | null;
  role: RRRole;
};

function normalizeRole(rawRole: unknown): RRRole {
  const r = String(rawRole || "").trim().toLowerCase();
  if (r === "coach") return "Coach";
  if (r === "athlete") return "Athlete";
  if (r === "admin") return "Admin";
  return "Parent";
}

async function fetchSessionUser(): Promise<RRSavedUser | null> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    const u = data?.user;
    if (!u?.id) return null;

    const saved: RRSavedUser = {
      id: u.id,
      email: u.email ?? null,
      name: u.name ?? null,
      role: normalizeRole(u.role),
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
  const callbackUrl =
    rawCallback && rawCallback.startsWith("/") ? rawCallback : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Show NextAuth errors (if any)
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

  // If already logged in, go straight to callbackUrl or role dashboard
  useEffect(() => {
    (async () => {
      const u = await fetchSessionUser();
      if (!u) return;

      if (callbackUrl) router.replace(callbackUrl as any);
      else if (u.role === "Admin") router.replace("/admin" as any);
      else if (u.role === "Coach") router.replace("/coach" as any);
      else router.replace("/parent" as any);
    })();
  }, [router, callbackUrl]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl ?? "/parent",
      });

      if (!result) {
        setErr("Sign in did not return a response. Please try again.");
        return;
      }

      if (result.error) {
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

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      const u = await fetchSessionUser();
      if (!u) {
        window.location.href = callbackUrl ?? "/parent";
        return;
      }

      if (callbackUrl) router.push(callbackUrl as any);
      else if (u.role === "Admin") router.push("/admin" as any);
      else if (u.role === "Coach") router.push("/coach" as any);
      else router.push("/parent" as any);
    });
  }

  return (
    <main className="rr-container">
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

          <div className="text-right -mt-2">
            <Link
              href="/forgot-password"
              className="text-sm text-slate-300 hover:text-white underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="rr-btn rr-btn-primary w-full"
            disabled={isPending}
          >
            {isPending ? "Signing in…" : "Log in"}
          </button>

          <a href="/admin/login" className="rr-btn w-full text-center mt-2">
            Admin Login
          </a>
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