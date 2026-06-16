import postgres from "postgres"
import { fileURLToPath } from "url"
import path from "path"

export async function runCleanup(sql) {
  const result = await sql`
    WITH deleted_users AS (
      DELETE FROM "user"
      WHERE deletion_requested_at IS NOT NULL
        AND deletion_requested_at < NOW() - INTERVAL '30 days'
      RETURNING id, email
    ),
    deleted_tokens AS (
      DELETE FROM "verificationToken"
      WHERE identifier IN (SELECT email FROM deleted_users)
      RETURNING identifier
    )
    SELECT
      (SELECT count(*)::int FROM deleted_users) AS users_deleted,
      (SELECT count(*)::int FROM deleted_tokens) AS tokens_deleted
  `
  const { users_deleted, tokens_deleted } = result[0]
  console.log(
    `Deleted ${users_deleted} expired account(s), ${tokens_deleted} verification token(s) cleaned`
  )
  return { usersDeleted: users_deleted, tokensDeleted: tokens_deleted }
}

const isMain =
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isMain) {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error("Error: DATABASE_URL environment variable is required")
    process.exit(1)
  }
  const sql = postgres(DATABASE_URL, { prepare: false })
  try {
    await runCleanup(sql)
  } catch (err) {
    console.error("Error deleting expired accounts:", err)
    process.exit(1)
  } finally {
    await sql.end()
  }
}
