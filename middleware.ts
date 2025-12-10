// middleware.ts  (TEMP: no auth logic at all)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // Allow everything through; no redirects here.
  return NextResponse.next();
}

export const config = {
  matcher: [],  // middleware doesn't run for any routes now
};
