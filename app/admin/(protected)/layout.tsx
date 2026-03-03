// app/admin/(protected)/layout.tsx
import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authConfig } from "@/auth.config";
import { logAdminEvent } from "@/lib/adminAudit";
import pg from "pg";

// ---- PG pool singleton (avoids many pools during dev HMR) ----
declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}
const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");
  if (!global.__RR_PG_POOL__) {
    global.__RR_PG_POOL__ = new Pool({ connectionString: conn });
  }
  return global.__RR_PG_POOL__;
}

function getIpFromHeaders(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || null;
}

/**
 * Best-effort: derive the attempted pathname from headers.
 * Different hosts/dev servers expose different headers, so we try several.
 */
function getAttemptedPath(h: Headers): string {
  const candidates = [
    h.get("x-invoke-path"),
    h.get("x-matched-path"),
    h.get("next-url"),
    h.get("x-next-url"),
    h.get("x-vercel-path"),
  ].filter(Boolean) as string[];

  for (const v of candidates) {
    try {
      if (v.startsWith("http://") || v.startsWith("https://")) {
        return new URL(v).pathname || "/admin";
      }
      if (v.startsWith("/")) return v;
    } catch {
      // ignore
    }
  }

  const ref = h.get("referer");
  if (ref) {
    try {
      return new URL(ref).pathname || "/admin";
    } catch {
      // ignore
    }
  }

  return "/admin";
}

async function countRecentDenied(adminUserId: number): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ c: string }>(
    `
    select count(*)::text as c
    from public.admin_audit_log
    where admin_user_id = $1
      and action = 'admin_access_denied'
      and created_at >= now() - interval '10 minutes'
    `,
    [adminUserId]
  );
  const n = Number(rows?.[0]?.c ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authConfig);

  // Not signed in → send to login with callback
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  const role = (session.user as any)?.role;
  const userIdRaw = (session.user as any)?.id;
  const userEmail = (session.user as any)?.email ?? null;

  // Signed in but not Admin → log + redirect to access denied
  if (role !== "Admin") {
    const h = headers();
    const ip = getIpFromHeaders(h);
    const ua = h.get("user-agent") || null;
    const attemptedPath = getAttemptedPath(h);

    const actorId = Number(userIdRaw);
    if (Number.isFinite(actorId)) {
      // 1) Log the denied attempt (always)
      try {
        await logAdminEvent({
          adminUserId: actorId, // storing the actor user id even if they're not admin
          action: "admin_access_denied",
          metadata: {
            attempted_area: attemptedPath,
            role,
            email: userEmail,
          },
          ip,
          userAgent: ua,
        });
      } catch {
        // ignore
      }

      // 2) “Level up”: If 5 denied attempts in last 10 minutes → log suspicious
      try {
        const recentDenied = await countRecentDenied(actorId);
        // recentDenied includes the row we just inserted (usually), but even if not,
        // the threshold logic still works with >= 5.
        if (recentDenied >= 5) {
          await logAdminEvent({
            adminUserId: actorId,
            action: "admin_access_suspicious",
            metadata: {
              attempted_area: attemptedPath,
              role,
              email: userEmail,
              denied_in_last_10_min: recentDenied,
              threshold: 5,
              window_minutes: 10,
            },
            ip,
            userAgent: ua,
          });
        }
      } catch {
        // ignore
      }
    }

    redirect(`/access-denied?to=${encodeURIComponent(attemptedPath)}`);
  }

  // Admin → allow
  return <>{children}</>;
}