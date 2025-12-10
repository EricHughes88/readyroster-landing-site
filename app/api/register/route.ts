// app/api/register/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import pg from "pg";
const { Pool } = pg;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "Parent" | "Coach";

/** Zod: define enum without options (compatible across versions) */
const RoleEnum = z.enum(["Parent", "Coach"]);

const RegisterSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: RoleEnum,
});

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    // Dev fallback when no DB is configured
    if (!pool) {
      return NextResponse.json(
        {
          ok: true,
          user: {
            id: 1,
            name,
            email,
            role,
            created_at: new Date().toISOString(),
          },
          note: "No DATABASE_URL set—user not persisted.",
        },
        { status: 201 }
      );
    }

    const client = await pool.connect();
    try {
      // Unique email check (no id assumption)
      const exists = await client.query(
        "SELECT 1 FROM public.users WHERE email = $1 LIMIT 1",
        [email]
      );
      if ((exists.rowCount ?? 0) > 0) {
        return NextResponse.json(
          { ok: false, message: "Email already in use" },
          { status: 409 }
        );
      }

      // Does 'role' column exist? (rowCount can be number | null → guard it)
      const roleCol = await client.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'role'`
      );
      const hasRoleCol =
        (roleCol.rowCount ?? roleCol.rows?.length ?? 0) > 0;

      let userRow: any;
      if (hasRoleCol) {
        const res = await client.query(
          `INSERT INTO public.users (name, email, password_hash, role)
           VALUES ($1, $2, $3, $4)
           RETURNING COALESCE(id, user_id) AS id, name, email, role, created_at`,
          [name, email, passwordHash, role]
        );
        userRow = res.rows[0];
      } else {
        const res = await client.query(
          `INSERT INTO public.users (name, email, password_hash)
           VALUES ($1, $2, $3)
           RETURNING COALESCE(id, user_id) AS id, name, email, created_at`,
          [name, email, passwordHash]
        );
        userRow = { ...res.rows[0], role };
      }

      return NextResponse.json({ ok: true, user: userRow }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Register POST error:", err);
    return NextResponse.json(
      { ok: false, message: "Server error" },
      { status: 500 }
    );
  }
}
