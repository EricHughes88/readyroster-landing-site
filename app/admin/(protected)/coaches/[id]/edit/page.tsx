"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type CoachUser = {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

type TeamProfile = {
  teamid?: number;
  userid?: number;
  teamname?: string | null;
  coach_name?: string | null;
  contactemail?: string | null;
  city?: string | null;
  state?: string | null;
  logopath?: string | null;
};

type CoachNeed = {
  id: number;
  coach_user_id: number;
  event_name?: string | null;
  event_date?: string | null;
  weight_class?: string | null;
  age_group?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  is_open?: boolean;
  is_visible?: boolean;
  created_at?: string | null;
};

export default function AdminEditCoachPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingNeedId, setSavingNeedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [user, setUser] = useState<CoachUser | null>(null);
  const [team, setTeam] = useState<TeamProfile>({
    teamname: "",
    coach_name: "",
    contactemail: "",
    city: "",
    state: "",
    logopath: "",
  });
  const [needs, setNeeds] = useState<CoachNeed[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/admin/coaches/${id}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "Failed to load coach");
        }

        if (!active) return;

        setUser(data.user ?? null);
        setTeam({
          teamname: data.team?.teamname ?? "",
          coach_name: data.team?.coach_name ?? "",
          contactemail: data.team?.contactemail ?? (data.user?.email ?? ""),
          city: data.team?.city ?? "",
          state: data.team?.state ?? "",
          logopath: data.team?.logopath ?? "",
        });
        setNeeds(Array.isArray(data.needs) ? data.needs : []);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || "Failed to load coach");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (id) load();

    return () => {
      active = false;
    };
  }, [id]);

  async function saveTeam() {
    try {
      setSavingTeam(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/admin/coaches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(team),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to save team");
      }

      setTeam({
        teamname: data.team?.teamname ?? "",
        coach_name: data.team?.coach_name ?? "",
        contactemail: data.team?.contactemail ?? "",
        city: data.team?.city ?? "",
        state: data.team?.state ?? "",
        logopath: data.team?.logopath ?? "",
      });

      setSuccess("Team profile updated.");
    } catch (e: any) {
      setError(e?.message || "Failed to save team");
    } finally {
      setSavingTeam(false);
    }
  }

  async function saveNeed(need: CoachNeed) {
    try {
      setSavingNeedId(need.id);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/admin/coach-needs/${need.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(need),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to save need");
      }

      setNeeds((prev) =>
        prev.map((n) => (n.id === need.id ? data.need : n))
      );

      setSuccess(`Need #${need.id} updated.`);
    } catch (e: any) {
      setError(e?.message || "Failed to save need");
    } finally {
      setSavingNeedId(null);
    }
  }

  if (loading) {
    return <main style={{ padding: 24, color: "#fff" }}>Loading…</main>;
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, color: "#fff" }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/admin" style={{ color: "#94a3b8", textDecoration: "none" }}>
          Admin
        </Link>
        <span style={{ color: "#94a3b8" }}> / </span>
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Back
        </button>
      </div>

      <h1 style={{ marginTop: 0 }}>Edit Coach Profile</h1>
      <p style={{ color: "#94a3b8" }}>
        Update the coach/team profile and any posted needs, including age group.
      </p>

      {error ? (
        <div style={{ marginBottom: 16, color: "#fca5a5" }}>{error}</div>
      ) : null}

      {success ? (
        <div style={{ marginBottom: 16, color: "#86efac" }}>{success}</div>
      ) : null}

      <section
        style={{
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 16,
          background: "rgba(2,6,23,0.35)",
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Coach / Team Profile</h2>

        <div style={{ marginBottom: 12, color: "#cbd5e1" }}>
          <div><b>Account Email:</b> {user?.email || "—"}</div>
          <div><b>Phone:</b> {user?.phone || "—"}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ marginBottom: 6 }}>Team Name</div>
            <input
              value={team.teamname ?? ""}
              onChange={(e) => setTeam((t) => ({ ...t, teamname: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Coach Name</div>
            <input
              value={team.coach_name ?? ""}
              onChange={(e) => setTeam((t) => ({ ...t, coach_name: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Contact Email</div>
            <input
              value={team.contactemail ?? ""}
              onChange={(e) => setTeam((t) => ({ ...t, contactemail: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Logo Path</div>
            <input
              value={team.logopath ?? ""}
              onChange={(e) => setTeam((t) => ({ ...t, logopath: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>City</div>
            <input
              value={team.city ?? ""}
              onChange={(e) => setTeam((t) => ({ ...t, city: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>State</div>
            <input
              value={team.state ?? ""}
              onChange={(e) => setTeam((t) => ({ ...t, state: e.target.value }))}
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={saveTeam} disabled={savingTeam} style={buttonStyle}>
            {savingTeam ? "Saving..." : "Save Team Profile"}
          </button>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 16,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Posted Needs</h2>

        {needs.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>No needs found for this coach.</div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {needs.map((need) => (
              <div
                key={need.id}
                style={{
                  border: "1px solid #334155",
                  borderRadius: 10,
                  padding: 14,
                  background: "#0b1220",
                }}
              >
                <div style={{ marginBottom: 10, fontWeight: 800 }}>
                  Need #{need.id}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    <div style={{ marginBottom: 6 }}>Event Name</div>
                    <input
                      value={need.event_name ?? ""}
                      onChange={(e) =>
                        setNeeds((prev) =>
                          prev.map((n) =>
                            n.id === need.id ? { ...n, event_name: e.target.value } : n
                          )
                        )
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={{ marginBottom: 6 }}>Event Date</div>
                    <input
                      type="date"
                      value={need.event_date ? String(need.event_date).slice(0, 10) : ""}
                      onChange={(e) =>
                        setNeeds((prev) =>
                          prev.map((n) =>
                            n.id === need.id ? { ...n, event_date: e.target.value } : n
                          )
                        )
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={{ marginBottom: 6 }}>Weight Class</div>
                    <input
                      value={need.weight_class ?? ""}
                      onChange={(e) =>
                        setNeeds((prev) =>
                          prev.map((n) =>
                            n.id === need.id ? { ...n, weight_class: e.target.value } : n
                          )
                        )
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={{ marginBottom: 6 }}>Age Group</div>
                    <input
                      value={need.age_group ?? ""}
                      onChange={(e) =>
                        setNeeds((prev) =>
                          prev.map((n) =>
                            n.id === need.id ? { ...n, age_group: e.target.value } : n
                          )
                        )
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={{ marginBottom: 6 }}>City</div>
                    <input
                      value={need.city ?? ""}
                      onChange={(e) =>
                        setNeeds((prev) =>
                          prev.map((n) =>
                            n.id === need.id ? { ...n, city: e.target.value } : n
                          )
                        )
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={{ marginBottom: 6 }}>State</div>
                    <input
                      value={need.state ?? ""}
                      onChange={(e) =>
                        setNeeds((prev) =>
                          prev.map((n) =>
                            n.id === need.id ? { ...n, state: e.target.value } : n
                          )
                        )
                      }
                      style={inputStyle}
                    />
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 12 }}>
                  <div style={{ marginBottom: 6 }}>Notes</div>
                  <textarea
                    value={need.notes ?? ""}
                    onChange={(e) =>
                      setNeeds((prev) =>
                        prev.map((n) =>
                          n.id === need.id ? { ...n, notes: e.target.value } : n
                        )
                      )
                    }
                    style={{ ...inputStyle, minHeight: 90 }}
                  />
                </label>

                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(need.is_open)}
                    onChange={(e) =>
                      setNeeds((prev) =>
                        prev.map((n) =>
                          n.id === need.id ? { ...n, is_open: e.target.checked } : n
                        )
                      )
                    }
                  />
                  Open need
                </label>

                <div style={{ marginTop: 14 }}>
                  <button
                    onClick={() => saveNeed(need)}
                    disabled={savingNeedId === need.id}
                    style={buttonStyle}
                  >
                    {savingNeedId === need.id ? "Saving..." : "Save Need"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "#fff",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};