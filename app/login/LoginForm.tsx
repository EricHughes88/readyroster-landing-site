"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApiUser = {
  id: number | string;
  email?: string;
  name?: string;
  role?: string | null; // DB may return "Coach"/"Parent"/null
};

function normalizeRole(role: string | null | undefined): "coach" | "parent" | undefined {
  const r = (role ?? "").toString().trim().toLowerCase();
  if (r === "coach") return "coach";
  if (r === "parent") return "parent";
  return undefined;
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Invalid credentials");
      }

      const u: ApiUser = data.user ?? {};
      const idNum = Number(u.id);
      if (!Number.isFinite(idNum)) {
        throw new Error("Login succeeded but user id is missing/invalid.");
      }

      const role = normalizeRole(u.role);
      // ✅ Save the compact session object used by the rest of the app
      localStorage.setItem("rr_user", JSON.stringify({ id: idNum, role }));

      // ✅ Route by role (fallback to parent if unknown)
      if (role === "coach") router.replace("/coach");
      else if (role === "parent") router.replace("/parent");
      else router.replace("/parent"); // fallback
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm mx-auto space-y-3">
      {err && <div className="text-sm text-red-400">{err}</div>}
      <input
        className="w-full rounded px-3 py-2 bg-slate-800 border border-slate-700"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <input
        className="w-full rounded px-3 py-2 bg-slate-800 border border-slate-700"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <button
        disabled={loading}
        className="w-full rounded bg-red-600 hover:bg-red-700 px-3 py-2 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
