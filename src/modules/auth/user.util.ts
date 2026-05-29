import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { db } from "@/shared/lib/db"
import { users } from "@/shared/lib/schema"

export async function registerUser(
  email: string,
  password: string
): Promise<{ id: string; email: string }> {
  if (!email || !password) {
    throw new Error("INVALID_INPUT")
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (existing) {
    throw new Error("EMAIL_TAKEN")
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const [user] = await db
    .insert(users)
    .values({ email, hashedPassword })
    .returning({ id: users.id, email: users.email })

  return { id: user.id, email: user.email ?? email }
}
