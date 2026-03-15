// app/api/admin/coach-leads/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { runCoachLeadDigest } from "@/lib/coachLeads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSuperEmails(): string[] {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;
    const email = String(session?.user?.email ?? "").toLowerCase();

    if (!session?.user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!getSuperEmails().includes(email)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const result = await runCoachLeadDigest();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || "Failed to run coach leads" },
      { status: 500 }
    );
  }
}