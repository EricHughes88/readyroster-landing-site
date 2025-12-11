// middleware.ts
import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";

// This middleware will only run on the paths defined in `config.matcher` below.
// Everything else (like "/", "/login", "/signup", etc.) is public.

export default withAuth(
  function middleware(_req: NextRequest) {
    // You can add role-based checks here later if you want.
    // For now, just having a valid session is enough.
  },
  {
    pages: {
      signIn: "/login", // where to send unauthenticated users
    },
  }
);

export const config = {
  matcher: [
    "/parent/:path*",
    "/coach/:path*",
    "/athlete/:path*",
    "/matches/:path*",
    "/messages/:path*",
    "/teams/:path*",
  ],
};
