"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // If already logged in, head to /admin (your /admin pages should be guarded)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const role = String(data?.user?.role ?? "").toLowerCase();
        if (data?.user?.id && role === "admin") {
          router.replace("/admin" as any);
        }
      } catch {
        // ignore
      }
    })();
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/admin",
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

      // redirect to NextAuth-provided URL (best for session propagation)
      if (result.url) {
        window.location.href = result.url;
        return;
      }

      router.push("/admin" as any);
    });
  }

  return (
    <main className="rr-container">
      <div className="mb-4">
        <Link
          href="/login"
          className="text-sm text-slate-400 hover:text-white underline"
        >
          ← Back to Login
        </Link>
      </div>

      <div className="rr-card">
        <h1 className="text-2xl font-semibold mb-2">Admin Login</h1>
        <p className="text-slate-300 mb-6">Admins only.</p>

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
            {isPending ? "Signing in…" : "Log in as Admin"}
          </button>
        </form>
      </div>
    </main>
  );
}