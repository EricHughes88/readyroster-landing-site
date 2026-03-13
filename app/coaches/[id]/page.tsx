// app/coaches/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import FollowCoachButton from "@/components/coach/FollowCoachButton";

type PageProps = {
  params: {
    id: string;
  };
};

type TeamProfileApiResponse =
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
        city?: string | null;
        state?: string | null;
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
      city?: string | null;
      state?: string | null;
      message?: string;
    };

type CoachNeed = {
  id: number;
  coach_user_id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  is_open: boolean | null;
  created_at: string | null;
};

type CoachNeedsApiResponse = {
  ok?: boolean;
  needs?: CoachNeed[];
  message?: string;
};

function getBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatLocation(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(", ") || "—";
}

async function getCoachProfile(coachUserId: number) {
  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(
      `${baseUrl}/api/coach/team-profile?coachUserId=${coachUserId}`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as TeamProfileApiResponse;
    const raw =
      "profile" in data && data.profile ? data.profile : (data as any);

    if (!raw) return null;

    return {
      teamName: raw.teamName ?? raw.team_name ?? "",
      coachName: raw.coachName ?? raw.coach_name ?? "",
      contactEmail: raw.contactEmail ?? raw.contact_email ?? "",
      logoPath: raw.logoPath ?? raw.logopath ?? null,
      city: raw.city ?? null,
      state: raw.state ?? null,
    };
  } catch (error) {
    console.error("Failed to load coach profile:", error);
    return null;
  }
}

async function getCoachNeeds(coachUserId: number) {
  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(
      `${baseUrl}/api/coach/needs?coachUserId=${coachUserId}&limit=10`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as CoachNeedsApiResponse;
    return Array.isArray(data.needs) ? data.needs : [];
  } catch (error) {
    console.error("Failed to load coach needs:", error);
    return [];
  }
}

export default async function CoachPublicProfilePage({ params }: PageProps) {
  const coachUserId = Number(params.id);

  if (!Number.isFinite(coachUserId) || coachUserId <= 0) {
    notFound();
  }

  const [profile, needs] = await Promise.all([
    getCoachProfile(coachUserId),
    getCoachNeeds(coachUserId),
  ]);

  if (!profile) {
    notFound();
  }

  const openNeeds = needs.filter((n) => n.is_open !== false);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/following"
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back to Following
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 text-xs text-slate-300">
                {profile.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.logoPath}
                    alt={`${profile.teamName || profile.coachName || "Team"} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>No Logo</span>
                )}
              </div>

              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Team Profile
              </div>

              <h1 className="mt-2 text-2xl font-bold text-white">
                {profile.teamName || "Unnamed Team"}
              </h1>

              <p className="mt-2 text-sm text-slate-300">
                Coach: {profile.coachName || "—"}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                {formatLocation(profile.city, profile.state)}
              </p>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-6">
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Contact Email
                  </div>
                  <div className="mt-1 text-slate-200">
                    {profile.contactEmail || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Team Location
                  </div>
                  <div className="mt-1 text-slate-200">
                    {formatLocation(profile.city, profile.state)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-6">
              <FollowCoachButton coachUserId={coachUserId} />
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Ready Roster
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Open Team Needs
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    See what this coach is currently looking for.
                  </p>
                </div>

                <div className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300">
                  {openNeeds.length} Open
                </div>
              </div>
            </div>

            {openNeeds.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
                No open team needs posted right now.
              </div>
            ) : (
              <div className="grid gap-4">
                {openNeeds.map((need) => (
                  <div
                    key={need.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {need.event_name || "Unnamed Event"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {formatDate(need.event_date)} •{" "}
                          {need.age_group || "—"} • {need.weight_class || "—"}
                        </p>
                      </div>

                      <div className="rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-300">
                        {need.is_open === false ? "Closed" : "Open"}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Event
                        </div>
                        <div className="mt-1 text-slate-200">
                          {need.event_name || "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Date
                        </div>
                        <div className="mt-1 text-slate-200">
                          {formatDate(need.event_date)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Location
                        </div>
                        <div className="mt-1 text-slate-200">
                          {formatLocation(need.city, need.state)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Age Group
                        </div>
                        <div className="mt-1 text-slate-200">
                          {need.age_group || "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Weight Class
                        </div>
                        <div className="mt-1 text-slate-200">
                          {need.weight_class || "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Posted
                        </div>
                        <div className="mt-1 text-slate-200">
                          {formatDate(need.created_at)}
                        </div>
                      </div>
                    </div>

                    {need.notes ? (
                      <div className="mt-4 border-t border-slate-800 pt-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Notes
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                          {need.notes}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-5">
                      <Link
                        href={`/coach/needs/${need.id}/matches` as const}
                        className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                      >
                        View Matches
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}