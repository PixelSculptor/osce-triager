import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/shared/lib/db';
import {
  users,
  scenarios,
  sessionResults,
  sessionEvents,
  diagnosticTests,
} from '@/shared/lib/schema';
import {
  getSessionById,
  getSessionEvents,
  deleteSessionById,
} from '@/modules/session/queries';

// Outside a request context (Node) getDb() returns a fresh client; one client
// for the whole suite is enough for setup/cleanup against local Postgres.
const db = getDb();

const runIntegration = !!process.env.DATABASE_URL_TEST;

describe.skipIf(!runIntegration)(
  'getSessionById / getSessionEvents — isolation IDOR',
  () => {
    beforeAll(async () => {
      await db.insert(users).values([
        { id: 'idor-user-a', email: 'idor-a@integration.local' },
        { id: 'idor-user-b', email: 'idor-b@integration.local' },
      ]);
      await db.insert(scenarios).values({
        id: 'idor-scenario',
        title: 'IDOR Test Scenario',
        description: 'Integration fixture for IDOR isolation test',
        timeLimitSeconds: 300,
      });
      await db.insert(sessionResults).values({
        id: 'idor-session',
        userId: 'idor-user-a',
        scenarioId: 'idor-scenario',
      });
    });

    afterAll(async () => {
      await db
        .delete(sessionResults)
        .where(eq(sessionResults.id, 'idor-session'));
      await db.delete(scenarios).where(eq(scenarios.id, 'idor-scenario'));
      await db.delete(users).where(eq(users.id, 'idor-user-a'));
      await db.delete(users).where(eq(users.id, 'idor-user-b'));
    });

    it('getSessionById — owner session receives row (positive control)', async () => {
      const result = await getSessionById('idor-session', 'idor-user-a');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('idor-session');
    });

    it('getSessionById — foreign userId returns null (IDOR blocked)', async () => {
      const result = await getSessionById('idor-session', 'idor-user-b');
      expect(result).toBeNull();
    });

    it('getSessionEvents — owner session receives array (positive control)', async () => {
      const result = await getSessionEvents('idor-session', 'idor-user-a');
      expect(Array.isArray(result)).toBe(true);
    });

    it('getSessionEvents — foreign userId returns empty array (IDOR blocked)', async () => {
      const result = await getSessionEvents('idor-session', 'idor-user-b');
      expect(result).toEqual([]);
    });
  },
);

describe.skipIf(!runIntegration)(
  'deleteSessionById — R-DEL-01 IDOR, R-DEL-02 cascade, R-DEL-03 not found',
  () => {
    beforeAll(async () => {
      await db.insert(users).values([
        { id: 'del-owner', email: 'del-owner@integration.local' },
        { id: 'del-intruder', email: 'del-intruder@integration.local' },
      ]);
      await db.insert(scenarios).values({
        id: 'del-scenario',
        title: 'Delete Test Scenario',
        description: 'Integration fixture for deleteSessionById',
        timeLimitSeconds: 300,
      });
      await db.insert(diagnosticTests).values({
        id: 'del-dt',
        name: 'Delete Test DT',
      });
      await db.insert(sessionResults).values({
        id: 'del-session',
        userId: 'del-owner',
        scenarioId: 'del-scenario',
        outcome: 'positive',
      });
      await db.insert(sessionEvents).values({
        sessionId: 'del-session',
        testId: 'del-dt',
        validatorResult: 'correct',
      });
    });

    afterAll(async () => {
      await db
        .delete(sessionEvents)
        .where(eq(sessionEvents.sessionId, 'del-session'));
      await db
        .delete(sessionResults)
        .where(eq(sessionResults.id, 'del-session'));
      await db.delete(diagnosticTests).where(eq(diagnosticTests.id, 'del-dt'));
      await db.delete(scenarios).where(eq(scenarios.id, 'del-scenario'));
      await db.delete(users).where(eq(users.id, 'del-owner'));
      await db.delete(users).where(eq(users.id, 'del-intruder'));
    });

    it('R-DEL-01 IDOR: intruder returns 0, session still exists', async () => {
      const count = await deleteSessionById('del-session', 'del-intruder');
      expect(count).toBe(0);
      const session = await getSessionById('del-session', 'del-owner');
      expect(session).not.toBeNull();
    });

    it('R-DEL-02 cascade: owner returns 1, session_events gone', async () => {
      const count = await deleteSessionById('del-session', 'del-owner');
      expect(count).toBe(1);
      const events = await getSessionEvents('del-session', 'del-owner');
      expect(events).toEqual([]);
    });

    it('R-DEL-03 not found: non-existent id returns 0 without throwing', async () => {
      const count = await deleteSessionById(
        '00000000-0000-0000-0000-000000000000',
        'del-owner',
      );
      expect(count).toBe(0);
    });
  },
);
