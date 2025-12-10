// app/parent/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Ensure session is fetched at request time (no static/prerender here)
export const dynamic = "force-dynamic";
export const revalidate = 0;

function routeForRole(role?: string) {
  switch ((role ?? "").toLowerCase()) {
    case "coach":
      return "/coach";
    case "athlete":
      return "/athlete";
    case "admin":
      return "/admin";
    case "parent":
      return "/parent";
    default:
      return null; // unknown → treat as unauthenticated
  }
}

export default async function ParentPage() {
  const session = await auth();

  // No session → go sign in (then come back here)
  if (!session?.user) {
    redirect("/login?callbackUrl=/parent");
  }

  const role = (session.user as any)?.role as string | undefined;
  const destination = routeForRole(role);

  // If role is recognized but not Parent, route them to their dashboard
  if (destination && destination !== "/parent") {
    redirect(destination);
  }

  // Unknown role → force login to re-establish a clean session
  if (!destination) {
    redirect("/login?callbackUrl=/parent");
  }

  // Friendly display name
  const displayName =
    session.user.name ??
    (session.user.email ? session.user.email.split("@")[0] : "Parent");

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="py-10 px-6 max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Parent Dashboard</h1>
          <p className="text-slate-300 mt-2">Welcome, {displayName}.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold mb-2">Your Wrestlers</h2>
            <p className="text-slate-300 mb-4">
              View and manage wrestler profiles, interests, and messages.
            </p>
            <div className="flex gap-3">
              <Link
                href="/parent/wrestlers"
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition font-semibold"
              >
                Open Dashboard
              </Link>
              <Link
                href="/parent/wrestlers/new"
                className="px-5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition font-semibold"
              >
                Add Wrestler
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold mb-2">Getting Started</h2>
            <ul className="list-disc list-inside text-slate-300 space-y-2">
              <li>Create or select a wrestler profile.</li>
              <li>Add event interests (event, date, age group, weight class).</li>
              <li>Review pending/confirmed matches and messages.</li>
            </ul>
            <div className="mt-4">
              <Link
                href="/parent/wrestlers"
                className="text-red-400 hover:text-red-300 underline"
              >
                Go to Wrestlers
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
