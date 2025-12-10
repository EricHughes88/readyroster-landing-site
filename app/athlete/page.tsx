// app/athlete/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

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

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="py-10 px-6 max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Athlete Dashboard</h1>
          <p className="text-slate-300 mt-2">Welcome, {name}.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold mb-2">Your Availability</h2>
            <p className="text-slate-300 mb-4">
              Manage your event availability and respond to match requests.
            </p>
            <div className="flex gap-3">
              <Link
                href="/athlete/availability"
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition font-semibold"
              >
                Update Availability
              </Link>
              <Link
                href="/athlete/matches"
                className="px-5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition font-semibold"
              >
                View Matches
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold mb-2">Messages</h2>
            <p className="text-slate-300 mb-4">
              Chat with coaches once a match is confirmed.
            </p>
            <Link
              href="/athlete/messages"
              className="text-red-400 hover:text-red-300 underline"
            >
              Go to Messages
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
