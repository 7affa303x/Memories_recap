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
  const ref = request.nextUrl.searchParams.get("ref");

  let response: NextResponse;

  if (
    !ALLOWED_HOSTS.has(host) &&
    host.endsWith(".vercel.app") &&
    host.startsWith("memories-recap-")
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    url.port = "";
    response = NextResponse.redirect(url, 308);
  } else {
    response = NextResponse.next();
  }

  // Persist invite ref for Google OAuth round-trip
  if (ref && /^[a-zA-Z0-9_-]{6,128}$/.test(ref)) {
    response.cookies.set("mr_ref", ref, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
