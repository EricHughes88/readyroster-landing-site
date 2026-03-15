import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { runRecruitingAlerts } from "@/lib/recruitingAlerts";

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

    const allowed = getSuperEmails();
    if (!allowed.includes(email)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const result = await runRecruitingAlerts();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("recruiting alerts run error", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Failed to run recruiting alerts" },
      { status: 500 }
    );
  }
}