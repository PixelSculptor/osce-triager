"use server"

import { and, eq } from "drizzle-orm"
import { auth } from "@/modules/auth/auth"
import { db } from "@/shared/lib/db"
import {
  scenarios,
  sessionEvents,
  sessionResults,
  testClassifications,
} from "@/shared/lib/schema"
import {
  evaluateSessionEnd,
  validateTestSelection,
  type TestCategory,
} from "@/shared/lib/validator"
import type {
  EndSessionResult,
  SelectTestResult,
  StartSessionResult,
} from "./session.types"

export async function startSessionAction(
  scenarioId: string
): Promise<StartSessionResult> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  try {
    const scenario = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, scenarioId))
      .limit(1)

    if (scenario.length === 0) return { error: "Scenario not found" }

    const [result] = await db
      .insert(sessionResults)
      .values({
        userId: session.user.id,
        scenarioId,
        outcome: "in_progress",
        isFailed: false,
      })
      .returning({ sessionId: sessionResults.id })

    return { sessionId: result.sessionId }
  } catch {
    return { error: "Internal error" }
  }
}

export async function selectTestAction(
  sessionId: string,
  testId: string
): Promise<SelectTestResult> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  try {
    const [sessionRow] = await db
      .select()
      .from(sessionResults)
      .where(eq(sessionResults.id, sessionId))
      .limit(1)

    if (!sessionRow) return { error: "Session not found" }
    if (sessionRow.userId !== session.user.id) return { error: "Forbidden" }
    if (sessionRow.outcome !== "in_progress") return { error: "Session already ended" }

    const existingEvents = await db
      .select()
      .from(sessionEvents)
      .where(
        and(eq(sessionEvents.sessionId, sessionId), eq(sessionEvents.testId, testId))
      )
      .limit(1)

    if (existingEvents.length > 0) return { error: "Test already selected" }

    const classificationRows = await db
      .select()
      .from(testClassifications)
      .where(eq(testClassifications.scenarioId, sessionRow.scenarioId))

    const classifications: Record<string, TestCategory> = {}
    for (const row of classificationRows) {
      classifications[row.testId] = row.classification as TestCategory
    }

    if (!(testId in classifications)) return { error: "Test not in scenario" }

    const { category, validatorResult } = validateTestSelection(testId, classifications)

    await db.insert(sessionEvents).values({ sessionId, testId, validatorResult })

    return { validatorResult, category }
  } catch {
    return { error: "Internal error" }
  }
}

export async function endSessionAction(
  sessionId: string
): Promise<EndSessionResult> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  try {
    const [sessionRow] = await db
      .select()
      .from(sessionResults)
      .where(eq(sessionResults.id, sessionId))
      .limit(1)

    if (!sessionRow) return { error: "Session not found" }
    if (sessionRow.userId !== session.user.id) return { error: "Forbidden" }

    const events = await db
      .select()
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))

    const orderedTestIds = events
      .filter((e) => e.validatorResult !== "critical_miss")
      .map((e) => e.testId)

    const classificationRows = await db
      .select()
      .from(testClassifications)
      .where(eq(testClassifications.scenarioId, sessionRow.scenarioId))

    const classifications: Record<string, TestCategory> = {}
    for (const row of classificationRows) {
      classifications[row.testId] = row.classification as TestCategory
    }

    const { irreversibleFail, skippedCritical } = evaluateSessionEnd(
      orderedTestIds,
      classifications
    )

    const claimed = await db
      .update(sessionResults)
      .set({
        outcome: irreversibleFail ? "negative" : "positive",
        isFailed: irreversibleFail,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(sessionResults.id, sessionId),
          eq(sessionResults.outcome, "in_progress")
        )
      )
      .returning()

    if (claimed.length === 0) {
      const [current] = await db
        .select()
        .from(sessionResults)
        .where(eq(sessionResults.id, sessionId))
        .limit(1)

      return {
        outcome: current.outcome as "positive" | "negative",
        isFailed: current.isFailed,
        skippedCritical: [],
      }
    }

    if (skippedCritical.length > 0) {
      await db.insert(sessionEvents).values(
        skippedCritical.map((testId) => ({
          sessionId,
          testId,
          validatorResult: "critical_miss" as const,
        }))
      )
    }

    return {
      outcome: claimed[0].outcome as "positive" | "negative",
      isFailed: claimed[0].isFailed,
      skippedCritical,
    }
  } catch {
    return { error: "Internal error" }
  }
}
