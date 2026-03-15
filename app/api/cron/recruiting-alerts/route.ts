// app/api/cron/recruiting-alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runRecruitingAlerts } from "@/lib/recruitingAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.warn("CRON_SECRET is not set");
    return false;
  }

  return authHeader === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await runRecruitingAlerts();

    return NextResponse.json({
      source: "cron",
      ...result,
    });
  } catch (err: any) {
    console.error("cron recruiting alerts error", err);

    return NextResponse.json(
      {
        ok: false,
        message: err?.message || "Failed to run recruiting alerts cron",
      },
      { status: 500 }
    );
  }
}