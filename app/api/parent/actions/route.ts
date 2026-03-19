// app/api/parent/actions/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { getParentRecommendedActions } from "@/lib/parentActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized", actions: [] },
        { status: 401 }
      );
    }

    const userId = Number(session.user.id ?? session.user.uid);
    const role = String(session.user.role ?? "").toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Invalid session user", actions: [] },
        { status: 400 }
      );
    }

    if (role !== "parent") {
      return NextResponse.json(
        { ok: false, message: "Forbidden", actions: [] },
        { status: 403 }
      );
    }

    const actions = await getParentRecommendedActions(userId);

    return NextResponse.json({
      ok: true,
      actions,
    });
  } catch (error: any) {
    console.error("GET /api/parent/actions failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "Failed to load parent actions",
        actions: [],
      },
      { status: 500 }
    );
  }
}