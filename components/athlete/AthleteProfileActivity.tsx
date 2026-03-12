"use client";

import { useEffect, useMemo, useState } from "react";

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

function viewerDisplayName(v: Viewer) {
  const team = safe(v.team_name);
  if (team) return team;

  const coach = safe(v.coach_name);
  if (coach) return coach;

  const full = `${safe(v.firstname)} ${safe(v.lastname)}`.trim();
  if (full) return full;

  return safe(v.email) || "Unknown coach";
}

function viewerSubLabel(v: Viewer) {
  const coach = safe(v.coach_name);
  const email = safe(v.email);

  if (coach && email) return `${coach} • ${email}`;
  if (coach) return coach;
  if (email) return email;
  return "Coach view";
}

export default function AthleteProfileActivity({
  athleteId,
}: {
  athleteId: number | null | undefined;
}) {
  const [loading, setLoading] = useState(true);
  const [viewStats, setViewStats] = useState({
    totalViews: 0,
    viewsLast7Days: 0,
  });
  const [recentViewers, setRecentViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    if (!Number.isFinite(athleteId) || Number(athleteId) <= 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const [countRes, recentRes] = await Promise.all([
          fetch(
            `/api/views/count-coach?targetType=athlete&targetId=${athleteId}`,
            { cache: "no-store" }
          ),
          fetch(
            `/api/views/recent?targetType=athlete&targetId=${athleteId}&limit=10`,
            { cache: "no-store" }
          ),
        ]);

        const countData: ViewCountResponse = await countRes.json();
        const recentData: RecentViewersResponse = await recentRes.json();

        if (!cancelled) {
          setViewStats({
            totalViews: countData?.ok ? countData.totalViews ?? 0 : 0,
            viewsLast7Days: countData?.ok ? countData.viewsLast7Days ?? 0 : 0,
          });

          setRecentViewers(
            recentData?.ok && Array.isArray(recentData.viewers)
              ? recentData.viewers
              : []
          );
        }
      } catch {
        if (!cancelled) {
          setViewStats({
            totalViews: 0,
            viewsLast7Days: 0,
          });
          setRecentViewers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  const emptyText = useMemo(() => {
    if (loading) return "Loading...";
    return "No coach views yet.";
  }, [loading]);

  return (
    <section
      id="profile-activity"
      style={{
        marginTop: 16,
        border: "1px solid #334155",
        borderRadius: 12,
        background: "rgba(2,6,23,0.35)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 12, borderBottom: "1px solid #334155", color: "#fff" }}>
        <b>Profile Activity</b>
      </div>

      <div style={{ padding: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 16,
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
            <div style={{ color: "#94a3b8", fontSize: 12 }}>Coach Views</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 900, marginTop: 4 }}>
              {loading ? "…" : viewStats.totalViews}
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
              {loading ? "…" : viewStats.viewsLast7Days}
            </div>
          </div>
        </div>

        <div style={{ color: "#fff", fontWeight: 800, marginBottom: 8 }}>
          Coaches Who Viewed You
        </div>

        {recentViewers.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>{emptyText}</div>
        ) : (
          recentViewers.map((viewer) => (
            <div
              key={viewer.id}
              style={{
                padding: "10px 0",
                borderTop: "1px solid #334155",
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
  );
}