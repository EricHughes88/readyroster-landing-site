// app/api/user/opportunities/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { getUserOpportunities } from "@/lib/opportunities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized", opportunities: [] },
        { status: 401 }
      );
    }

    const userId = Number(session.user.id ?? session.user.uid);
    const role = String(session.user.role ?? "").toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Invalid session user", opportunities: [] },
        { status: 400 }
      );
    }

    const opportunities = await getUserOpportunities(userId, role);

    return NextResponse.json({
      ok: true,
      opportunities,
    });
  } catch (error: any) {
    console.error("GET /api/user/opportunities failed:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Failed to load opportunities",
        opportunities: [],
      },
      { status: 500 }
    );
  }
}