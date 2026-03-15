// app/api/cron/recruiting-alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runRecruitingAlerts } from "@/lib/recruitingAlerts";
import { acquireJobLock, releaseJobLock } from "@/lib/jobLock";

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
  const jobName = "recruiting-alerts-cron";

  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const lock = await acquireJobLock(jobName, 15);

    if (!lock.acquired) {
      return NextResponse.json({
        ok: true,
        source: "cron",
        skipped: true,
        message: "Job already running",
      });
    }

    const result = await runRecruitingAlerts();

    await releaseJobLock(jobName, "success");

    return NextResponse.json({
      source: "cron",
      skipped: false,
      ...result,
    });
  } catch (err: any) {
    console.error("cron recruiting alerts error", err);

    try {
      await releaseJobLock(jobName, "failed");
    } catch {}

    return NextResponse.json(
      {
        ok: false,
        message: err?.message || "Failed to run recruiting alerts cron",
      },
      { status: 500 }
    );
  }
}