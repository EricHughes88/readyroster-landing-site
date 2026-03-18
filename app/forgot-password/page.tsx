"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setErr(data?.message ?? "Unable to process password reset request.");
          return;
        }

        setMessage(
          "If an account exists for that email, we sent a password reset link."
        );
        setEmail("");
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
        <h1 className="text-2xl font-semibold mb-2">Forgot Password</h1>
        <p className="text-slate-300 mb-6">
          Enter your email address and we’ll send you a link to reset your
          password.
        </p>

        {err && <div className="rr-alert rr-alert-error mb-4">{err}</div>}

        {message && (
          <div className="rr-alert rr-alert-success mb-4">{message}</div>
        )}

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
              placeholder="you@example.com"
              required
            />
          </label>

          <button
            type="submit"
            className="rr-btn rr-btn-primary w-full"
            disabled={isPending}
          >
            {isPending ? "Sending..." : "Send Reset Link"}
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