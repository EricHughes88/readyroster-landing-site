// app/coach/team-profile/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CoachTeamProfileClient from "@/app/coach/team-profile/CoachTeamProfileClient";



export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeamProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/coach/team-profile");
  }

  const role = (session.user as any)?.role?.toLowerCase();
  if (role !== "coach") {
    if (role === "parent") redirect("/parent");
    if (role === "athlete") redirect("/athlete");
    if (role === "admin") redirect("/admin");
    redirect("/login?callbackUrl=/coach/team-profile");
  }

  return <CoachTeamProfileClient user={session.user as any} />;
}
