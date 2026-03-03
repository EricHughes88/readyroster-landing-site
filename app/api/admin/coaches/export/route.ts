// app/api/admin/coaches/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { logAdminEvent } from "@/lib/adminAudit";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function getIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

function safeStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function escapeCsv(v: any) {
  const s = safeStr(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, message: "Not signed in" },
      { status: 401 }
    );
  }

  const role = (session.user as any)?.role;
  if (role !== "Admin") {
    // optional: log denied attempt
    try {
      const who = Number((session.user as any)?.id);
      if (Number.isFinite(who)) {
        await logAdminEvent({
          adminUserId: who,
          action: "admin_access_denied_export_coaches_csv",
          metadata: { path: "/api/admin/coaches/export" },
          ip: getIp(req),
          userAgent: req.headers.get("user-agent"),
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      { ok: false, message: "Access denied" },
      { status: 403 }
    );
  }

  const adminUserId = Number((session.user as any)?.id);
  if (!Number.isFinite(adminUserId)) {
    return NextResponse.json(
      { ok: false, message: "Invalid session user id" },
      { status: 400 }
    );
  }

  const pool = getPool();
  const url = new URL(req.url);

  // Optional filter: export only a state (e.g. ?state=NY)
  const state = (url.searchParams.get("state") || "").trim().toUpperCase() || null;

  const params: any[] = [];
  let where = `WHERE LOWER(u.role) = 'coach'`;

  if (state) {
    params.push(state);
    where += ` AND UPPER(COALESCE(t.state, '')) = $${params.length}`;
  }

  try {
    const q = `
      SELECT
        u.id,
        u.firstname,
        u.lastname,
        u.email,
        u.phone,
        u.created_at,

        t.teamid,
        t.teamname,
        t.coach_name,
        t.contactemail,
        t.logopath,
        t.city,
        t.state
      FROM public.users u
      LEFT JOIN public.teams t
        ON t.userid = u.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT 5000
    `;

    const { rows } = await pool.query(q, params);

    const headers = [
      "id",
      "firstname",
      "lastname",
      "email",
      "phone",
      "created_at",
      "teamid",
      "teamname",
      "coach_name",
      "contactemail",
      "logopath",
      "city",
      "state",
    ];

    const lines: string[] = [];
    lines.push(headers.join(","));
    for (const r of rows) {
      lines.push(
        headers.map((h) => escapeCsv((r as any)[h])).join(",")
      );
    }

    const csv = lines.join("\n");

    // ✅ Log export action
    await logAdminEvent({
      adminUserId,
      action: "export_coaches_csv",
      entityType: "coach",
      metadata: {
        filters: { state },
        returnedCount: rows.length,
      },
      ip: getIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    const filename = state
      ? `ready_roster_coaches_${state}_${new Date().toISOString().slice(0, 10)}.csv`
      : `ready_roster_coaches_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    // Optional: log export failure
    try {
      await logAdminEvent({
        adminUserId,
        action: "export_coaches_csv_error",
        entityType: "coach",
        metadata: {
          message: String(err?.message ?? err),
          filters: { state },
        },
        ip: getIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      { ok: false, message: "Failed to export coaches CSV", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}