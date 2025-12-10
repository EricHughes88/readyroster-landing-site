// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
// use named import ⬇️
import { authOptions } from "../../../../auth.config";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
