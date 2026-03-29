// middleware.ts
import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";

function getSuperEmails() {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isSuperPath(pathname: string) {
  // NOTE: route groups like (super) do NOT appear in the URL
  return (
    pathname === "/admin/admins" ||
    pathname.startsWith("/admin/admins/") ||
    pathname === "/admin/activity" ||
    pathname.startsWith("/admin/activity/")
  );
}

export default withAuth(
  function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;

    // Token was already validated by withAuth; this is role gating
    const token: any = (req as any).nextauth?.token;

    // If token is missing for any reason, withAuth will redirect to signIn
    const role = String(token?.role ?? "").trim();
    const email = String(token?.email ?? "").trim().toLowerCase();

    // Admin area requires Admin or Super Admin role in the session token
    if (pathname.startsWith("/admin")) {
      const isAdmin = role === "Admin" || role === "Super Admin";

      if (!isAdmin) {
        // send to your existing denied page (or change if you use a different route)
        const url = req.nextUrl.clone();
        url.pathname = "/denied";
        url.searchParams.set("from", pathname);
        return Response.redirect(url);
      }

      // Super-only routes require allowlist email
      if (isSuperPath(pathname)) {
        const supers = getSuperEmails();
        const isSuper = !!email && supers.includes(email);

        if (!isSuper) {
          const url = req.nextUrl.clone();
          url.pathname = "/denied";
          url.searchParams.set("from", pathname);
          return Response.redirect(url);
        }
      }
    }

    // Otherwise let it through
  },
  {
    pages: {
      signIn: "/login",
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
    "/admin/:path*", // ✅ protect admin routes too
  ],
};