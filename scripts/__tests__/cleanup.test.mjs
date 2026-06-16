import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import postgres from 'postgres'
import { runCleanup } from '../cleanup-expired-accounts.mjs'

describe('runCleanup — hermetic', () => {
  it('returns correct counts and logs when users are deleted', async () => {
    const sql = vi.fn().mockResolvedValue([{ users_deleted: 2, tokens_deleted: 1 }])
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await runCleanup(sql)

    expect(result).toEqual({ usersDeleted: 2, tokensDeleted: 1 })
    expect(consoleSpy).toHaveBeenCalledWith(
      'Deleted 2 expired account(s), 1 verification token(s) cleaned'
    )
    consoleSpy.mockRestore()
  })

  it('returns zero counts when nothing is deleted', async () => {
    const sql = vi.fn().mockResolvedValue([{ users_deleted: 0, tokens_deleted: 0 }])
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await runCleanup(sql)

    expect(result).toEqual({ usersDeleted: 0, tokensDeleted: 0 })
    vi.restoreAllMocks()
  })

  it('propagates error thrown by sql', async () => {
    const sql = vi.fn().mockRejectedValue(new Error('DB error'))

    await expect(runCleanup(sql)).rejects.toThrow('DB error')
  })
})

// --- Integration tests ---

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST

describe.skipIf(!DATABASE_URL_TEST)('runCleanup — integration', () => {
  let sql
  const ts = Date.now()

  beforeAll(() => {
    sql = postgres(DATABASE_URL_TEST, { prepare: false })
  })

  afterAll(async () => {
    await sql.end()
  })

  afterEach(async () => {
    const s = String(ts)
    // Reverse FK order: deepest dependents first
    await sql`DELETE FROM "session_event" WHERE id = ${'test-rodo-se-' + s}`
    await sql`DELETE FROM "session_result" WHERE id = ${'test-rodo-sr-' + s}`
    await sql`DELETE FROM "session" WHERE "sessionToken" = ${'test-rodo-ss-' + s}`
    await sql`DELETE FROM "account" WHERE "providerAccountId" = ${'test-rodo-u3-' + s}`
    await sql`DELETE FROM "verificationToken" WHERE identifier = ${'test-rodo-4-' + s + '@test.local'}`
    for (const n of [1, 2, 3, 4, 5]) {
      await sql`DELETE FROM "user" WHERE id = ${'test-rodo-u' + n + '-' + s}`
    }
    await sql`DELETE FROM "diagnostic_test" WHERE id = ${'test-rodo-dt-' + s}`
    await sql`DELETE FROM "scenario" WHERE id = ${'test-rodo-sc-' + s}`
  })

  it('deletes user with deletion_requested_at 31 days ago', async () => {
    const userId = `test-rodo-u1-${ts}`
    const email = `test-rodo-1-${ts}@test.local`

    await sql`
      INSERT INTO "user" (id, email, deletion_requested_at)
      VALUES (${userId}, ${email}, NOW() - INTERVAL '31 days')
    `

    const result = await runCleanup(sql)

    expect(result).toEqual({ usersDeleted: 1, tokensDeleted: 0 })
    const rows = await sql`SELECT id FROM "user" WHERE id = ${userId}`
    expect(rows).toHaveLength(0)
  })

  it('preserves user with deletion_requested_at 1 day ago', async () => {
    const userId = `test-rodo-u2-${ts}`
    const email = `test-rodo-2-${ts}@test.local`

    await sql`
      INSERT INTO "user" (id, email, deletion_requested_at)
      VALUES (${userId}, ${email}, NOW() - INTERVAL '1 day')
    `

    const result = await runCleanup(sql)

    expect(result).toEqual({ usersDeleted: 0, tokensDeleted: 0 })
    const rows = await sql`SELECT id FROM "user" WHERE id = ${userId}`
    expect(rows).toHaveLength(1)
  })

  it('cascades delete across account, session, session_result, session_event', async () => {
    const userId = `test-rodo-u3-${ts}`
    const scenarioId = `test-rodo-sc-${ts}`
    const testId = `test-rodo-dt-${ts}`
    const sessionResultId = `test-rodo-sr-${ts}`
    const sessionEventId = `test-rodo-se-${ts}`
    const sessionToken = `test-rodo-ss-${ts}`

    await sql`INSERT INTO "scenario" (id, title, description, time_limit_seconds)
      VALUES (${scenarioId}, 'RODO Test Scenario', 'Integration test', 300)`
    await sql`INSERT INTO "diagnostic_test" (id, name)
      VALUES (${testId}, ${'rodo-test-name-' + ts})`
    await sql`INSERT INTO "user" (id, email, deletion_requested_at)
      VALUES (${userId}, ${'test-rodo-3-' + ts + '@test.local'}, NOW() - INTERVAL '31 days')`
    await sql`INSERT INTO "account" ("userId", type, provider, "providerAccountId")
      VALUES (${userId}, 'credentials', 'test', ${userId})`
    await sql`INSERT INTO "session" ("sessionToken", "userId", expires)
      VALUES (${sessionToken}, ${userId}, NOW() + INTERVAL '1 day')`
    await sql`INSERT INTO "session_result" (id, user_id, scenario_id)
      VALUES (${sessionResultId}, ${userId}, ${scenarioId})`
    await sql`INSERT INTO "session_event" (id, session_id, test_id, validator_result)
      VALUES (${sessionEventId}, ${sessionResultId}, ${testId}, 'correct')`

    await runCleanup(sql)

    const accounts = await sql`SELECT * FROM "account" WHERE "userId" = ${userId}`
    const sessions = await sql`SELECT * FROM "session" WHERE "userId" = ${userId}`
    const results = await sql`SELECT * FROM "session_result" WHERE id = ${sessionResultId}`
    const events = await sql`SELECT * FROM "session_event" WHERE id = ${sessionEventId}`

    expect(accounts).toHaveLength(0)
    expect(sessions).toHaveLength(0)
    expect(results).toHaveLength(0)
    expect(events).toHaveLength(0)
  })

  it('deletes verificationToken matching deleted user email', async () => {
    const userId = `test-rodo-u4-${ts}`
    const email = `test-rodo-4-${ts}@test.local`

    await sql`INSERT INTO "user" (id, email, deletion_requested_at)
      VALUES (${userId}, ${email}, NOW() - INTERVAL '31 days')`
    await sql`INSERT INTO "verificationToken" (identifier, token, expires)
      VALUES (${email}, ${'tok-' + ts}, NOW() + INTERVAL '1 day')`

    const result = await runCleanup(sql)

    expect(result).toEqual({ usersDeleted: 1, tokensDeleted: 1 })
    const tokens = await sql`SELECT * FROM "verificationToken" WHERE identifier = ${email}`
    expect(tokens).toHaveLength(0)
  })

  it('preserves user with NULL deletion_requested_at', async () => {
    const userId = `test-rodo-u5-${ts}`
    const email = `test-rodo-5-${ts}@test.local`

    await sql`INSERT INTO "user" (id, email) VALUES (${userId}, ${email})`

    const result = await runCleanup(sql)

    expect(result).toEqual({ usersDeleted: 0, tokensDeleted: 0 })
    const rows = await sql`SELECT id FROM "user" WHERE id = ${userId}`
    expect(rows).toHaveLength(1)
  })
})
