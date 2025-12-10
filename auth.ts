// auth.ts
import NextAuth, { getServerSession } from "next-auth";
import { authOptions } from "./auth.config";

// Route handlers for /api/auth/[...nextauth]
const handlers = NextAuth(authOptions);
export { handlers as GET, handlers as POST };

// Helper you can use in Server Components / route handlers
export const auth = () => getServerSession(authOptions);
