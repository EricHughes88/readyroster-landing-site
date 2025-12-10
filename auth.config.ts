// auth.config.ts
import type { NextAuthOptions, User, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import pg from "pg";

type RRRole = "Coach" | "Parent" | "Athlete" | "Admin";

// ---- PG pool singleton (avoids many pools during dev HMR) ----
declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}
const { Pool } = pg;

function getPool(): pg.Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;
  if (!global.__RR_PG_POOL__) {
    global.__RR_PG_POOL__ = new Pool({ connectionString: conn });
  }
  return global.__RR_PG_POOL__;
}

function normalizeRole(raw: unknown): RRRole {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "coach") return "Coach";
  if (v === "athlete") return "Athlete";
  if (v === "admin") return "Admin";
  return "Parent";
}

// Main NextAuth options object
export const authOptions: NextAuthOptions = {
  debug: process.env.AUTH_DEBUG === "true",
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds): Promise<User | null> {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const pool = getPool();
        if (!pool) {
          console.error("[auth.authorize] DATABASE_URL not set");
          return null;
        }

        try {
          const { rows } = await pool.query(
            `
              SELECT id, email, password_hash, role, firstname, lastname, name
              FROM public.users
              WHERE LOWER(email) = LOWER($1)
              LIMIT 1
            `,
            [email]
          );

          const u = rows?.[0];
          if (!u?.password_hash) return null;

          const ok = await bcrypt.compare(password, String(u.password_hash));
          if (!ok) return null;

          const built = [u.firstname, u.lastname].filter(Boolean).join(" ").trim();
          const niceName = u.name ?? (built || null);
          const role = normalizeRole(u.role);

          const out: User & { role?: RRRole } = {
            id: String(u.id),
            email: u.email,
            name: niceName,
            role,
          };
          return out;
        } catch (err) {
          console.error("[auth.authorize] error", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User | null }) {
      if (user) {
        (token as any).uid = String((user as any).id ?? "");
        (token as any).role = (user as any).role ?? "Parent";
        token.name = user.name ?? null;
        token.email = user.email ?? null;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.user = {
        id: String((token as any)?.uid ?? ""),
        role: ((token as any)?.role as RRRole) ?? "Parent",
        name: token?.name ?? null,
        email: token?.email ?? null,
      } as User & { role?: RRRole };
      return session;
    },
  },
};

// Alias so you can `import { authConfig }` or default-import it
export const authConfig: NextAuthOptions = authOptions;
export default authConfig;
