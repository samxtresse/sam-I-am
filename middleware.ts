import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

// Gates every /secretary route except /secretary/setup and the auth callbacks.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isUnlocked = req.cookies.get(SESSION_COOKIE_NAME)?.value === "1";

  // Setup page + auth endpoints must remain reachable so the user can unlock.
  const isOpenPath =
    pathname === "/secretary/setup" ||
    pathname.startsWith("/api/secretary/auth/") ||
    pathname.startsWith("/api/secretary/cron/") ||
    pathname.startsWith("/api/secretary/slack/") ||
    pathname.startsWith("/api/secretary/twilio/");

  if (isOpenPath) return NextResponse.next();

  if (!isUnlocked) {
    const url = req.nextUrl.clone();
    url.pathname = "/secretary/setup";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/secretary/:path*", "/api/secretary/:path*"],
};
