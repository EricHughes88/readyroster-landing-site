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
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function getIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "Not signed in" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (role !== "Admin") {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  // ✅ Super Admin only
  const email = String((session.user as any)?.email ?? "").trim().toLowerCase();
  const supers = getSuperAdminEmails();
  if (!supers.length || !supers.includes(email)) {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  const adminUserId = Number((session.user as any)?.id);
  if (!Number.isFinite(adminUserId)) {
    return NextResponse.json({ ok: false, message: "Invalid session user id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = Number(body?.userId);
  const newRole = String(body?.role || "").trim();

  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ ok: false, message: "Invalid userId" }, { status: 400 });
  }
  if (!["Admin", "Parent"].includes(newRole)) {
    return NextResponse.json({ ok: false, message: "Invalid role" }, { status: 400 });
  }

  const pool = getPool();

  // prevent locking yourself out accidentally
  if (userId === adminUserId && newRole !== "Admin") {
    return NextResponse.json({ ok: false, message: "You cannot remove your own Admin role." }, { status: 400 });
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
    // ignore
  }

  return NextResponse.json({ ok: true, user: updated });
}