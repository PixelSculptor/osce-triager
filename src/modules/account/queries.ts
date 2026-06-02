import "server-only"

import { db } from "@/shared/lib/db"

export async function getAccountSettings(userId: string) {
  return db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      deletionRequestedAt: true,
    },
  })
}
