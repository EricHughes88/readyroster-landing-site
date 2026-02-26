"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Profile = {
  id?: number | null;

  first_name?: string | null;
  last_name?: string | null;

  city?: string | null;
  state?: string | null;
  dob?: string | null;

  parent_user_id?: number | null;
  parent_firstname?: string | null;
  parent_lastname?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
};

type Interest = {
  id: number;
  event_name?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type Match = {
  id: number;
  status?: string | null;
  event_name?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  team_name?: string | null;
  team_coach_name?: string | null;
  created_at?: string | null;
};

type ApiResponse = {
  ok: boolean;
  profile?: Profile | null;
  interests?: Interest[];
  matches?: Match[];
  message?: string;
};

function safe(v?: string | null) {
  return (v ?? "").trim();
}

function formatDateTime(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function formatDateOnly(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US");
}

export default function AdminAthleteProfilePage() {
  const params = useParams();
  const athleteId = Number((params as any)?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/athletes/${athleteId}`, {
          cache: "no-store",
        });
        const data: ApiResponse = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message ?? "Failed to load athlete admin profile");
        }

        if (cancelled) return;

        setProfile(data.profile ?? null);
        setInterests(Array.isArray(data.interests) ? data.interests : []);
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (Number.isFinite(athleteId) && athleteId > 0) load();

    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const athleteName = useMemo(() => {
    const fn = safe(profile?.first_name);
    const ln = safe(profile?.last_name);
    return `${fn} ${ln}`.trim() || "Unknown Athlete";
  }, [profile]);

  const location = useMemo(() => {
    const c = safe(profile?.city);
    const s = safe(profile?.state);
    if (c && s) return `${c}, ${s}`;
    return c || s || "—";
  }, [profile]);

  const parentName = useMemo(() => {
    const fn = safe(profile?.parent_firstname);
    const ln = safe(profile?.parent_lastname);
    const full = `${fn} ${ln}`.trim();
    // ✅ fallback to email if name missing
    return full || safe(profile?.parent_email) || "—";
  }, [profile]);

  const parentEmail = safe(profile?.parent_email) || "—";
  const parentPhone = safe(profile?.parent_phone) || "—";

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto", color: "#e5e7eb" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#fff" }}>
            Athlete Profile
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            Profile details + everything this athlete has posted and matched on.
          </p>
        </div>

        <Link href="/admin/athletes" style={{ color: "#cbd5e1", textDecoration: "underline" }}>
          ← Back to directory
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #fecaca",
            borderRadius: 10,
            background: "#fee2e2",
            color: "#111",
          }}
        >
          <b>Error:</b> {error}
        </div>
      )}

      {/* Profile card */}
      <section
        style={{
          marginTop: 16,
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 16,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Athlete</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
              {loading ? "…" : athleteName}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>DOB</div>
              <div style={{ color: "#fff" }}>
                {loading ? "…" : formatDateOnly(profile?.dob)}
              </div>
            </div>
          </div>

          <div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Location</div>
            <div style={{ color: "#fff", fontWeight: 700 }}>{loading ? "…" : location}</div>

            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Parent User ID</div>
              <div style={{ color: "#fff" }}>{loading ? "…" : (profile?.parent_user_id ?? "—")}</div>
            </div>
          </div>
        </div>

        <hr style={{ margin: "16px 0", borderColor: "#334155" }} />

        <div style={{ fontWeight: 800, color: "#fff", marginBottom: 10 }}>
          Parent Contact
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Name</div>
            <div style={{ color: "#fff" }}>{loading ? "…" : parentName}</div>
          </div>

          <div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Email</div>
            <div style={{ color: "#fff" }}>
              {loading ? (
                "…"
              ) : parentEmail !== "—" ? (
                <a
                  href={`mailto:${parentEmail}`}
                  style={{ color: "#fff", textDecoration: "underline" }}
                >
                  {parentEmail}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>

          <div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Phone</div>
            <div style={{ color: "#fff" }}>{loading ? "…" : parentPhone}</div>
          </div>
        </div>
      </section>

      {/* Interests */}
      <section
        style={{
          marginTop: 16,
          border: "1px solid #334155",
          borderRadius: 12,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #334155", color: "#fff" }}>
          <b>Athlete posts (Interests)</b>
        </div>

        <div style={{ padding: 12 }}>
          {!loading && interests.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No posts yet.</div>
          ) : (
            interests.map((i) => (
              <div
                key={i.id}
                style={{ padding: "10px 0", borderTop: "1px solid #334155" }}
              >
                <div style={{ fontWeight: 800, color: "#fff" }}>
                  {i.event_name ?? "—"}
                </div>
                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Age: {i.age_group ?? "—"} | Weight: {i.weight_class ?? "—"}
                </div>
                <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>
                  Created: {formatDateTime(i.created_at)}
                </div>
                {i.notes ? (
                  <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 13 }}>
                    Notes: {i.notes}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Matches */}
      <section
        style={{
          marginTop: 16,
          border: "1px solid #334155",
          borderRadius: 12,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #334155", color: "#fff" }}>
          <b>Matches / requests</b>
        </div>

        <div style={{ padding: 12 }}>
          {!loading && matches.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No matches yet.</div>
          ) : (
            matches.map((m) => (
              <div
                key={m.id}
                style={{ padding: "10px 0", borderTop: "1px solid #334155" }}
              >
                <div style={{ fontWeight: 800, color: "#fff" }}>
                  {m.event_name ?? "—"}
                </div>
                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Status: {m.status ?? "pending"} | Age: {m.age_group ?? "—"} | Weight:{" "}
                  {m.weight_class ?? "—"}
                </div>
                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Team: {m.team_name ?? "—"}
                  {m.team_coach_name ? ` (${m.team_coach_name})` : ""}
                </div>
                <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>
                  Created: {formatDateTime(m.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}