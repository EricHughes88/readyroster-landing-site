import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type Params = {
  eventName: string;
};

type CoachNeedRow = {
  need_id: number;
  event_name: string | null;
  weight_class: string | null;
  age_group: string | null;
  team_name: string | null;
  coach_name: string | null;
  contact_email: string | null;
  city: string | null;
  state: string | null;
  created_at: string | null;
};

type AthleteInterestRow = {
  interest_id: number;
  event_name: string | null;
  weight_class: string | null;
  age_group: string | null;
  athlete_name: string | null;
  parent_name: string | null;
  parent_email: string | null;
  city: string | null;
  state: string | null;
  created_at: string | null;
};

type MatchRow = {
  match_id: number;
  event_name: string | null;
  status: string | null;
  athlete_name: string | null;
  team_name: string | null;
  coach_name: string | null;
  created_at: string | null;
};

function fmt(v: unknown, fallback = "—") {
  return v === null || v === undefined || String(v).trim() === ""
    ? fallback
    : String(v);
}

function formatLocation(city: string | null, state: string | null) {
  const c = String(city ?? "").trim();
  const s = String(state ?? "").trim();

  if (c && s) return `${c}, ${s}`;
  if (c) return c;
  if (s) return s;
  return "No location";
}

async function requireAdmin() {
  const session = (await getServerSession(authConfig as any)) as any;
  const user = session?.user;
  const email = String(user?.email ?? "").toLowerCase();
  const role = String(user?.role ?? "").toLowerCase();

  const superEmails = String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const allowed =
    role === "admin" || role === "super_admin" || superEmails.includes(email);

  if (!allowed) {
    redirect("/login");
  }

  return session;
}

function eventWhereSql(column: string) {
  return `LOWER(TRIM(COALESCE(${column}, ''))) = LOWER(TRIM($1))`;
}

async function getCoachNeeds(
  client: Pool,
  eventName: string
): Promise<CoachNeedRow[]> {
  const sql = `
    SELECT
      cn.id AS need_id,
      cn.event_name,
      cn.weight_class,
      cn.age_group,
      t.teamname AS team_name,
      t.coach_name,
      COALESCE(t.contactemail, u.email) AS contact_email,
      COALESCE(cn.city, t.city) AS city,
      COALESCE(cn.state, t.state) AS state,
      cn.created_at
    FROM public.coach_needs cn
    LEFT JOIN public.users u
      ON u.id = cn.coach_user_id
    LEFT JOIN LATERAL (
      SELECT
        teamname,
        coach_name,
        contactemail,
        city,
        state
      FROM public.teams
      WHERE userid = cn.coach_user_id
      ORDER BY teamid DESC NULLS LAST
      LIMIT 1
    ) t ON true
    WHERE ${eventWhereSql("cn.event_name")}
      AND COALESCE(cn.is_visible, TRUE) = TRUE
      AND COALESCE(cn.weight_class, '') NOT LIKE '%,%'
    ORDER BY cn.created_at DESC NULLS LAST, cn.id DESC
  `;

  const res = await client.query(sql, [eventName]);
  return res.rows;
}

async function getAthleteInterests(
  client: Pool,
  eventName: string
): Promise<AthleteInterestRow[]> {
  const sql = `
    SELECT
      wi.id AS interest_id,
      wi.event_name,
      wi.weight_class,
      wi.age_group,

      NULLIF(
        TRIM(
          CONCAT(
            COALESCE(w.first_name, ''),
            ' ',
            COALESCE(w.last_name, '')
          )
        ),
        ''
      ) AS athlete_name,

      NULLIF(
        TRIM(
          CONCAT(
            COALESCE(u.firstname, ''),
            ' ',
            COALESCE(u.lastname, '')
          )
        ),
        ''
      ) AS parent_name,

      u.email AS parent_email,
      w.city,
      w.state,
      wi.created_at
    FROM public.wrestler_interests wi
    LEFT JOIN public.wrestlers w
      ON w.id = wi.wrestler_id
    LEFT JOIN public.users u
      ON u.id = w.parent_user_id
    WHERE ${eventWhereSql("wi.event_name")}
    ORDER BY wi.created_at DESC NULLS LAST, wi.id DESC
  `;

  const res = await client.query(sql, [eventName]);
  return res.rows;
}

