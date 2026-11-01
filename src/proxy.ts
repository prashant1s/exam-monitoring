import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Keep route checks lightweight. Full authorization still happens in the
// server-side handlers that read or mutate protected data.
const { auth } = NextAuth(authConfig);

const ROLE_PREFIXES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/proctor", roles: ["PROCTOR", "ADMIN"] },
  { prefix: "/student", roles: ["STUDENT"] },
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const match = ROLE_PREFIXES.find((route) =>
    pathname.startsWith(route.prefix),
  );
  if (!match) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  if (!match.roles.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/proctor/:path*", "/student/:path*"],
};
