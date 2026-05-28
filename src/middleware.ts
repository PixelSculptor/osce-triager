import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "@/modules/auth/auth.config"

const { auth } = NextAuth(authConfig)

const PUBLIC_PATHS = ["/", "/api/auth"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  )

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL("/", req.url))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
