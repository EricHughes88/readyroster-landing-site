// app/admin/(super)/layout.tsx
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth.config";

function getSuperEmails(): string[] {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

type SessionLike =
  | {
      user?: {
        email?: string | null;
        role?: string | null;
        id?: string | number | null;
        name?: string | null;
      };
    }
  | null;

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // ✅ Fix TS: getServerSession types to {} in some setups; cast to our minimal shape
  const session = (await getServerSession(authConfig as any)) as SessionLike;

  if (!session?.user) {
    redirect("/login");
  }

  const email = String(session.user.email ?? "").trim().toLowerCase();
  const supers = getSuperEmails();

  // ✅ Super Admin = allowlist only (SUPER_ADMIN_EMAILS)
  const isSuper = Boolean(email && supers.includes(email));

  if (!isSuper) {
    redirect("/access-denied?path=/admin/admins");
  }

  return <>{children}</>;
}