// app/admin/(protected)/coaches/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Route } from "next";
import TeamLogoUploader from "@/components/team/TeamLogoUploader";

type CoachProfile = {
  id?: number | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;

  teamid?: number | null;
  teamname?: string | null;
  coach_name?: string | null;
  contactemail?: string | null;
  logopath?: string | null;
  city?: string | null;
  state?: string | null;
};

type Need = {
  id: number;
  event_name?: string | null;
  event_date?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  notes?: string | null;
  created_at?: string | null;
  city?: string | null;
  state?: string | null;
  is_open?: boolean | null;
  is_visible?: boolean | null;
  expired_at?: string | null;
};

type Match = {
  id: number;
  status?: string | null;
  event_name?: string | null;
  event_date?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  athlete_name?: string | null;
  athlete_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  confirmed_at?: string | null;
  parent_ok?: boolean | null;
  coach_ok?: boolean | null;
};

type Viewer = {
  id: number;
  viewer_user_id?: number | null;
  viewer_role?: string | null;
  viewed_at?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  team_name?: string | null;
  coach_name?: string | null;
};

type ApiResponse = {
  ok: boolean;
  coachId?: number;
  coach?: CoachProfile | null;
  needs?: Need[];
  matches?: Match[];
  message?: string;
};

type ViewCountResponse = {
  ok: boolean;
  totalViews?: number;
  viewsLast7Days?: number;
  message?: string;
};

type RecentViewersResponse = {
  ok: boolean;
  viewers?: Viewer[];
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

function viewerDisplayName(v: Viewer) {
  const team = safe(v.team_name);
  if (team) return team;

  const coach = safe(v.coach_name);
  if (coach) return coach;

  const full = `${safe(v.firstname)} ${safe(v.lastname)}`.trim();
  if (full) return full;

  return safe(v.email) || "Unknown viewer";
}

function viewerSubLabel(v: Viewer) {
  const role = safe(v.viewer_role);
  const email = safe(v.email);
  const full = `${safe(v.firstname)} ${safe(v.lastname)}`.trim();

  if (full && email) return `${full} • ${email}`;
  if (full) return full;
  if (email && role) return `${role} • ${email}`;
  if (email) return email;
  if (role) return `${role} view`;

  return "Profile view";
}

function yesNo(value?: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        border: "1px dashed #334155",
        borderRadius: 10,
        padding: 16,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ color: "#fff", fontWeight: 800 }}>{title}</div>
      <div style={{ color: "#94a3b8", marginTop: 6, fontSize: 14 }}>
        {description}
      </div>
    </div>
  );
}

const actionButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

