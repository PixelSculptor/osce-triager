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
  return db.select().from(scenarios).orderBy(scenarios.createdAt);
}

export async function getSessionById(sessionId: string, userId: string) {
  const [row] = await db
    .select()
    .from(sessionResults)
    .where(
      and(eq(sessionResults.id, sessionId), eq(sessionResults.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function getScenarioById(scenarioId: string) {
  const [row] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId))
    .limit(1);
  return row ?? null;
}

export async function getDiagnosticTests() {
  return db.select().from(diagnosticTests);
}

export async function getTestClassificationsByScenario(scenarioId: string) {
  return db
    .select()
    .from(testClassifications)
    .where(eq(testClassifications.scenarioId, scenarioId));
}

export async function getSessionEvents(sessionId: string, userId: string) {
  return db
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
}

export async function getUserSessions(userId: string) {
  return db
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
}

export async function getSessionDetails(sessionId: string, userId: string) {
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
}
