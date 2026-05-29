import { NextRequest, NextResponse } from "next/server"
import { registerUser } from "@/modules/auth/user.util"

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { email, password } = body as { email?: string; password?: string }

  try {
    const user = await registerUser(email ?? "", password ?? "")
    return NextResponse.json({ user }, { status: 201 })
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "EMAIL_TAKEN") {
        return NextResponse.json({ error: "User already exists" }, { status: 409 })
      }
      if (e.message === "INVALID_INPUT") {
        return NextResponse.json(
          { error: "Email and password are required" },
          { status: 400 }
        )
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
