// app/api/parent/summary/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { getParentQuickSummary } from "@/lib/parentSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized", summary: [] },
        { status: 401 }
      );
    }

    const userId = Number(session.user.id ?? session.user.uid);
    const role = String(session.user.role ?? "").toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Invalid session user", summary: [] },
        { status: 400 }
      );
    }

    if (role !== "parent") {
      return NextResponse.json(
        { ok: false, message: "Forbidden", summary: [] },
        { status: 403 }
      );
    }

    const summary = await getParentQuickSummary(userId);

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error: any) {
    console.error("GET /api/parent/summary failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Failed to load parent summary",
        summary: [],
      },
      { status: 500 }
    );
  }
}