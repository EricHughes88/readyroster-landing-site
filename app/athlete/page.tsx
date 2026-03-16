import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import AthleteProfileActivity from "@/components/athlete/AthleteProfileActivity";
import DeleteAccountButton from "@/components/account/DeleteAccountButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AthletePage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/athlete");

  const role = (session.user as any)?.role?.toLowerCase();

  if (role !== "athlete") {
    if (role === "parent") redirect("/parent");
    if (role === "coach") redirect("/coach");
    if (role === "admin") redirect("/admin");
    redirect("/login?callbackUrl=/athlete");
  }

  const name =
    session.user.name ??
    (session.user.email ? session.user.email.split("@")[0] : "Athlete");

  const userId = Number((session.user as any)?.id ?? (session.user as any)?.uid);

  let athleteId: number | null = null;

  if (Number.isFinite(userId)) {
    const res = await pool.query(
      `
      SELECT id
      FROM public.wrestlers
      WHERE parent_user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    athleteId = res.rows[0]?.id ?? null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Athlete Dashboard</h1>
          <p className="mt-2 text-slate-300">Welcome, {name}.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-2 text-xl font-semibold">Your Availability</h2>

            <p className="mb-4 text-slate-300">
              Manage your event availability and respond to match requests.
            </p>

            <div className="flex gap-3">
              <Link
                href="/athlete/availability"
                className="rounded-lg bg-red-600 px-5 py-2 font-semibold transition hover:bg-red-700"
              >
                Update Availability
              </Link>

              <Link
                href="/athlete/matches"
                className="rounded-lg border border-slate-700 px-5 py-2 font-semibold transition hover:bg-slate-800"
              >
                View Matches
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-2 text-xl font-semibold">Messages</h2>

            <p className="mb-4 text-slate-300">
              Chat with coaches once a match is confirmed.
            </p>

            <Link
              href="/athlete/messages"
              className="text-red-400 underline hover:text-red-300"
            >
              Go to Messages
            </Link>
          </div>
        </div>

        {/* Profile Activity */}
        {athleteId && (
          <div className="mt-8">
            <AthleteProfileActivity athleteId={athleteId} />
          </div>
        )}

        {/* Account Settings */}
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Account Settings</h2>

          <div className="max-w-md">
            <DeleteAccountButton />
          </div>
        </section>
      </section>
    </main>
  );
}