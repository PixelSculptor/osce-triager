import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/shared/lib/db"
import {
  diagnosticTests,
  scenarios,
  sessionEvents,
  sessionResults,
  testClassifications,
} from "@/shared/lib/schema"

export async function getScenarios() {
  return db.select().from(scenarios).orderBy(scenarios.createdAt)
}

export async function getSessionById(sessionId: string) {
  const [row] = await db
    .select()
    .from(sessionResults)
    .where(eq(sessionResults.id, sessionId))
    .limit(1)
  return row ?? null
}

export async function getScenarioById(scenarioId: string) {
  const [row] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId))
    .limit(1)
  return row ?? null
}

export async function getDiagnosticTests() {
  return db.select().from(diagnosticTests)
}

export async function getTestClassificationsByScenario(scenarioId: string) {
  return db
    .select()
    .from(testClassifications)
    .where(eq(testClassifications.scenarioId, scenarioId))
}

export async function getSessionEvents(sessionId: string) {
  return db
    .select()
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(sessionEvents.selectedAt)
}
