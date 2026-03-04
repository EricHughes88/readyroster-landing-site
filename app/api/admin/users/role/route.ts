// app/api/admin/users/role/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { logAdminEvent } from "@/lib/adminAudit";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}
const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");
  if (!global.__RR_PG_POOL__) global.__RR_PG_POOL__ = new Pool({ connectionString: conn });
  return global.__RR_PG_POOL__;
}

function getSuperAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function getIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

/**
 * ✅ Allowed roles you can set from the UI.
 * Keep these EXACTLY matching what you store in public.users.role
 */
const ALLOWED_ROLES = ["Parent", "Admin", "Super Admin"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "Not signed in" }, { status: 401 });
  }

  // Must already be an Admin (or Super Admin) to access this endpoint
  const sessionRole = String((session.user as any)?.role || "").trim();
  if (sessionRole !== "Admin" && sessionRole !== "Super Admin") {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  // ✅ Super Admin only (via allowlist)
  const email = String((session.user as any)?.email ?? "").trim().toLowerCase();
  const supers = getSuperAdminEmails();
  if (!supers.length || !supers.includes(email)) {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  const adminUserId = Number((session.user as any)?.id);
  if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
    return NextResponse.json(
      { ok: false, message: "Invalid session user id" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const userId = Number(body?.userId);
  const newRole = String(body?.role || "").trim() as AllowedRole;

  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ ok: false, message: "Invalid userId" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(newRole)) {
    return NextResponse.json(
      { ok: false, message: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  const pool = getPool();

  // ✅ Prevent locking yourself out accidentally:
  // - You cannot demote yourself to Parent
  // - You cannot demote yourself from Super Admin to Admin (recommended)
  if (userId === adminUserId) {
    if (newRole === "Parent") {
      return NextResponse.json(
        { ok: false, message: "You cannot remove your own admin access." },
        { status: 400 }
      );
    }
    if (sessionRole === "Super Admin" && newRole === "Admin") {
      return NextResponse.json(
        { ok: false, message: "You cannot demote yourself from Super Admin." },
        { status: 400 }
      );
    }
  }

  const { rows } = await pool.query(
    `
    UPDATE public.users
    SET role = $2
    WHERE id = $1
    RETURNING id, email, role
    `,
    [userId, newRole]
  );

  const updated = rows?.[0];
  if (!updated) {
    return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
  }

  // log it
  try {
    await logAdminEvent({
      adminUserId,
      action: "admin_change_user_role",
      entityType: "user",
      entityId: userId,
      metadata: { newRole, targetEmail: updated.email },
      ip: getIp(req),
      userAgent: req.headers.get("user-agent"),
    });
  } catch {
    // ignore audit logging failures
  }

  return NextResponse.json({ ok: true, user: updated });
}