async function getMatches(
  client: Pool,
  eventName: string
): Promise<MatchRow[]> {
  const sql = `
    SELECT
      m.id AS match_id,
      COALESCE(wi.event_name, cn.event_name) AS event_name,
      m.status,

      NULLIF(
        TRIM(
          CONCAT(
            COALESCE(w.first_name, ''),
            ' ',
            COALESCE(w.last_name, '')
          )
        ),
        ''
      ) AS athlete_name,

      t.teamname AS team_name,
      t.coach_name,
      m.created_at
    FROM public.matches m
    LEFT JOIN public.wrestler_interests wi
      ON wi.id = m.wrestler_interest_id
    LEFT JOIN public.coach_needs cn
      ON cn.id = m.coach_need_id
    LEFT JOIN public.wrestlers w
      ON w.id = wi.wrestler_id
    LEFT JOIN LATERAL (
      SELECT
        teamname,
        coach_name
      FROM public.teams
      WHERE userid = cn.coach_user_id
      ORDER BY teamid DESC NULLS LAST
      LIMIT 1
    ) t ON true
    WHERE LOWER(TRIM(COALESCE(wi.event_name, cn.event_name, ''))) = LOWER(TRIM($1))
    ORDER BY m.created_at DESC NULLS LAST, m.id DESC
  `;

  const res = await client.query(sql, [eventName]);
  return res.rows;
}

function badgeStyle(status: string | null): React.CSSProperties {
  const s = String(status ?? "").toLowerCase();

  if (s === "confirmed") {
    return {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 999,
      background: "rgba(34,197,94,0.16)",
      color: "#86efac",
      fontWeight: 700,
      fontSize: 12,
      border: "1px solid rgba(34,197,94,0.35)",
    };
  }

  if (s === "pending") {
    return {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 999,
      background: "rgba(250,204,21,0.14)",
      color: "#fde68a",
      fontWeight: 700,
      fontSize: 12,
      border: "1px solid rgba(250,204,21,0.30)",
    };
  }

  if (s === "declined" || s === "cancelled") {
    return {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 999,
      background: "rgba(239,68,68,0.14)",
      color: "#fca5a5",
      fontWeight: 700,
      fontSize: 12,
      border: "1px solid rgba(239,68,68,0.30)",
    };
  }

  return {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.14)",
    color: "#cbd5e1",
    fontWeight: 700,
    fontSize: 12,
    border: "1px solid rgba(148,163,184,0.25)",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid #334155",
    borderRadius: 14,
    background: "rgba(2,6,23,0.45)",
    overflow: "hidden",
  };
}

function thStyle(): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "10px 12px",
    color: "#94a3b8",
    fontWeight: 800,
    fontSize: 13,
  };
}

function tdStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderTop: "1px solid #334155",
    color: "#e5e7eb",
    verticalAlign: "top",
  };
}

