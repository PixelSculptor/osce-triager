import "server-only"

import { db } from "@/shared/lib/db"
import { scenarios } from "@/shared/lib/schema"

export async function getScenarios() {
  return db.select().from(scenarios).orderBy(scenarios.createdAt)
}
