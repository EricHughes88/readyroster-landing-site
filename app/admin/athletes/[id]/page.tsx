// app/admin/athletes/[id]/page.tsx
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
  event_date?: string | null;
  age_group?: string | null;
  weight_class?: string | null;
  notes?: string | null;
  event_city?: string | null;
  event_state?: string | null;
  travel_miles?: number | null;
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
  athleteId?: number;
  profile?: Profile | null;
  interests?: Interest[];
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

function formatMiles(v?: number | null) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return `${Math.round(Number(v))} mi`;
}

function getTravelLabel(v?: number | null) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const miles = Number(v);
  if (miles <= 50) return "Local";
  if (miles <= 150) return "Regional";
  if (miles <= 300) return "Long Distance";
  return "Major Travel";
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
  const coach = safe(v.coach_name);
  const email = safe(v.email);

  if (coach && email) return `${coach} • ${email}`;
  if (coach) return coach;
  if (email) return email;
  return "Coach view";
}

export default function AdminAthleteProfilePage() {
  const params = useParams();
  const athleteId = Number((params as any)?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [recentViewers, setRecentViewers] = useState<Viewer[]>([]);

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

        const res = await fetch(`/api/admin/athletes/${athleteId}`, {
          cache: "no-store",
        });

        const data: ApiResponse = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message ?? "Failed to load athlete profile.");
        }

        if (cancelled) return;

        setProfile(data.profile ?? null);
        setInterests(Array.isArray(data.interests) ? data.interests : []);
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message ?? e ?? "Failed to load athlete profile."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (Number.isFinite(athleteId) && athleteId > 0) {
      load();
    } else {
      setError("Invalid athlete id.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  useEffect(() => {
    if (!Number.isFinite(athleteId) || athleteId <= 0) return;

    fetch("/api/views", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetType: "athlete",
        targetId: athleteId,
      }),
    }).catch(() => {});
  }, [athleteId]);

  useEffect(() => {
    if (!Number.isFinite(athleteId) || athleteId <= 0) return;

    let cancelled = false;

    async function loadViewStats() {
      try {
        const res = await fetch(
          `/api/views/count?targetType=athlete&targetId=${athleteId}`,
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
  }, [athleteId]);

  useEffect(() => {
    if (!Number.isFinite(athleteId) || athleteId <= 0) return;

    let cancelled = false;

    async function loadRecentViewers() {
      try {
        const res = await fetch(
          `/api/views/recent?targetType=athlete&targetId=${athleteId}&limit=10`,
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
    return full || safe(profile?.parent_email) || "—";
  }, [profile]);

  const parentEmail = safe(profile?.parent_email) || "—";
  const parentPhone = safe(profile?.parent_phone) || "—";

  const travelStats = useMemo(() => {
    const valid = interests.filter(
      (i) =>
        i.travel_miles !== null &&
        i.travel_miles !== undefined &&
        Number.isFinite(Number(i.travel_miles))
    );

    if (valid.length === 0) {
      return {
        count: 0,
        avg: null as number | null,
        max: null as number | null,
      };
    }

    const miles = valid.map((i) => Number(i.travel_miles));
    const sum = miles.reduce((a, b) => a + b, 0);
    const avg = sum / miles.length;
    const max = Math.max(...miles);

    return {
      count: valid.length,
      avg,
      max,
    };
  }, [interests]);

  const travelBreakdown = useMemo(() => {
    const counts = {
      local: 0,
      regional: 0,
      longDistance: 0,
      majorTravel: 0,
    };

    interests.forEach((i) => {
      if (i.travel_miles === null || i.travel_miles === undefined) return;

      const miles = Number(i.travel_miles);
      if (!Number.isFinite(miles)) return;

      if (miles <= 50) {
        counts.local += 1;
      } else if (miles <= 150) {
        counts.regional += 1;
      } else if (miles <= 300) {
        counts.longDistance += 1;
      } else {
        counts.majorTravel += 1;
      }
    });

    return counts;
  }, [interests]);

  if (loading) {
    return (
      <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto", color: "#e5e7eb" }}>
        <p>Loading athlete profile...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto", color: "#e5e7eb" }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/admin/athletes" style={{ color: "#cbd5e1", textDecoration: "underline" }}>
            ← Back to directory
          </Link>
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
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Athlete Profile</h1>
          <p style={{ marginTop: 12 }}>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto", color: "#e5e7eb" }}>
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
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Athlete</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{athleteName}</div>

              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>DOB</div>
                <div style={{ color: "#fff" }}>{formatDateOnly(profile?.dob)}</div>
              </div>
            </div>

            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Location</div>
              <div style={{ color: "#fff", fontWeight: 700 }}>{location}</div>

              <div style={{ marginTop: 12 }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Parent User ID</div>
                <div style={{ color: "#fff" }}>{profile?.parent_user_id ?? "—"}</div>
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
              <div style={{ color: "#fff" }}>{parentName}</div>
            </div>

            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Email</div>
              <div style={{ color: "#fff" }}>
                {parentEmail !== "—" ? (
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
              <div style={{ color: "#fff" }}>{parentPhone}</div>
            </div>
          </div>
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
              <div style={{ color: "#fff", fontSize: 28, fontWeight: 900, marginTop: 4 }}>
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
              <div style={{ color: "#fff", fontSize: 28, fontWeight: 900, marginTop: 4 }}>
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
          padding: 16,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ fontWeight: 800, color: "#fff", marginBottom: 12 }}>
          Travel Insights
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <div
            style={{
              border: "1px solid #334155",
              borderRadius: 10,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Avg Travel</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginTop: 4 }}>
              {formatMiles(travelStats.avg)}
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
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Farthest Event</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginTop: 4 }}>
              {formatMiles(travelStats.max)}
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
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Events Traveled</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginTop: 4 }}>
              {travelStats.count}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 16,
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 16,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ fontWeight: 800, color: "#fff", marginBottom: 12 }}>
          Travel Breakdown
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid #334155",
              borderRadius: 10,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Local</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginTop: 4 }}>
              {travelBreakdown.local}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>0–50 mi</div>
          </div>

          <div
            style={{
              border: "1px solid #334155",
              borderRadius: 10,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Regional</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginTop: 4 }}>
              {travelBreakdown.regional}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>51–150 mi</div>
          </div>

          <div
            style={{
              border: "1px solid #334155",
              borderRadius: 10,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Long Distance</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginTop: 4 }}>
              {travelBreakdown.longDistance}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>151–300 mi</div>
          </div>

          <div
            style={{
              border: "1px solid #334155",
              borderRadius: 10,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Major Travel</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginTop: 4 }}>
              {travelBreakdown.majorTravel}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>301+ mi</div>
          </div>
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
          <b>Recent Coach Views</b>
        </div>

        <div style={{ padding: 12 }}>
          {recentViewers.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No coach views yet.</div>
          ) : (
            recentViewers.map((viewer, index) => (
              <div
                key={viewer.id}
                style={{
                  padding: "10px 0",
                  borderTop: index === 0 ? "none" : "1px solid #334155",
                }}
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
          <b>Athlete posts (Interests)</b>
        </div>

        <div style={{ padding: 12 }}>
          {interests.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No posts yet.</div>
          ) : (
            interests.map((i, index) => {
              const eventLocation =
                [safe(i.event_city), safe(i.event_state)].filter(Boolean).join(", ") || "—";

              return (
                <div
                  key={i.id}
                  style={{
                    padding: "10px 0",
                    borderTop: index === 0 ? "none" : "1px solid #334155",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#fff" }}>{i.event_name ?? "—"}</div>

                  <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                    Date: {formatDateOnly(i.event_date)}
                  </div>

                  <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                    Age: {i.age_group ?? "—"} | Weight: {i.weight_class ?? "—"}
                  </div>

                  <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                    Event Location: {eventLocation}
                  </div>

                  <div style={{ color: "#cbd5e1", marginTop: 2, fontSize: 13 }}>
                    Distance: {formatMiles(i.travel_miles)} | Label: {getTravelLabel(i.travel_miles)}
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
              );
            })
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
            <div style={{ color: "#94a3b8" }}>No matches yet.</div>
          ) : (
            matches.map((m, index) => (
              <div
                key={m.id}
                style={{
                  padding: "10px 0",
                  borderTop: index === 0 ? "none" : "1px solid #334155",
                }}
              >
                <div style={{ fontWeight: 800, color: "#fff" }}>{m.event_name ?? "—"}</div>
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