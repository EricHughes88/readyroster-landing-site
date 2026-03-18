"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMessage(null);

    if (!token) {
      setErr("This password reset link is missing a token.");
      return;
    }

    if (password.length < 8) {
      setErr("Your new password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            password,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setErr(data?.message ?? "Unable to reset password.");
          return;
        }

        setMessage("Your password has been reset successfully. Redirecting to log in...");
        setPassword("");
        setConfirmPassword("");

        setTimeout(() => {
          router.push("/login" as any);
        }, 1500);
      } catch {
        setErr("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <main className="rr-container">
      <div className="mb-4">
        <Link
          href="/login"
          className="text-sm text-slate-400 hover:text-white underline"
        >
          ← Back to Log in
        </Link>
      </div>

      <div className="rr-card max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Reset Password</h1>
        <p className="text-slate-300 mb-6">
          Enter your new password below.
        </p>

        {!token && (
          <div className="rr-alert rr-alert-error mb-4">
            This reset link is invalid or incomplete.
          </div>
        )}

        {err && <div className="rr-alert rr-alert-error mb-4">{err}</div>}

        {message && (
          <div className="rr-alert rr-alert-success mb-4">{message}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="rr-label">New Password</span>
            <input
              className="rr-input"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={8}
              disabled={!token || isPending}
            />
          </label>

          <label className="block">
            <span className="rr-label">Confirm New Password</span>
            <input
              className="rr-input"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={8}
              disabled={!token || isPending}
            />
          </label>

          <button
            type="submit"
            className="rr-btn rr-btn-primary w-full"
            disabled={!token || isPending}
          >
            {isPending ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-300 text-center">
          Remembered your password?{" "}
          <Link href="/login" className="text-white underline">
            Log in
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