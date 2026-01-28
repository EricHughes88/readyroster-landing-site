// app/api/test-notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { notifyUser } from "./notifyUser";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const userId = Number(data.userId || 0);
    const type = (data.type || "system") as "match" | "message" | "system";
    const title = String(data.title || "").trim();
    const body = String(data.body || "").trim();
    const link = data.link ? String(data.link) : undefined;
    const push = Boolean(data.push);

    if (!userId || !title || !body) {
      return jsonError("Missing required fields: userId, title, body", 400);
    }

    await notifyUser({ userId, type, title, body, link, push });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return jsonError(err?.message || "Failed to send test notification", 500, err);
  }
}
