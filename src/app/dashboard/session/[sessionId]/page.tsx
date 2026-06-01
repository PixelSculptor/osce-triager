import { notFound, redirect } from "next/navigation"
import { auth } from "@/modules/auth/auth"
import { SessionView } from "@/modules/session/components"
import {
  getDiagnosticTests,
  getScenarioById,
  getSessionById,
  getSessionEvents,
  getTestClassificationsByScenario,
} from "@/modules/session/queries"
import type { TestCategory, ValidatorResult } from "@/shared/lib/validator"

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const sessionResult = await getSessionById(sessionId)
  if (!sessionResult || sessionResult.userId !== session.user.id) notFound()

  const [scenario, tests, classificationRows, events] = await Promise.all([
    getScenarioById(sessionResult.scenarioId),
    getDiagnosticTests(),
    getTestClassificationsByScenario(sessionResult.scenarioId),
    getSessionEvents(sessionId),
  ])

  if (!scenario) notFound()

  const classifications: Record<string, TestCategory> = {}
  for (const row of classificationRows) {
    classifications[row.testId] = row.classification as TestCategory
  }

  const initialEvents = events.map((e) => ({
    testId: e.testId,
    validatorResult: e.validatorResult as ValidatorResult,
  }))

  return (
    <SessionView
      sessionId={sessionId}
      timeLimitSeconds={scenario.timeLimitSeconds}
      startedAt={sessionResult.startedAt.toISOString()}
      tests={tests.map((t) => ({ id: t.id, name: t.name }))}
      classifications={classifications}
      initialEvents={initialEvents}
      sessionOutcome={sessionResult.outcome as "in_progress" | "positive" | "negative"}
    />
  )
}
