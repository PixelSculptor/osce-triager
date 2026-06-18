import { notFound, redirect } from 'next/navigation';
import { auth } from '@/modules/auth/auth';
import { SessionView } from '@/modules/session/components';
import { finalizeSession } from '@/modules/session/finalize';
import {
  getDiagnosticTests,
  getScenarioById,
  getSessionById,
  getSessionEvents,
  getTestClassificationsByScenario,
} from '@/modules/session/queries';
import {
  isSessionExpired,
  type TestCategory,
  type ValidatorResult,
} from '@/shared/lib/validator';

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const sessionResult = await getSessionById(sessionId, session.user.id);
  if (!sessionResult) notFound();

  const scenario = await getScenarioById(sessionResult.scenarioId);
  if (!scenario) notFound();

  // Lazy-finalize: entering an expired but still-in_progress session closes it
  // server-side and shows the results screen immediately. Finalize BEFORE
  // getSessionEvents so the critical_miss events land in initialEvents.
  let sessionOutcome = sessionResult.outcome as
    | 'in_progress'
    | 'positive'
    | 'negative';
  if (
    sessionResult.outcome === 'in_progress' &&
    isSessionExpired(sessionResult.startedAt, scenario.timeLimitSeconds)
  ) {
    const finalized = await finalizeSession(sessionResult);
    if (finalized.outcome) sessionOutcome = finalized.outcome;
  }

  const [tests, classificationRows, events] = await Promise.all([
    getDiagnosticTests(),
    getTestClassificationsByScenario(sessionResult.scenarioId),
    getSessionEvents(sessionId, session.user.id),
  ]);

  const classifications: Record<string, TestCategory> = {};
  for (const row of classificationRows) {
    classifications[row.testId] = row.classification as TestCategory;
  }

  const initialEvents = events.map((e) => ({
    testId: e.testId,
    validatorResult: e.validatorResult as ValidatorResult,
  }));

  return (
    <SessionView
      sessionId={sessionId}
      timeLimitSeconds={scenario.timeLimitSeconds}
      startedAt={sessionResult.startedAt.toISOString()}
      tests={tests.map((t) => ({ id: t.id, name: t.name }))}
      classifications={classifications}
      initialEvents={initialEvents}
      sessionOutcome={sessionOutcome}
    />
  );
}
