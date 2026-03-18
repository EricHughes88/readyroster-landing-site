// app/coach/team-profile/CoachTeamProfileClient.tsx
"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import TeamLogo from "@/components/team/TeamLogo";
import TeamLogoUploader from "@/components/team/TeamLogoUploader";

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
        teamId?: number | null;
        teamid?: number | null;
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
      teamId?: number | null;
      teamid?: number | null;
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

  const [teamId, setTeamId] = useState<number | null>(null);

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

  useEffect(() => {
    const role = String(user.role || "").toLowerCase();

    if (role && role !== "coach") {
      if (role === "parent") router.replace("/parent" as any);
      else if (role === "athlete") router.replace("/athlete" as any);
      else if (role === "admin") router.replace("/admin" as any);
      else router.replace("/login?callbackUrl=/coach" as any);
    }
  }, [router, user.role]);

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

        const pRaw =
          "profile" in data && data.profile ? data.profile : (data as any);

        const nextTeamId = Number(pRaw?.teamId ?? pRaw?.teamid ?? 0) || null;

        const teamName = pRaw?.teamName ?? pRaw?.team_name ?? "";
        const coachName =
          pRaw?.coachName ?? pRaw?.coach_name ?? user.name ?? "";
        const contactEmail =
          pRaw?.contactEmail ?? pRaw?.contact_email ?? user.email ?? "";
        const logoPath = pRaw?.logoPath ?? pRaw?.logopath ?? "";

        setTeamId(nextTeamId);
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
    (e: ChangeEvent<HTMLInputElement>) => {
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
      logoPath: form.logoPath?.trim() ? form.logoPath.trim() : null,
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
            <h1 className="mb-1 text-2xl font-semibold">Team Profile</h1>
            <p className="text-sm text-slate-300">
              This is what parents will see when they view your team.
            </p>
          </div>

          <button
            onClick={handleBack}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
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
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
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

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
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

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
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

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
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
                You can paste a logo URL here or upload one below.
              </p>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">
                Preview
              </h2>

              <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4">
                <TeamLogo
                  logoPath={form.logoPath || null}
                  teamName={form.teamName || "Team"}
                  size={56}
                  rounded={false}
                />

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white">
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

            {teamId ? (
              <TeamLogoUploader
                teamId={teamId}
                teamName={form.teamName || "Team"}
                currentLogoPath={form.logoPath || null}
                onUploaded={(logoUrl) => {
                  setForm((prev) => ({
                    ...prev,
                    logoPath: logoUrl,
                  }));
                  setMsg("Logo uploaded successfully. Don’t forget to save.");
                  setErr(null);
                }}
              />
            ) : (
              <div className="rounded-xl border border-amber-700 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                Team logo upload will be available once this coach account has a
                team record.
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
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