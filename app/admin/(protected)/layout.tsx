// app/admin/(protected)/layout.tsx

import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth.config";

/**
 * Emails that are always treated as Super Admins
 * defined in .env:
 *
 * SUPER_ADMIN_EMAILS=eric@nuwaycombat.com
 */
function getSuperEmails(): string[] {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Minimal session shape so TypeScript
 * doesn't complain about session.user
 */
type SessionLike =
  | {
      user?: {
        id?: number | string | null;
        email?: string | null;
        role?: string | null;
        name?: string | null;
      };
    }
  | null;

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = (await getServerSession(authConfig as any)) as SessionLike;

  // Not logged in
  if (!session?.user) {
    redirect("/login");
  }

  const role = String(session.user.role ?? "").trim();
  const email = String(session.user.email ?? "").trim().toLowerCase();

  const supers = getSuperEmails();
  const isSuper = supers.includes(email);

  /**
   * Allow access if:
   * - role === Admin
   * - OR email is in SUPER_ADMIN_EMAILS
   */
  if (role !== "Admin" && !isSuper) {
    redirect("/access-denied?path=/admin");
  }

  return <>{children}</>;
}