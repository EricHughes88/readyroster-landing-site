// app/teams/[teamId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

type TeamRow = {
  teamid: number;
  teamname: string | null;
  coach_name: string | null;
  contactemail: string | null;
  logopath: string | null;
  user_name: string | null;
  user_email: string | null;
};

async function getTeam(teamId: number): Promise<TeamRow | null> {
  if (!teamId || !Number.isFinite(teamId)) return null;

  const sql = `
    SELECT
      t.teamid,
      t.teamname,
      t.coach_name,
      t.contactemail,
      t.logopath,
      u.name  AS user_name,
      u.email AS user_email
    FROM teams t
    LEFT JOIN users u ON u.id = t.userid
    WHERE t.teamid = $1
    LIMIT 1
  `;

  const { rows } = await pool.query(sql, [teamId]);
  return rows[0] ?? null;
}

function displayName(team: TeamRow): string {
  return team.teamname || "Team name not set";
}

export default async function TeamPublicPage({
  params,
}: {
  params: { teamId: string };
}) {
  const id = Number(params.teamId);
  if (!id || !Number.isFinite(id)) {
    notFound();
  }

  const team = await getTeam(id);
  if (!team) {
    notFound();
  }

  const name = displayName(team);
  const coachName = team.coach_name || team.user_name || "Coach name not set";
  const email = team.contactemail || team.user_email || null;
  const logo = team.logopath || null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Team Profile</h1>
          <Link
            href="/parent"
            className="px-3 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
          >
            Back to dashboard
          </Link>
        </div>

        <p className="text-sm text-slate-300 mb-6">
          This is how this team appears to parents when they view a match or
          click on the team name.
        </p>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex gap-4">
          {/* Logo / placeholder */}
          <div className="w-24 h-24 rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center text-xs text-slate-400 overflow-hidden shrink-0">
            {logo ? (
              // simple logo display; later we can improve with next/image
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={`${name} logo`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>No Logo</span>
            )}
          </div>

          {/* Main info */}
          <div className="flex-1 space-y-2">
            <div>
              <h2 className="text-xl font-semibold">{name}</h2>
              <p className="text-sm text-slate-400">
                Coach: <span className="text-slate-100">{coachName}</span>
              </p>
            </div>

            {email && (
              <p className="text-sm text-slate-300">
                Contact:{" "}
                <a
                  href={`mailto:${email}`}
                  className="text-sky-400 hover:underline"
                >
                  {email}
                </a>
              </p>
            )}

            {!email && (
              <p className="text-sm text-slate-400">
                No contact email has been set yet.
              </p>
            )}

            <p className="text-xs text-slate-500 pt-2">
              Team details are managed by the coach from their{" "}
              <Link
                href="/coach/team-profile"
                className="text-sky-400 hover:underline"
              >
                Team Profile
              </Link>{" "}
              screen.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
