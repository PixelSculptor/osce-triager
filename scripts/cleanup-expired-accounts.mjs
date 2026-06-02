import postgres from "postgres"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is required")
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { prepare: false })

try {
  const result = await sql`
    DELETE FROM "user"
    WHERE deletion_requested_at IS NOT NULL
      AND deletion_requested_at < NOW() - INTERVAL '30 days'
    RETURNING id
  `
  console.log(`Deleted ${result.length} expired account(s)`)
} catch (err) {
  console.error("Error deleting expired accounts:", err)
  process.exit(1)
} finally {
  await sql.end()
}
