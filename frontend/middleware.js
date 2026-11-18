import { NextResponse } from "next/server";

function normalizeRole(role) {
  const clean = (role || "").trim().toLowerCase();
  if (clean === "user") return "customer";
  return clean;
}

function redirectTo(request, targetPath) {
  const url = request.nextUrl.clone();
  url.pathname = targetPath;
  url.search = "";
  return NextResponse.redirect(url);
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const rawRole = request.cookies.get("auth_role")?.value || "";
  const token = request.cookies.get("auth_token")?.value || "";
  const role = token ? normalizeRole(rawRole) : "";

  // 1. /admin/* routes: Admin only
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (role === "admin") return NextResponse.next();
    if (role === "agent") return redirectTo(request, "/agent");
    if (role === "customer") return redirectTo(request, "/my-tickets");
    return redirectTo(request, "/login");
  }

  // 2. /agent/* routes: Agent & Admin only
  if (pathname === "/agent" || pathname.startsWith("/agent/")) {
    if (role === "agent" || role === "admin") return NextResponse.next();
    if (role === "customer") return redirectTo(request, "/my-tickets");
    return redirectTo(request, "/login");
  }

  // 3. /my-tickets and /submit: Customer only (staff redirect to their workspaces)
  if (
    pathname === "/my-tickets" ||
    pathname.startsWith("/my-tickets/") ||
    pathname === "/submit" ||
    pathname.startsWith("/submit/")
  ) {
    if (role === "customer") return NextResponse.next();
    if (role === "agent") return redirectTo(request, "/agent");
    if (role === "admin") return redirectTo(request, "/admin/dashboard");
    return redirectTo(request, "/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/agent/:path*", "/my-tickets/:path*", "/submit/:path*"],
};
