// app/parent/wrestlers/new/page.tsx
"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewWrestlerPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<number | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Load session user (from your localStorage convention). Redirect to login if missing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("rr_user");
      const u = raw ? JSON.parse(raw) : null;
      if (!u?.id) {
        router.push("/login" as Route);
        return;
      }
      setUserId(Number(u.id));
    } catch {
      router.push("/login" as Route);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;

    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/wrestlers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          dob: dob || undefined,
          city: city.trim(),
          state: stateVal.trim().toUpperCase(),
        }),
      });

      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : null;

      if (!res.ok) {
        const fieldErrs =
          data?.errors &&
          Object.entries<string[]>(data.errors)
            .map(([k, v]) => `${k}: ${v.join(", ")}`)
            .join(" | ");
        setErr(data?.message || fieldErrs || "Could not save wrestler.");
      } else {
        setMsg("Wrestler saved!");
        // small delay for UX, then go back to Parent dashboard (or /parent/wrestlers if you prefer)
        setTimeout(() => router.push("/parent" as Route), 700);
      }
    } catch (ex: any) {
      setErr(ex?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="rr-container">
      <div className="mb-4">
        <Link href={"/parent" as Route} className="text-slate-300 hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-4">Add Wrestler</h1>

      <form onSubmit={handleSubmit} className="rr-card space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="rr-label">First Name</span>
            <input
              className="rr-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </label>

          <label className="block">
            <span className="rr-label">Last Name</span>
            <input
              className="rr-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <label className="block">
            <span className="rr-label">Date of Birth</span>
            <input
              type="date"
              className="rr-input"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="rr-label">City</span>
            <input
              className="rr-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              autoComplete="address-level2"
            />
          </label>

          <label className="block">
            <span className="rr-label">State</span>
            <input
              className="rr-input"
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value.toUpperCase())}
              required
              placeholder="MI"
              maxLength={2}
              pattern="[A-Za-z]{2}"
              title="Two-letter state code (e.g., MI)"
              autoComplete="address-level1"
            />
          </label>
        </div>

        {err && <p className="rr-alert rr-alert-error">{err}</p>}
        {msg && <p className="rr-alert rr-alert-success">{msg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg px-4 py-2 font-medium bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Wrestler"}
        </button>
      </form>
    </main>
  );
}
