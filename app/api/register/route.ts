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

  // ✅ NEW
  phone: z.string().trim().optional().nullable(),
});

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

function splitName(full: string) {
  const cleaned = (full || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return { firstname: "", lastname: "" };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstname: parts[0], lastname: "" };
  return {
    firstname: parts.slice(0, -1).join(" "),
    lastname: parts.slice(-1)[0],
  };
}

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

    const { name, email, password, role, phone } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    const { firstname, lastname } = splitName(name);
    const phoneNorm =
      phone && phone.trim().length > 0 ? phone.trim() : null;

    // Dev fallback when no DB is configured
    if (!pool) {
      return NextResponse.json(
        {
          ok: true,
          user: {
            id: 1,
            name,
            firstname,
            lastname,
            email,
            phone: phoneNorm,
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

      // Check which columns exist (role, phone, firstname/lastname, name)
      const cols = await client.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name IN ('role','phone','firstname','lastname','name')`
      );

      const set = new Set((cols.rows || []).map((r: any) => r.column_name));

      const hasRoleCol = set.has("role");
      const hasPhoneCol = set.has("phone");
      const hasFirst = set.has("firstname");
      const hasLast = set.has("lastname");
      const hasName = set.has("name");

      // Build INSERT dynamically to match your actual schema safely
      const fields: string[] = [];
      const values: any[] = [];
      const placeholders: string[] = [];

      const push = (field: string, value: any) => {
        fields.push(field);
        values.push(value);
        placeholders.push(`$${values.length}`);
      };

      // Prefer firstname/lastname if they exist
      if (hasFirst) push("firstname", firstname || null);
      if (hasLast) push("lastname", lastname || null);

      // Keep "name" too if you have it (helps old UI code)
      if (hasName) push("name", name);

      push("email", email);
      push("password_hash", passwordHash);

      if (hasRoleCol) push("role", role);
      if (hasPhoneCol) push("phone", phoneNorm);

      const sql = `
        INSERT INTO public.users (${fields.join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING
          COALESCE(id, user_id) AS id,
          ${hasName ? "name," : ""}
          ${hasFirst ? "firstname," : ""}
          ${hasLast ? "lastname," : ""}
          email
          ${hasRoleCol ? ", role" : ""}
          ${hasPhoneCol ? ", phone" : ""}
          , created_at
      `;

      const res = await client.query(sql, values);
      const userRow = res.rows[0];

      // If role column didn't exist, still return role for your UI
      if (!hasRoleCol) userRow.role = role;

      // If name wasn't returned, create it for compatibility
      if (!hasName) userRow.name = name;

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