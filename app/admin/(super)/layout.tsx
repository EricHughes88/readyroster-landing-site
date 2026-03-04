// app/admin/(super)/layout.tsx
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth.config";

function getSuperAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default async function AdminSuperLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authConfig);

  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const role = (session.user as any)?.role;
  const email = String((session.user as any)?.email ?? "")
    .trim()
    .toLowerCase();

  if (role !== "Admin") redirect("/access-denied?to=%2Fadmin");

  const allow = getSuperAdminEmails();
  // safer default: if env is missing, deny
  if (!allow.length || !allow.includes(email)) {
    redirect("/access-denied?to=%2Fadmin%2Fadmins");
  }

  return <>{children}</>;
}