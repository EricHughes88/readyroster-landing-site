// app/create-account/page.tsx
"use client";

import { useState } from "react";

type Role = "Parent" | "Coach";

export default function CreateAccountPage() {
  const [form, setForm] = useState({
    role: "" as "" | Role,
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!form.role) return setErr("Please select Parent or Coach.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: form.role,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const fieldErrs =
          data?.errors &&
          Object.entries<string[]>(data.errors)
            .map(([k, v]) => `${k}: ${v.join(", ")}`)
            .join(" | ");
        setErr(data?.message || fieldErrs || "Registration failed");
        return;
      }

      setMsg("Account created! Redirecting to login…");
      // Redirect to login with email prefilled
      setTimeout(() => {
        window.location.href = `/login?email=${encodeURIComponent(form.email.trim())}`;
      }, 800);
    } catch (ex: any) {
      setErr(ex?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="rr-container">
      <h1 className="text-2xl font-semibold mb-4">Create Account</h1>

      <form onSubmit={handleSubmit} className="rr-card space-y-5">
        {/* Role */}
        <fieldset>
          <legend className="rr-label mb-2">I am a…</legend>
          <div className="flex gap-6">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="role"
                value="Parent"
                checked={form.role === "Parent"}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                className="h-4 w-4"
                required
              />
              <span>Parent</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="role"
                value="Coach"
                checked={form.role === "Coach"}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                className="h-4 w-4"
                required
              />
              <span>Coach</span>
            </label>
          </div>
        </fieldset>

        {/* Name */}
        <label className="block">
          <span className="rr-label">Name</span>
          <input
            className="rr-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>

        {/* Email */}
        <label className="block">
          <span className="rr-label">Email</span>
          <input
            type="email"
            className="rr-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>

        {/* Password */}
        <label className="block">
          <span className="rr-label">Password</span>
          <input
            type="password"
            className="rr-input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
          />
        </label>

        {/* Confirm Password */}
        <label className="block">
          <span className="rr-label">Confirm Password</span>
          <input
            type="password"
            className="rr-input"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            required
            minLength={8}
          />
        </label>

        {/* Alerts */}
        {err && <p className="rr-alert rr-alert-error">{err}</p>}
        {msg && <p className="rr-alert rr-alert-success">{msg}</p>}

        {/* Red submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg px-4 py-2 font-medium bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>
    </main>
  );
}