export default async function AdminEventDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireAdmin();

  const rawEventName = decodeURIComponent(params.eventName ?? "").trim();
  if (!rawEventName) notFound();

  const [coachNeeds, athleteInterests, matches] = await Promise.all([
    getCoachNeeds(pool, rawEventName),
    getAthleteInterests(pool, rawEventName),
    getMatches(pool, rawEventName),
  ]);

  const totalCoachNeeds = coachNeeds.length;
  const totalAthleteInterests = athleteInterests.length;
  const totalMatches = matches.length;
  const supplyGap = totalCoachNeeds - totalAthleteInterests;

  const exportCoachCsvHref = `/api/admin/export?type=coach-needs&event=${encodeURIComponent(
    rawEventName
  )}`;
  const exportAthleteCsvHref = `/api/admin/export?type=athlete-interests&event=${encodeURIComponent(
    rawEventName
  )}`;
  const exportMatchesCsvHref = `/api/admin/export?type=matches&event=${encodeURIComponent(
    rawEventName
  )}`;

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1280,
        margin: "0 auto",
        color: "#e5e7eb",
      }}
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
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>
            <Link
              href="/admin"
              style={{ color: "#94a3b8", textDecoration: "none" }}
            >
              Admin
            </Link>{" "}
            / <span style={{ color: "#cbd5e1" }}>Event Marketplace</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 34,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            {rawEventName}
          </h1>

          <p style={{ marginTop: 8, color: "#94a3b8" }}>
            Coaches looking for athletes, athletes looking for teams, and current
            match activity for this event.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/admin"
            style={{
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
            }}
          >
            Back
          </Link>

          <Link
            href="/admin/events"
            style={{
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
            }}
          >
            Normalize Events
          </Link>
        </div>
      </div>

      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {[
          ["Coach needs", totalCoachNeeds],
          ["Athlete interest", totalAthleteInterests],
          ["Matches", totalMatches],
          ["Supply gap", supplyGap],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 14,
              background: "rgba(2,6,23,0.35)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: "#fff",
                marginTop: 6,
              }}
            >
              {String(value)}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
        }}
      >
        <a
          href={exportCoachCsvHref}
          style={{
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
          }}
        >
          Export Coach Needs CSV
        </a>

        <a
          href={exportAthleteCsvHref}
          style={{
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
          }}
        >
          Export Athlete Interest CSV
        </a>

        <a
          href={exportMatchesCsvHref}
          style={{
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
          }}
        >
          Export Matches CSV
        </a>
      </section>

      <section
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
        }}
      >
        <div style={cardStyle()}>
          <div
            style={{
              padding: 14,
              borderBottom: "1px solid #334155",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div>
              <b style={{ color: "#fff" }}>Coaches looking for athletes</b>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {coachNeeds.length} need{coachNeeds.length === 1 ? "" : "s"} found
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle()}>Team</th>
                  <th style={thStyle()}>Coach</th>
                  <th style={thStyle()}>Weight</th>
                  <th style={thStyle()}>Age</th>
                  <th style={thStyle()}>Location</th>
                  <th style={thStyle()}>Contact</th>
                  <th style={thStyle()}>Created</th>
                </tr>
              </thead>
              <tbody>
                {coachNeeds.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={tdStyle()}>
                      <span style={{ color: "#94a3b8" }}>
                        No coach needs found for this event.
                      </span>
                    </td>
                  </tr>
                ) : (
                  coachNeeds.map((row) => (
                    <tr key={row.need_id}>
                      <td style={tdStyle()}>
                        {fmt(row.team_name, "No team profile yet")}
                      </td>
                      <td style={tdStyle()}>
                        {fmt(row.coach_name, "No coach name")}
                      </td>
                      <td style={tdStyle()}>{fmt(row.weight_class)}</td>
                      <td style={tdStyle()}>{fmt(row.age_group)}</td>
                      <td style={tdStyle()}>
                        {formatLocation(row.city, row.state)}
                      </td>
                      <td style={tdStyle()}>
                        {fmt(row.contact_email, "No contact email")}
                      </td>
                      <td style={tdStyle()}>
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString()
                          : "No timestamp"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle()}>
          <div
            style={{
              padding: 14,
              borderBottom: "1px solid #334155",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div>
              <b style={{ color: "#fff" }}>Athletes looking for teams</b>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {athleteInterests.length} interest
                {athleteInterests.length === 1 ? "" : "s"} found
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle()}>Athlete</th>
                  <th style={thStyle()}>Parent</th>
                  <th style={thStyle()}>Weight</th>
                  <th style={thStyle()}>Age</th>
                  <th style={thStyle()}>Location</th>
                  <th style={thStyle()}>Contact</th>
                  <th style={thStyle()}>Created</th>
                </tr>
              </thead>
              <tbody>
                {athleteInterests.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={tdStyle()}>
                      <span style={{ color: "#94a3b8" }}>
                        No athlete interest found for this event.
                      </span>
                    </td>
                  </tr>
                ) : (
                  athleteInterests.map((row) => (
                    <tr key={row.interest_id}>
                      <td style={tdStyle()}>
                        {fmt(row.athlete_name, "Wrestler profile missing")}
                      </td>
                      <td style={tdStyle()}>
                        {fmt(row.parent_name, "No parent name")}
                      </td>
                      <td style={tdStyle()}>{fmt(row.weight_class)}</td>
                      <td style={tdStyle()}>{fmt(row.age_group)}</td>
                      <td style={tdStyle()}>
                        {formatLocation(row.city, row.state)}
                      </td>
                      <td style={tdStyle()}>
                        {fmt(row.parent_email, "No parent email")}
                      </td>
                      <td style={tdStyle()}>
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString()
                          : "No timestamp"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle()}>
          <div
            style={{
              padding: 14,
              borderBottom: "1px solid #334155",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div>
              <b style={{ color: "#fff" }}>Matches for this event</b>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {matches.length} match{matches.length === 1 ? "" : "es"} found
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle()}>Athlete</th>
                  <th style={thStyle()}>Team</th>
                  <th style={thStyle()}>Coach</th>
                  <th style={thStyle()}>Status</th>
                  <th style={thStyle()}>Created</th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={tdStyle()}>
                      <span style={{ color: "#94a3b8" }}>
                        No matches found for this event.
                      </span>
                    </td>
                  </tr>
                ) : (
                  matches.map((row) => (
                    <tr key={row.match_id}>
                      <td style={tdStyle()}>
                        {fmt(row.athlete_name, "Wrestler profile missing")}
                      </td>
                      <td style={tdStyle()}>
                        {fmt(row.team_name, "No team profile yet")}
                      </td>
                      <td style={tdStyle()}>
                        {fmt(row.coach_name, "No coach name")}
                      </td>
                      <td style={tdStyle()}>
                        <span style={badgeStyle(row.status)}>
                          {fmt(row.status)}
                        </span>
                      </td>
                      <td style={tdStyle()}>
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString()
                          : "No timestamp"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}