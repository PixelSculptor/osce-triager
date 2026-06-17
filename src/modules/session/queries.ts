import 'server-only';

import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import {
  diagnosticTests,
  scenarios,
  sessionEvents,
  sessionResults,
  testClassifications,
} from '@/shared/lib/schema';

export async function getScenarios() {
  try {
    return await db.select().from(scenarios).orderBy(scenarios.createdAt);
  } catch (e) {
    console.error('[getScenarios] DB error:', e);
    throw e;
  }
}

export async function getSessionById(sessionId: string, userId: string) {
  try {
    const [row] = await db
      .select()
      .from(sessionResults)
      .where(
        and(
          eq(sessionResults.id, sessionId),
          eq(sessionResults.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  } catch (e) {
    console.error('[getSessionById] DB error:', e);
    throw e;
  }
}

export async function getScenarioById(scenarioId: string) {
  try {
    const [row] = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, scenarioId))
      .limit(1);
    return row ?? null;
  } catch (e) {
    console.error('[getScenarioById] DB error:', e);
    throw e;
  }
}

export async function getDiagnosticTests() {
  try {
    return await db.select().from(diagnosticTests);
  } catch (e) {
    console.error('[getDiagnosticTests] DB error:', e);
    throw e;
  }
}

export async function getTestClassificationsByScenario(scenarioId: string) {
  try {
    return await db
      .select()
      .from(testClassifications)
      .where(eq(testClassifications.scenarioId, scenarioId));
  } catch (e) {
    console.error('[getTestClassificationsByScenario] DB error:', e);
    throw e;
  }
}

export async function getSessionEvents(sessionId: string, userId: string) {
  try {
    return await db
      .select({
        id: sessionEvents.id,
        sessionId: sessionEvents.sessionId,
        testId: sessionEvents.testId,
        validatorResult: sessionEvents.validatorResult,
        selectedAt: sessionEvents.selectedAt,
      })
      .from(sessionEvents)
      .innerJoin(sessionResults, eq(sessionEvents.sessionId, sessionResults.id))
      .where(
        and(
          eq(sessionEvents.sessionId, sessionId),
          eq(sessionResults.userId, userId),
        ),
      )
      .orderBy(sessionEvents.selectedAt);
  } catch (e) {
    console.error('[getSessionEvents] DB error:', e);
    throw e;
  }
}

export async function getUserSessions(userId: string) {
  try {
    return await db
      .select({
        id: sessionResults.id,
        outcome: sessionResults.outcome,
        startedAt: sessionResults.startedAt,
        completedAt: sessionResults.completedAt,
        scenarioTitle: scenarios.title,
      })
      .from(sessionResults)
      .innerJoin(scenarios, eq(sessionResults.scenarioId, scenarios.id))
      .where(
        and(
          eq(sessionResults.userId, userId),
          ne(sessionResults.outcome, 'in_progress'),
        ),
      )
      .orderBy(desc(sessionResults.completedAt));
  } catch (e) {
    console.error('[getUserSessions] DB error:', e);
    throw e;
  }
}

export async function deleteSessionById(
  sessionId: string,
  userId: string,
): Promise<number> {
  const deleted = await db
    .delete(sessionResults)
    .where(
      and(eq(sessionResults.id, sessionId), eq(sessionResults.userId, userId)),
    )
    .returning({ id: sessionResults.id });
  return deleted.length;
}

export async function getSessionDetails(sessionId: string, userId: string) {
  try {
    const [sessionRow] = await db
      .select({
        id: sessionResults.id,
        outcome: sessionResults.outcome,
        startedAt: sessionResults.startedAt,
        completedAt: sessionResults.completedAt,
        scenarioTitle: scenarios.title,
      })
      .from(sessionResults)
      .innerJoin(scenarios, eq(sessionResults.scenarioId, scenarios.id))
      .where(
        and(
          eq(sessionResults.id, sessionId),
          eq(sessionResults.userId, userId),
          ne(sessionResults.outcome, 'in_progress'),
        ),
      )
      .limit(1);

    if (!sessionRow) return null;

    const events = await db
      .select({
        testId: sessionEvents.testId,
        testName: diagnosticTests.name,
        validatorResult: sessionEvents.validatorResult,
        selectedAt: sessionEvents.selectedAt,
      })
      .from(sessionEvents)
      .innerJoin(diagnosticTests, eq(sessionEvents.testId, diagnosticTests.id))
      .where(eq(sessionEvents.sessionId, sessionId))
      .orderBy(sessionEvents.selectedAt);

    return {
      ...sessionRow,
      outcome: sessionRow.outcome as 'positive' | 'negative',
      completedAt: sessionRow.completedAt!,
      events: events.map((e) => ({
        ...e,
        validatorResult: e.validatorResult as
          | 'correct'
          | 'suboptimal'
          | 'unnecessary'
          | 'critical_miss',
      })),
    };
  } catch (e) {
    console.error('[getSessionDetails] DB error:', e);
    throw e;
  }
}
