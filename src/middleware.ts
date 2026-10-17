import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight edge gate. With `session.strategy = "database"` the session can only be
 * validated against Postgres, which we don't do at the edge. Here we only check that an
 * Auth.js session cookie exists; real validation happens server-side via
 * `requireUser()` / `requireHousehold()` (src/lib/auth-helpers.ts).
 *
 * Public: /signin, /invite/*, /api/auth/*, Next internals and static files (see matcher).
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

const PUBLIC_PATHS = [/^\/signin(\/|$)/, /^\/invite(\/|$)/, /^\/api\/auth(\/|$)/];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PATHS.some((re) => re.test(pathname))) return NextResponse.next();

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (hasSession) return NextResponse.next();

  // API clients get a 401 instead of an HTML redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.search = "";
  url.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except Next internals and files with an extension (static assets).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest|js|css|map)$).*)",
  ],
};
