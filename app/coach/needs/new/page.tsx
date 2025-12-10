// app/coach/needs/new/page.tsx
"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/_shared/ToastProvider";
import { useOverlay } from "@/app/_shared/GlobalOverlay";

export default function NewNeedPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { addToast } = useToast();
  const { withOverlay } = useOverlay();

  const [submitting, setSubmitting] = useState(false);

  const coachUserId = session?.user?.id ? Number(session.user.id) : null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // If NextAuth isn't ready yet, don't do anything
    if (status === "loading") {
      return;
    }

    // Not logged in / no user id → send to login
    if (!coachUserId) {
      addToast({
        title: "Sign in required",
        description: "You must be logged in as a coach.",
        variant: "error",
      });
      router.replace("/login?callbackUrl=/coach/needs/new");
      return;
    }

    const form = new FormData(e.currentTarget);

    const payload = {
      coachUserId,
      event_name: (form.get("event_name") || "").toString().trim(),
      weight_class: (form.get("weight_class") || "").toString().trim(),
      age_group: (form.get("age_group") || "").toString().trim(),
      event_date: (form.get("event_date") || "").toString().trim() || null,
      city: ((form.get("city") || "") as string).toString().trim() || null,
      state:
        ((form.get("state") || "") as string).toString().trim().toUpperCase() || null,
      notes: ((form.get("notes") || "") as string).toString().trim() || null,
    };

    if (!payload.event_name || !payload.weight_class || !payload.age_group) {
      addToast({
        title: "Missing fields",
        description: "Event, Weight, and Age are required.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      await withOverlay(async () => {
        const res = await fetch("/api/coach/needs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json")
          ? await res.json().catch(() => null)
          : { raw: await res.text().catch(() => "") };

        if (!res.ok || (data && data.ok === false)) {
          const msg =
            data?.message ||
            (Array.isArray(data?.issues) ? data.issues[0]?.message : null) ||
            data?.raw ||
            `Could not create need. (HTTP ${res.status})`;

          addToast({ title: "Error", description: String(msg), variant: "error" });

          if (res.status === 401) {
            router.replace("/login?callbackUrl=/coach/needs/new");
          }
          return;
        }

        addToast({
          title: "Success",
          description: "Need posted!",
          variant: "success",
        });
        router.push("/coach?status=pending");
      }, "Posting need…");
    } catch (err) {
      console.error("Network error creating need:", err);
      addToast({
        title: "Network error",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-slate-100">
      <h1 className="mb-6 text-2xl font-bold">Post a Need</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="event_name" className="mb-1 block text-sm text-slate-300">
            Event Name *
          </label>
          <input
            id="event_name"
            name="event_name"
            type="text"
            required
            autoComplete="off"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-slate-600"
            placeholder="e.g., Christmas Sparty"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="age_group" className="mb-1 block text-sm text-slate-300">
              Age Group *
            </label>
            <input
              id="age_group"
              name="age_group"
              type="text"
              required
              autoComplete="off"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-slate-600"
              placeholder="e.g., 8U"
            />
          </div>

          <div>
            <label htmlFor="weight_class" className="mb-1 block text-sm text-slate-300">
              Weight Class *
            </label>
            <input
              id="weight_class"
              name="weight_class"
              type="text"
              required
              autoComplete="off"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-slate-600"
              placeholder="e.g., 64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="event_date" className="mb-1 block text-sm text-slate-300">
              Event Date (optional)
            </label>
            <input
              id="event_date"
              name="event_date"
              type="date"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-slate-600"
            />
          </div>
          <div>
            <label htmlFor="city" className="mb-1 block text-sm text-slate-300">
              City (optional)
            </label>
            <input
              id="city"
              name="city"
              type="text"
              autoComplete="address-level2"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-slate-600"
            />
          </div>
          <div>
            <label htmlFor="state" className="mb-1 block text-sm text-slate-300">
              State (optional)
            </label>
            <input
              id="state"
              name="state"
              type="text"
              autoComplete="address-level1"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-slate-600"
              placeholder="e.g., PA"
              maxLength={2}
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="mb-1 block text-sm text-slate-300">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-slate-600"
            placeholder="Any extra info…"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Posting…" : "Post Need"}
          </button>
        </div>
      </form>
    </main>
  );
}
