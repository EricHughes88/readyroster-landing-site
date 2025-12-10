// app/coach/team-profile/CoachTeamProfileClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserLike = {
  id: number | string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

type TeamProfile = {
  teamName: string;
  coachName: string;
  contactEmail: string;
  logoPath: string | null;
};

type ApiProfileResponse =
  | {
      ok?: boolean;
      profile?: {
        teamName?: string | null;
        team_name?: string | null;
        coachName?: string | null;
        coach_name?: string | null;
        contactEmail?: string | null;
        contact_email?: string | null;
        logoPath?: string | null;
        logopath?: string | null;
      } | null;
      message?: string;
    }
  | {
      teamName?: string | null;
      team_name?: string | null;
      coachName?: string | null;
      coach_name?: string | null;
      contactEmail?: string | null;
      contact_email?: string | null;
      logoPath?: string | null;
      logopath?: string | null;
      message?: string;
    };

type FormState = {
  teamName: string;
  coachName: string;
  contactEmail: string;
  logoPath: string;
};

export default function CoachTeamProfileClient({ user }: { user: UserLike }) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    teamName: "",
    coachName: user.name ?? "",
    contactEmail: user.email ?? "",
    logoPath: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // If somehow user is not a coach, bounce them
  useEffect(() => {
    const role = (user.role || "").toLowerCase();
    if (role && role !== "coach") {
      if (role === "parent") router.replace("/parent" as any);
      else if (role === "athlete") router.replace("/athlete" as any);
      else if (role === "admin") router.replace("/admin" as any);
      else router.replace("/login?callbackUrl=/coach" as any);
    }
  }, [router, user.role]);

  // Load existing team profile for this coach
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);

      try {
        const res = await fetch(
          `/api/coach/team-profile?coachUserId=${encodeURIComponent(
            String(user.id)
          )}`,
          { cache: "no-store" }
        );

        const data = (await res.json()) as ApiProfileResponse;

        // If API is shape { ok, profile }
        const pRaw =
          "profile" in data && data.profile ? data.profile : (data as any);

        const teamName =
          pRaw?.teamName ??
          pRaw?.team_name ??
          ""; // default empty string

        const coachName =
          pRaw?.coachName ??
          pRaw?.coach_name ??
          user.name ??
          "";

        const contactEmail =
          pRaw?.contactEmail ??
          pRaw?.contact_email ??
          user.email ??
          "";

        const logoPath =
          pRaw?.logoPath ??
          pRaw?.logopath ??
          "";

        setForm({
          teamName,
          coachName,
          contactEmail,
          logoPath: logoPath ?? "",
        });
      } catch (e: any) {
        console.error("load team profile error", e);
        setErr(e?.message || "Failed to load team profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, user?.name, user?.email]);

  const handleChange =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
      setMsg(null);
      setErr(null);
    };

  const handleSave = async () => {
    if (!user?.id) return;

    const payload: TeamProfile = {
      teamName: form.teamName ?? "",
      coachName: form.coachName ?? (user.name ?? ""),
      contactEmail: form.contactEmail ?? (user.email ?? ""),
      logoPath: form.logoPath ?? null,
    };

    try {
      setSaving(true);
      setErr(null);
      setMsg(null);

      const res = await fetch(
        `/api/coach/team-profile?coachUserId=${encodeURIComponent(
          String(user.id)
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok || (data && data.ok === false)) {
        throw new Error(data?.message || "Failed to save team profile");
      }

      setMsg("Profile updated successfully!");
    } catch (e: any) {
      console.error("save profile error", e);
      setErr(e?.message || "Failed to update team profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.push("/coach" as any);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">
              Team Profile
            </h1>
            <p className="text-sm text-slate-300">
              This is what parents will see when they view your team.
            </p>
          </div>

          <button
            onClick={handleBack}
            className="px-3 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
          >
            Back to dashboard
          </button>
        </div>

        {err && (
          <div className="mb-4 rounded border border-red-600 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {msg && (
          <div className="mb-4 rounded border border-emerald-500 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-sm text-slate-300">
            Loading your team profile…
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-6 space-y-4">
            {/* Team Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Team Name
              </label>
              <input
                type="text"
                value={form.teamName}
                onChange={handleChange("teamName")}
                placeholder="e.g. Brittany’s Elite Wrestling"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <p className="mt-1 text-xs text-slate-400">
                This name will show on match lists and exports.
              </p>
            </div>

            {/* Coach Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Coach Name
              </label>
              <input
                type="text"
                value={form.coachName}
                onChange={handleChange("coachName")}
                placeholder="Your name"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <p className="mt-1 text-xs text-slate-400">
                This will be shown to parents when they view your team.
              </p>
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={handleChange("contactEmail")}
                placeholder="coach@example.com"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <p className="mt-1 text-xs text-slate-400">
                Parents may use this to reach out about confirmed matches.
              </p>
            </div>

            {/* Logo Path / URL */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Team Logo URL / Path
              </label>
              <input
                type="text"
                value={form.logoPath}
                onChange={handleChange("logoPath")}
                placeholder="e.g. /logos/my-team.png"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <p className="mt-1 text-xs text-slate-400">
                For now, paste a URL or relative path. Later we can hook this
                up to an image uploader.
              </p>
            </div>

            {/* Preview (optional simple preview box) */}
            <div className="mt-4 border-t border-slate-800 pt-4">
              <h2 className="text-sm font-semibold mb-2 text-slate-200">
                Preview
              </h2>
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 flex items-center gap-4">
                <div className="h-12 w-12 rounded bg-slate-800 flex items-center justify-center text-xs text-slate-300">
                  {form.logoPath ? "Logo" : "No Logo"}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">
                    {form.teamName || "Your team name here"}
                  </div>
                  <div className="text-xs text-slate-300">
                    Coach: {form.coachName || "—"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {form.contactEmail || "no email set"}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 rounded border border-slate-700 bg-slate-900 text-sm hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded bg-red-600 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
