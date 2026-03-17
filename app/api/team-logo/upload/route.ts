// app/api/team-logo/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    const userId = Number(session.user?.id ?? session.user?.uid ?? 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid user" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = sanitizeFileName(file.name || "logo.png");
    const filePath = `coach-${userId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("team-logos")
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, message: uploadError.message },
        { status: 500 }
      );
    }

    const { data } = supabaseAdmin.storage
      .from("team-logos")
      .getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      path: filePath,
      publicUrl: data.publicUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}