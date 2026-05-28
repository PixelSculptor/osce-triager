import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/shared/lib/db"
import { users } from "@/shared/lib/schema"

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { email, password } = body as { email?: string; password?: string }

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    )
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (existing) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const [user] = await db
    .insert(users)
    .values({ email, hashedPassword })
    .returning({ id: users.id, email: users.email })

  return NextResponse.json({ user }, { status: 201 })
}
