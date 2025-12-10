// app/coach/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CoachHomeClient from "./CoachHomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CoachPage() {
  const session = await auth();

  // Not logged in → redirect to login (with callback)
  if (!session?.user) {
    redirect("/login?callbackUrl=/coach" as any);
  }

  const role = (session.user as any)?.role?.toLowerCase();

  // If the user is not a coach, route them to the correct dashboard
  if (role !== "coach") {
    if (role === "parent") redirect("/parent" as any);
    if (role === "athlete") redirect("/athlete" as any);
    if (role === "admin") redirect("/admin" as any);

    // Fallback — unknown role → login
    redirect("/login?callbackUrl=/coach" as any);
  }

  // User is authenticated & a coach — load the actual dashboard client UI
  return <CoachHomeClient user={session.user as any} />;
}
