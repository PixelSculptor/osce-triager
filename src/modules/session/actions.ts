'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/modules/auth/auth';
import { getDb } from '@/shared/lib/db';
import {
  scenarios,
  sessionEvents,
  sessionResults,
  testClassifications,
} from '@/shared/lib/schema';
import {
  isSessionExpired,
  validateTestSelection,
  type TestCategory,
} from '@/shared/lib/validator';
import type {
  EndSessionResult,
  SelectTestResult,
  StartSessionResult,
} from './session.types';
import { finalizeSession } from './finalize';
import { deleteSessionById, getScenarioById, getSessionById } from './queries';

export async function startSessionAction(
  scenarioId: string,
): Promise<StartSessionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const db = getDb();
  try {
    const scenario = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, scenarioId))
      .limit(1);

    if (scenario.length === 0) return { error: 'Scenario not found' };

    const [result] = await db
      .insert(sessionResults)
      .values({
        userId: session.user.id,
        scenarioId,
        outcome: 'in_progress',
        isFailed: false,
      })
      .returning({ sessionId: sessionResults.id });

    return { sessionId: result.sessionId };
  } catch (error) {
    console.error('[startSessionAction] DB error:', error);
    return { error: 'Internal error' };
  }
}

export async function selectTestAction(
  sessionId: string,
  testId: string,
): Promise<SelectTestResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const db = getDb();
  try {
    const [sessionRow] = await db
      .select()
      .from(sessionResults)
      .where(eq(sessionResults.id, sessionId))
      .limit(1);

    if (!sessionRow) return { error: 'Session not found' };
    if (sessionRow.userId !== session.user.id) return { error: 'Forbidden' };
    if (sessionRow.outcome !== 'in_progress')
      return { error: 'Session already ended' };

    // Server-side deadline guard: reject a post-deadline selection and close the
    // expired session, killing the "re-enter an expired session and keep
    // clicking" exploit. Uses the grace buffer baked into isSessionExpired.
    const scenario = await getScenarioById(sessionRow.scenarioId);
    if (
      scenario &&
      isSessionExpired(sessionRow.startedAt, scenario.timeLimitSeconds)
    ) {
      await finalizeSession(sessionRow);
      return { error: 'Session time expired' };
    }

    const existingEvents = await db
      .select()
      .from(sessionEvents)
      .where(
        and(
          eq(sessionEvents.sessionId, sessionId),
          eq(sessionEvents.testId, testId),
        ),
      )
      .limit(1);

    if (existingEvents.length > 0) return { error: 'Test already selected' };

    const classificationRows = await db
      .select()
      .from(testClassifications)
      .where(eq(testClassifications.scenarioId, sessionRow.scenarioId));

    const classifications: Record<string, TestCategory> = {};
    for (const row of classificationRows) {
      classifications[row.testId] = row.classification as TestCategory;
    }

    if (!(testId in classifications)) return { error: 'Test not in scenario' };

    const { category, validatorResult } = validateTestSelection(
      testId,
      classifications,
    );

    await db
      .insert(sessionEvents)
      .values({ sessionId, testId, validatorResult });

    return { validatorResult, category };
  } catch (error) {
    console.error('[selectTestAction] DB error:', error);
    return { error: 'Internal error' };
  }
}

export async function endSessionAction(
  sessionId: string,
): Promise<EndSessionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const db = getDb();
  try {
    const [sessionRow] = await db
      .select()
      .from(sessionResults)
      .where(eq(sessionResults.id, sessionId))
      .limit(1);

    if (!sessionRow) return { error: 'Session not found' };
    if (sessionRow.userId !== session.user.id) return { error: 'Forbidden' };

    return await finalizeSession(sessionRow);
  } catch (error) {
    console.error('[endSessionAction] DB error:', error);
    return { error: 'Internal error' };
  }
}

export async function deleteSessionAction(
  sessionId: string,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const userId = session.user.id;
  const existing = await getSessionById(sessionId, userId);
  if (!existing) return { error: 'Not found' };
  if (existing.outcome === 'in_progress')
    return { error: 'Cannot delete an active session' };

  await deleteSessionById(sessionId, userId);
  revalidatePath('/dashboard/history');
  return {};
}
