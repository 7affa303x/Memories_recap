import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST = "memories-recap-one.vercel.app";

/** Team/project aliases that may stay; deployment URLs must redirect. */
const ALLOWED_HOSTS = new Set([
  CANONICAL_HOST,
  "memories-recap-algeria1.vercel.app",
  "memories-recap-hafid303x-algeria1.vercel.app",
  "localhost:3000",
  "127.0.0.1:3000",
]);

/**
 * Auth.js stores PKCE cookies on the request host. Google redirects to AUTH_URL
 * (canonical). If sign-in starts on a deploy URL, callback loses the cookie →
 * InvalidCheck. Always bounce deploy hosts to the production alias.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  if (ALLOWED_HOSTS.has(host)) {
    return NextResponse.next();
  }

  // e.g. memories-recap-g8npj8nhk-algeria1.vercel.app
  if (
    host.endsWith(".vercel.app") &&
    host.startsWith("memories-recap-")
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
