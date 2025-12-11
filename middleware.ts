// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";

/**
 * Routes that require a logged-in user.
 * Everything else (including "/") is public.
 */
const PROTECTED_PREFIXES = [
  "/parent",
  "/coach",
  "/athlete",
  "/matches",
  "/messages",
  "/teams",
];

const PUBLIC_PATHS = [
  "/",                 // marketing homepage
  "/login",
  "/create-account",
  "/signup",
  "/signup/coach",
  "/signup/parent",
  "/signup/athlete",
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Skip static / system / api routes
  if (
    pathname.startsWith("/api") ||         // API is handled separately
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // 2) Always allow public paths (including homepage)
  if (
    PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
  ) {
    return NextResponse.next();
  }

  // 3) Only protect the “app” sections
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtected) {
    // Not in a protected area → just let it through
    return NextResponse.next();
  }

  // 4) For protected routes, require auth
  const session = await auth();
  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname); // so we can redirect back later
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all non-static routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
