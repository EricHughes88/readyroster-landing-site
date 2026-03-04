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
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
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

const ALLOWED_ROLES = ["Parent", "Admin", "Super Admin"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export async function PATCH(req: NextRequest) {
  const session = (await getServerSession(authConfig as any)) as any;

  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "Not signed in" }, { status: 401 });
  }

  const email = String(session.user.email ?? "").trim().toLowerCase();
  const role = String(session.user.role ?? "").trim();

  const allowByEmail = getSuperAdminEmails().includes(email);
  const allowByRole = role === "Admin" || role === "Super Admin";

  // ✅ Super-only endpoint (must be super email allowlist OR DB role)
  if (!allowByEmail && role !== "Super Admin") {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  // Also require they are admin-ish (redundant safety)
  if (!allowByEmail && !allowByRole) {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  const adminUserId = Number(session.user.id);
  if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
    return NextResponse.json({ ok: false, message: "Invalid session user id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = Number(body?.userId);
  const newRole = String(body?.role ?? "").trim() as AllowedRole;

  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ ok: false, message: "Invalid userId" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(newRole)) {
    return NextResponse.json(
      { ok: false, message: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  // ✅ prevent you from demoting yourself to Parent accidentally
  if (userId === adminUserId && newRole === "Parent") {
    return NextResponse.json(
      { ok: false, message: "You cannot remove your own admin access." },
      { status: 400 }
    );
  }

  const pool = getPool();

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