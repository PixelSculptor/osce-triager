import 'server-only';

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/shared/lib/db';
import {
  sessionEvents,
  sessionResults,
  testClassifications,
} from '@/shared/lib/schema';
import { evaluateSessionEnd, type TestCategory } from '@/shared/lib/validator';
import type { EndSessionResult } from './session.types';

/**
 * Shared, server-only finalization core. Collects events → evaluates →
 * atomically claims the session → appends `critical_miss` events → returns the
 * result. Extracted from `endSessionAction` so read paths (session loader,
 * history) and `selectTestAction` can finalize expired sessions too.
 *
 * Does NOT perform auth / ownership checks — the caller must do that. Calls
 * `getDb()` itself (per-request pattern). The atomic claim
 * (`WHERE outcome = 'in_progress'`) plus the conditional `critical_miss` append
 * make this idempotent and race-safe across concurrent callers.
 */
export async function finalizeSession(
  sessionRow: typeof sessionResults.$inferSelect,
): Promise<EndSessionResult> {
  const db = getDb();
  const sessionId = sessionRow.id;

  // Already terminal — report current state, seeding skippedCritical from the
  // existing critical_miss events so callers stay consistent with a fresh end.
  if (sessionRow.outcome !== 'in_progress') {
    const criticalMissEvents = await db
      .select()
      .from(sessionEvents)
      .where(
        and(
          eq(sessionEvents.sessionId, sessionId),
          eq(sessionEvents.validatorResult, 'critical_miss'),
        ),
      );

    return {
      outcome: sessionRow.outcome as 'positive' | 'negative',
      isFailed: sessionRow.isFailed,
      skippedCritical: criticalMissEvents.map((e) => e.testId),
    };
  }

  const events = await db
    .select()
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId));

  const orderedTestIds = events
    .filter((e) => e.validatorResult !== 'critical_miss')
    .map((e) => e.testId);

  const classificationRows = await db
    .select()
    .from(testClassifications)
    .where(eq(testClassifications.scenarioId, sessionRow.scenarioId));

  const classifications: Record<string, TestCategory> = {};
  for (const row of classificationRows) {
    classifications[row.testId] = row.classification as TestCategory;
  }

  const { irreversibleFail, skippedCritical } = evaluateSessionEnd(
    orderedTestIds,
    classifications,
  );

  // Atomic claim: only the caller that flips outcome away from 'in_progress'
  // proceeds to write critical_miss events. Concurrent callers get [] back.
  const claimed = await db
    .update(sessionResults)
    .set({
      outcome: irreversibleFail ? 'negative' : 'positive',
      isFailed: irreversibleFail,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(sessionResults.id, sessionId),
        eq(sessionResults.outcome, 'in_progress'),
      ),
    )
    .returning();

  if (claimed.length === 0) {
    const [current] = await db
      .select()
      .from(sessionResults)
      .where(eq(sessionResults.id, sessionId))
      .limit(1);

    const criticalMissEvents = await db
      .select()
      .from(sessionEvents)
      .where(
        and(
          eq(sessionEvents.sessionId, sessionId),
          eq(sessionEvents.validatorResult, 'critical_miss'),
        ),
      );

    return {
      outcome: current.outcome as 'positive' | 'negative',
      isFailed: current.isFailed,
      skippedCritical: criticalMissEvents.map((e) => e.testId),
    };
  }

  if (skippedCritical.length > 0) {
    await db.insert(sessionEvents).values(
      skippedCritical.map((testId) => ({
        sessionId,
        testId,
        validatorResult: 'critical_miss' as const,
      })),
    );
  }

  return {
    outcome: claimed[0].outcome as 'positive' | 'negative',
    isFailed: claimed[0].isFailed,
    skippedCritical,
  };
}
