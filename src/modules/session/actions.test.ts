import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'

// Hoisted — applies before selectTestAction and db are imported
vi.mock('@/modules/auth/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
}))

import { selectTestAction } from '@/modules/session/actions'
import { db } from '@/shared/lib/db'
import {
  users,
  scenarios,
  diagnosticTests,
  testClassifications,
  sessionResults,
  sessionEvents,
} from '@/shared/lib/schema'

// Skip the entire suite when no test DB is configured.
// Run with DATABASE_URL_TEST=<url> (see .env.test.example) and apply the
// schema first: DATABASE_URL=<test-url> npx drizzle-kit push
const runIntegration = !!process.env.DATABASE_URL_TEST

describe.skipIf(!runIntegration)('selectTestAction integration', () => {
  beforeAll(async () => {
    // Insert FK parents before dependents
    await db.insert(users).values({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@integration.local',
    })
    await db.insert(scenarios).values({
      id: 'test-s1',
      title: 'Test Scenario',
      description: 'Integration test scenario',
      timeLimitSeconds: 300,
    })
    await db.insert(diagnosticTests).values({
      id: 'test-dt-001',
      name: 'Test EKG (integration)',
    })
    await db.insert(testClassifications).values({
      scenarioId: 'test-s1',
      testId: 'test-dt-001',
      classification: 'critical',
    })
    await db.insert(sessionResults).values({
      id: 'test-session-1',
      userId: 'test-user-id',
      scenarioId: 'test-s1',
    })
  })

  afterAll(async () => {
    // Delete in reverse FK order
    await db.delete(sessionEvents).where(eq(sessionEvents.sessionId, 'test-session-1'))
    await db.delete(sessionResults).where(eq(sessionResults.id, 'test-session-1'))
    await db.delete(testClassifications).where(eq(testClassifications.scenarioId, 'test-s1'))
    await db.delete(diagnosticTests).where(eq(diagnosticTests.id, 'test-dt-001'))
    await db.delete(scenarios).where(eq(scenarios.id, 'test-s1'))
    await db.delete(users).where(eq(users.id, 'test-user-id'))
  })

  it('critical test returns correct when classifications load successfully', async () => {
    const result = await selectTestAction('test-session-1', 'test-dt-001')
    expect(result).toEqual({ validatorResult: 'correct', category: 'critical' })
  })

  it('unknown test id returns error — guard at actions.ts:92 fires, not silent unnecessary', async () => {
    const result = await selectTestAction('test-session-1', 'dt-999')
    expect(result).toEqual({ error: 'Test not in scenario' })
  })
})