export default function AdminCoachProfilePage() {
  const params = useParams();
  const coachId = Number((params as any)?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [recentViewers, setRecentViewers] = useState<Viewer[]>([]);
  const [logoUrlOverride, setLogoUrlOverride] = useState<string | null>(null);

  const [viewStats, setViewStats] = useState({
    totalViews: 0,
    viewsLast7Days: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/admin/coaches/${coachId}`, {
          cache: "no-store",
        });

        const data: ApiResponse = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message ?? "Failed to load coach profile.");
        }

        if (cancelled) return;

        setCoach(data.coach ?? null);
        setNeeds(Array.isArray(data.needs) ? data.needs : []);
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message ?? e ?? "Failed to load coach profile."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (Number.isFinite(coachId) && coachId > 0) {
      load();
    } else {
      setError("Invalid coach id.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [coachId]);

  useEffect(() => {
    if (!Number.isFinite(coachId) || coachId <= 0) return;

    fetch("/api/views", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetType: "coach",
        targetId: coachId,
      }),
    }).catch(() => {});
  }, [coachId]);

  useEffect(() => {
    if (!Number.isFinite(coachId) || coachId <= 0) return;

    let cancelled = false;

    async function loadViewStats() {
      try {
        const res = await fetch(
          `/api/views/count?targetType=coach&targetId=${coachId}`,
          { cache: "no-store" }
        );

        const data: ViewCountResponse = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message ?? "Failed to load view stats.");
        }

        if (cancelled) return;

        setViewStats({
          totalViews: data.totalViews ?? 0,
          viewsLast7Days: data.viewsLast7Days ?? 0,
        });
      } catch {
        if (!cancelled) {
          setViewStats({
            totalViews: 0,
            viewsLast7Days: 0,
          });
        }
      }
    }

    loadViewStats();

    return () => {
      cancelled = true;
    };
  }, [coachId]);

  useEffect(() => {
    if (!Number.isFinite(coachId) || coachId <= 0) return;

    let cancelled = false;

    async function loadRecentViewers() {
      try {
        const res = await fetch(
          `/api/views/recent?targetType=coach&targetId=${coachId}&limit=10`,
          { cache: "no-store" }
        );

        const data: RecentViewersResponse = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message ?? "Failed to load recent viewers.");
        }

        if (cancelled) return;

        setRecentViewers(Array.isArray(data.viewers) ? data.viewers : []);
      } catch {
        if (!cancelled) setRecentViewers([]);
      }
    }

    loadRecentViewers();

    return () => {
      cancelled = true;
    };
  }, [coachId]);

  const coachName = useMemo(() => {
    const fn = safe(coach?.firstname);
    const ln = safe(coach?.lastname);
    const full = `${fn} ${ln}`.trim();
    return full || safe(coach?.coach_name) || "Unknown Coach";
  }, [coach]);

  const location = useMemo(() => {
    const c = safe(coach?.city);
    const s = safe(coach?.state);
    if (c && s) return `${c}, ${s}`;
    return c || s || "—";
  }, [coach]);

  const teamName = safe(coach?.teamname) || "—";
  const coachEmail = safe(coach?.email) || "—";
  const coachPhone = safe(coach?.phone) || "—";
  const contactEmail = safe(coach?.contactemail) || "—";
  const logoPath = logoUrlOverride || safe(coach?.logopath);

  if (loading) {
    return (
      <main
        style={{
          padding: 20,
          maxWidth: 1100,
          margin: "0 auto",
          color: "#e5e7eb",
        }}
      >
        <p>Loading coach profile...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          padding: 20,
          maxWidth: 1100,
          margin: "0 auto",
          color: "#e5e7eb",
        }}
      >
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href={"/admin/coaches" as Route} style={actionButtonStyle}>
            ← Back to directory
          </Link>

          {Number.isFinite(coachId) && coachId > 0 ? (
            <Link
              href={`/admin/coaches/${coachId}/edit` as Route}
              style={actionButtonStyle}
            >
              ✏️ Edit Coach
            </Link>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid rgba(239,68,68,.4)",
            borderRadius: 14,
            background: "rgba(127,29,29,.18)",
            color: "#fff",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            Coach Profile
          </h1>
          <p style={{ marginTop: 12 }}>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{ padding: 20, maxWidth: 1100, margin: "0 auto", color: "#e5e7eb" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#fff" }}>
            Coach Profile
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            Profile details + everything this coach has posted and matched on.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/admin/coaches/${coachId}/edit` as Route}
            style={actionButtonStyle}
          >
            ✏️ Edit Coach
          </Link>

          <Link href={"/admin/coaches" as Route} style={actionButtonStyle}>
            ← Back to directory
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
          gap: 16,
          alignItems: "start",
          marginTop: 16,
        }}
      >
        <section
          style={{
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 16,
            background: "rgba(2,6,23,0.35)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Coach</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                {coachName}
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Email</div>
                <div style={{ color: "#fff" }}>
                  {coachEmail !== "—" ? (
                    <a
                      href={`mailto:${coachEmail}`}
                      style={{ color: "#fff", textDecoration: "underline" }}
                    >
                      {coachEmail}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Phone</div>
                <div style={{ color: "#fff" }}>{coachPhone}</div>
              </div>
            </div>

            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Location</div>
              <div style={{ color: "#fff", fontWeight: 700 }}>{location}</div>

              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Team ID</div>
                <div style={{ color: "#fff" }}>{coach?.teamid ?? "—"}</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>User ID</div>
                <div style={{ color: "#fff" }}>{coach?.id ?? "—"}</div>
              </div>
            </div>
          </div>

          <hr style={{ margin: "16px 0", borderColor: "#334155" }} />

          <div style={{ fontWeight: 800, color: "#fff", marginBottom: 10 }}>
            Team Information
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Team Name</div>
              <div style={{ color: "#fff" }}>{teamName}</div>
            </div>

            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>
                Team Contact Email
              </div>
              <div style={{ color: "#fff" }}>
                {contactEmail !== "—" ? (
                  <a
                    href={`mailto:${contactEmail}`}
                    style={{ color: "#fff", textDecoration: "underline" }}
                  >
                    {contactEmail}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>

            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Created</div>
              <div style={{ color: "#fff" }}>{formatDateOnly(coach?.created_at)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>
              Team Logo
            </div>

            <div
              style={{
                width: 140,
                height: 140,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #334155",
                borderRadius: 12,
                background: "#020617",
              }}
            >
              <img
                src={logoPath || "/no-logo.png"}
                alt={teamName !== "—" ? `${teamName} logo` : "Team logo"}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/no-logo.png";
                }}
                style={{
                  maxWidth: "80%",
                  maxHeight: "80%",
                  objectFit: "contain",
                }}
              />
            </div>
          </div>

          <TeamLogoUploader
            teamId={coach?.teamid ?? null}
            onUploaded={(logoUrl) => {
              setLogoUrlOverride(logoUrl);
              setCoach((prev) => (prev ? { ...prev, logopath: logoUrl } : prev));
            }}
          />
        </section>

        <aside
          style={{
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 16,
            background: "rgba(2,6,23,0.35)",
          }}
        >
          <div style={{ fontWeight: 800, color: "#fff", marginBottom: 12 }}>
            Profile Activity
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                border: "1px solid #334155",
                borderRadius: 10,
                padding: 12,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Total Views</div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: 900,
                  marginTop: 4,
                }}
              >
                {viewStats.totalViews}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #334155",
                borderRadius: 10,
                padding: 12,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Last 7 Days</div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: 900,
                  marginTop: 4,
                }}
              >
                {viewStats.viewsLast7Days}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section
        style={{
          marginTop: 16,
          border: "1px solid #334155",
          borderRadius: 12,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #334155", color: "#fff" }}>
          <b>Recent Profile Views</b>
        </div>

        <div style={{ padding: 12 }}>
          {recentViewers.length === 0 ? (
            <EmptyState
              title="No profile views yet"
              description="This coach profile has not been viewed recently, or coach profile view tracking has not been recorded yet."
            />
          ) : (
            recentViewers.map((viewer) => (
              <div
                key={viewer.id}
                style={{ padding: "10px 0", borderTop: "1px solid #334155" }}
              >
                <div style={{ fontWeight: 800, color: "#fff" }}>
                  {viewerDisplayName(viewer)}
                </div>
                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  {viewerSubLabel(viewer)}
                </div>
                <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>
                  Viewed: {formatDateTime(viewer.viewed_at)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: 16,
          border: "1px solid #334155",
          borderRadius: 12,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #334155", color: "#fff" }}>
          <b>Posted Needs</b>
        </div>

        <div style={{ padding: 12 }}>
          {needs.length === 0 ? (
            <EmptyState
              title="No needs posted yet"
              description="This coach has not posted any team needs yet. Once needs are posted, they will appear here with event, age group, weight class, and status details."
            />
          ) : (
            needs.map((n) => (
              <div
                key={n.id}
                style={{ padding: "10px 0", borderTop: "1px solid #334155" }}
              >
                <div style={{ fontWeight: 800, color: "#fff" }}>
                  {n.event_name ?? "—"}
                </div>

                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Age: {n.age_group ?? "—"} | Weight: {n.weight_class ?? "—"}
                </div>

                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Event Date: {formatDateOnly(n.event_date)} | Location:{" "}
                  {[safe(n.city), safe(n.state)].filter(Boolean).join(", ") || "—"}
                </div>

                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Open: {yesNo(n.is_open)} | Visible: {yesNo(n.is_visible)}
                </div>

                {n.expired_at ? (
                  <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                    Expires: {formatDateTime(n.expired_at)}
                  </div>
                ) : null}

                <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>
                  Created: {formatDateTime(n.created_at)}
                </div>

                {n.notes ? (
                  <div style={{ marginTop: 6, color: "#cbd5e1", fontSize: 13 }}>
                    Notes: {n.notes}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

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
          {matches.length === 0 ? (
            <EmptyState
              title="No match requests yet"
              description="No matches or requests have been created for this coach yet. When athlete interest is matched to one of this coach’s needs, it will appear here."
            />
          ) : (
            matches.map((m) => (
              <div
                key={m.id}
                style={{ padding: "10px 0", borderTop: "1px solid #334155" }}
              >
                <div style={{ fontWeight: 800 }}>
                  {m.athlete_id ? (
                    <Link
                      href={`/admin/athletes/${m.athlete_id}` as Route}
                      style={{ color: "#fff", textDecoration: "underline" }}
                    >
                      {m.athlete_name ?? "Unknown Athlete"}
                    </Link>
                  ) : (
                    <span style={{ color: "#fff" }}>
                      {m.athlete_name ?? "Unknown Athlete"}
                    </span>
                  )}
                </div>

                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Status: {m.status ?? "pending"} | Event: {m.event_name ?? "—"}
                </div>

                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Age: {m.age_group ?? "—"} | Weight: {m.weight_class ?? "—"}
                </div>

                <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                  Parent OK: {yesNo(m.parent_ok)} | Coach OK: {yesNo(m.coach_ok)}
                </div>

                {m.confirmed_at ? (
                  <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                    Confirmed: {formatDateTime(m.confirmed_at)}
                  </div>
                ) : null}

                <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>
                  Created: {formatDateTime(m.created_at)}
                </div>

                {m.athlete_id ? (
                  <div style={{ marginTop: 6 }}>
                    <Link
                      href={`/admin/athletes/${m.athlete_id}` as Route}
                      style={{ color: "#cbd5e1", textDecoration: "underline" }}
                    >
                      View athlete profile
                    </Link>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}