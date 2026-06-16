import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import { eq } from 'drizzle-orm';

// Hoisted — applies before selectTestAction and db are imported
vi.mock('@/modules/auth/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
}));

import { auth } from '@/modules/auth/auth';
import {
  selectTestAction,
  endSessionAction,
  deleteSessionAction,
} from '@/modules/session/actions';
import { db } from '@/shared/lib/db';
import {
  users,
  scenarios,
  diagnosticTests,
  testClassifications,
  sessionResults,
  sessionEvents,
} from '@/shared/lib/schema';

// Skip the entire suite when no test DB is configured.
// Run with DATABASE_URL_TEST=<url> (see .env.test.example) and apply the
// schema first: DATABASE_URL=<test-url> npx drizzle-kit push
const runIntegration = !!process.env.DATABASE_URL_TEST;

describe.skipIf(!runIntegration)('selectTestAction integration', () => {
  beforeAll(async () => {
    // Insert FK parents before dependents
    await db.insert(users).values({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@integration.local',
    });
    await db.insert(scenarios).values({
      id: 'test-s1',
      title: 'Test Scenario',
      description: 'Integration test scenario',
      timeLimitSeconds: 300,
    });
    await db.insert(diagnosticTests).values({
      id: 'test-dt-001',
      name: 'Test EKG (integration)',
    });
    await db.insert(testClassifications).values({
      scenarioId: 'test-s1',
      testId: 'test-dt-001',
      classification: 'critical',
    });
    await db.insert(sessionResults).values({
      id: 'test-session-1',
      userId: 'test-user-id',
      scenarioId: 'test-s1',
    });
  });

  afterAll(async () => {
    // Delete in reverse FK order
    await db
      .delete(sessionEvents)
      .where(eq(sessionEvents.sessionId, 'test-session-1'));
    await db
      .delete(sessionResults)
      .where(eq(sessionResults.id, 'test-session-1'));
    await db
      .delete(testClassifications)
      .where(eq(testClassifications.scenarioId, 'test-s1'));
    await db
      .delete(diagnosticTests)
      .where(eq(diagnosticTests.id, 'test-dt-001'));
    await db.delete(scenarios).where(eq(scenarios.id, 'test-s1'));
    await db.delete(users).where(eq(users.id, 'test-user-id'));
  });

  it('critical test returns correct when classifications load successfully', async () => {
    const result = await selectTestAction('test-session-1', 'test-dt-001');
    expect(result).toEqual({
      validatorResult: 'correct',
      category: 'critical',
    });
  });

  it('unknown test id returns error — guard at actions.ts:92 fires, not silent unnecessary', async () => {
    const result = await selectTestAction('test-session-1', 'dt-999');
    expect(result).toEqual({ error: 'Test not in scenario' });
  });
});

// ---------------------------------------------------------------------------
// Hermetic: Write 2 partial failure in endSessionAction
// Uses vi.spyOn on db so the real DB (used above) is unaffected.
// ---------------------------------------------------------------------------

describe('endSessionAction — Write 2 partial failure (hermetic)', () => {
  const sessionRow = {
    id: 'test-session-id',
    userId: 'test-user-id',
    scenarioId: 'test-scenario',
    outcome: 'in_progress',
    isFailed: false,
    startedAt: new Date('2024-01-01'),
    completedAt: null,
  };
  const claimedRow = {
    ...sessionRow,
    outcome: 'negative',
    isFailed: true,
    completedAt: new Date('2024-01-01'),
  };
  const classificationRow = {
    testId: 'dt-critical',
    scenarioId: 'test-scenario',
    classification: 'critical',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSelectChain(value: unknown[]): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      orderBy: () => chain,
      then(
        onFulfilled: (v: unknown) => unknown,
        onRejected: (e: unknown) => unknown,
      ) {
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    };
    return chain;
  }

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(db as any, 'select')
      .mockImplementationOnce(() => makeSelectChain([sessionRow])) // Select 1: sessionResults
      .mockImplementationOnce(() => makeSelectChain([])) // Select 2: sessionEvents (no selections)
      .mockImplementationOnce(() => makeSelectChain([classificationRow])); // Select 3: testClassifications

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(db as any, 'update').mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        set: () => chain,
        where: () => chain,
        returning: vi.fn().mockResolvedValue([claimedRow]),
      };
      return chain;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(db as any, 'insert').mockImplementation(() => ({
      values: vi.fn().mockRejectedValue(new Error('DB timeout')),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { error: "Internal error" } and logs when Write 2 fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await endSessionAction('test-session-id');

    expect(result).toEqual({ error: 'Internal error' });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[endSessionAction] DB error:'),
      expect.any(Error),
    );
  });
});

// ---------------------------------------------------------------------------
// R-DEL-05 — Unauthorized (hermetic)
// ---------------------------------------------------------------------------

describe('deleteSessionAction — R-DEL-05 Unauthorized (hermetic)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('R-DEL-05: returns Unauthorized when auth returns null', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const result = await deleteSessionAction('any-id');
    expect(result).toEqual({ error: 'Unauthorized' });
  });
});

// ---------------------------------------------------------------------------
// R-DEL-04 — in_progress blocked (integration)
// ---------------------------------------------------------------------------

describe.skipIf(!runIntegration)(
  'deleteSessionAction — R-DEL-04 in_progress blocked (integration)',
  () => {
    const DEL_ACT_USER = 'del-act-user';
    const DEL_ACT_SCENARIO = 'del-act-scenario';
    const DEL_ACT_SESSION = 'del-act-session';

    beforeAll(async () => {
      await db
        .insert(users)
        .values({ id: DEL_ACT_USER, email: 'del-act@integration.local' });
      await db.insert(scenarios).values({
        id: DEL_ACT_SCENARIO,
        title: 'Delete Action Test Scenario',
        description:
          'Integration fixture for deleteSessionAction in_progress guard',
        timeLimitSeconds: 300,
      });
      await db.insert(sessionResults).values({
        id: DEL_ACT_SESSION,
        userId: DEL_ACT_USER,
        scenarioId: DEL_ACT_SCENARIO,
        outcome: 'in_progress',
      });
    });

    afterAll(async () => {
      await db
        .delete(sessionResults)
        .where(eq(sessionResults.id, DEL_ACT_SESSION));
      await db.delete(scenarios).where(eq(scenarios.id, DEL_ACT_SCENARIO));
      await db.delete(users).where(eq(users.id, DEL_ACT_USER));
    });

    it('R-DEL-04: blocks deletion of in_progress session, session still exists', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: DEL_ACT_USER },
      } as Awaited<ReturnType<typeof auth>>);
      const result = await deleteSessionAction(DEL_ACT_SESSION);
      expect(result).toEqual({ error: 'Cannot delete an active session' });

      const [session] = await db
        .select()
        .from(sessionResults)
        .where(eq(sessionResults.id, DEL_ACT_SESSION))
        .limit(1);
      expect(session).toBeDefined();
    });
  },
);
