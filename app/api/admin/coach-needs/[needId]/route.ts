// app/api/admin/coach-needs/[needId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { logAdminEvent } from "@/lib/adminAudit";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ---------- helpers ----------

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function getIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

function clean(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function normalizeDate(input?: string | Date | null): string | null {
  if (!input) return null;

  if (input instanceof Date && !isNaN(+input)) {
    return input.toISOString().slice(0, 10);
  }

  if (typeof input === "string") {
    const s = input.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const d = new Date(s);
    if (!isNaN(+d)) return d.toISOString().slice(0, 10);
  }

  return null;
}

async function requireAdmin() {
  const session = (await getServerSession(authConfig as any)) as any;

  if (!session?.user) return null;

  const email = String(session.user?.email ?? "").toLowerCase();
  const role = String(session.user?.role ?? "").toLowerCase();

  const superEmails = String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const allowed =
    role === "admin" ||
    role === "super_admin" ||
    superEmails.includes(email);

  if (!allowed) return null;

  return session;
}

// ---------- PATCH (UPDATE NEED) ----------

export async function PATCH(
  req: NextRequest,
  { params }: { params: { needId: string } }
) {
  const session = await requireAdmin();

  if (!session?.user) {
    return jsonError("Unauthorized", 401);
  }

  const adminUserId = Number(session.user?.id ?? 0);
  const needId = Number(params?.needId ?? 0);

  if (!Number.isFinite(needId) || needId <= 0) {
    return jsonError("Invalid need id", 400);
  }

  try {
    const body = await req.json().catch(() => ({}));

    const updates = {
      event_name: clean(body?.event_name),
      event_date: normalizeDate(body?.event_date),
      weight_class: clean(body?.weight_class),
      age_group: clean(body?.age_group), // 🔥 THIS fixes U15 issues
      city: clean(body?.city),
      state: clean(body?.state),
      notes: clean(body?.notes),
      is_open:
        typeof body?.is_open === "boolean" ? body.is_open : undefined,
    };

    // Build dynamic SQL (only update provided fields)
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        sets.push(`${key} = $${i++}`);
        values.push(value);
      }
    }

    if (sets.length === 0) {
      return jsonError("No fields to update", 400);
    }

    values.push(needId);

    const sql = `
      UPDATE public.coach_needs
         SET ${sets.join(", ")}
       WHERE id = $${i}
       RETURNING *
    `;

    const res = await pool.query(sql, values);

    if (res.rowCount === 0) {
      return jsonError("Need not found", 404);
    }

    // 🔥 Admin audit log
    if (adminUserId > 0) {
      try {
        await logAdminEvent({
          adminUserId,
          action: "admin_update_coach_need",
          entityType: "coach_need",
          entityId: needId,
          metadata: updates,
          ip: getIp(req),
          userAgent: req.headers.get("user-agent"),
        });
      } catch {
        // ignore audit issues
      }
    }

    return NextResponse.json({
      ok: true,
      need: res.rows[0],
    });
  } catch (e: any) {
    console.error("[admin coach need PATCH] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}

// ---------- DELETE (SOFT DELETE / HIDE) ----------

export async function DELETE(
  req: NextRequest,
  { params }: { params: { needId: string } }
) {
  const session = await requireAdmin();

  if (!session?.user) {
    return jsonError("Unauthorized", 401);
  }

  const adminUserId = Number(session.user?.id ?? 0);
  const needId = Number(params?.needId ?? 0);

  if (!Number.isFinite(needId) || needId <= 0) {
    return jsonError("Invalid need id", 400);
  }

  try {
    const res = await pool.query(
      `
      UPDATE public.coach_needs
         SET is_visible = FALSE,
             expired_at = NOW()
       WHERE id = $1
       RETURNING id
      `,
      [needId]
    );

    if (res.rowCount === 0) {
      return jsonError("Need not found", 404);
    }

    // 🔥 audit log
    if (adminUserId > 0) {
      try {
        await logAdminEvent({
          adminUserId,
          action: "admin_delete_coach_need",
          entityType: "coach_need",
          entityId: needId,
          metadata: { softDeleted: true },
          ip: getIp(req),
          userAgent: req.headers.get("user-agent"),
        });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      deleted: 1,
    });
  } catch (e: any) {
    console.error("[admin coach need DELETE] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}