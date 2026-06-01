"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import type { TestCategory, ValidatorResult } from "@/shared/lib/validator"
import { endSessionAction, selectTestAction } from "@/modules/session/actions"
import { TestCard } from "./TestCard"
import styles from "./SessionView.module.css"

interface OrderedTest {
  testId: string
  name: string
  validatorResult: ValidatorResult
  category: TestCategory
}

interface SessionViewProps {
  sessionId: string
  timeLimitSeconds: number
  startedAt: Date
  tests: Array<{ id: string; name: string }>
  classifications: Record<string, TestCategory>
  initialEvents: Array<{ testId: string; validatorResult: ValidatorResult }>
  sessionOutcome: "in_progress" | "positive" | "negative"
}

export function SessionView({
  sessionId,
  timeLimitSeconds,
  startedAt,
  tests,
  classifications,
  initialEvents,
  sessionOutcome,
}: SessionViewProps) {
  const [orderedTests, setOrderedTests] = useState<OrderedTest[]>(() =>
    initialEvents
      .filter((e) => e.validatorResult !== "critical_miss")
      .flatMap((e) => {
        const test = tests.find((t) => t.id === e.testId)
        if (!test) return []
        const category = classifications[e.testId] ?? "unnecessary"
        return [{ testId: e.testId, name: test.name, validatorResult: e.validatorResult, category }]
      })
  )

  const [sessionState, setSessionState] = useState(sessionOutcome)

  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    return Math.max(0, timeLimitSeconds - elapsed)
  })

  const [skippedCritical, setSkippedCritical] = useState<string[]>(() => {
    if (sessionOutcome !== "in_progress") {
      return initialEvents
        .filter((e) => e.validatorResult === "critical_miss")
        .map((e) => e.testId)
    }
    return []
  })

  const [loadingTestId, setLoadingTestId] = useState<string | null>(null)
  const [isEnding, setIsEnding] = useState(false)
  const endingRef = useRef(false)

  useEffect(() => {
    if (sessionState !== "in_progress") return
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [sessionState])

  useEffect(() => {
    if (remainingSeconds === 0 && sessionState === "in_progress") {
      handleEndSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds])

  async function handleEndSession() {
    if (endingRef.current) return
    endingRef.current = true
    setIsEnding(true)
    const result = await endSessionAction(sessionId)
    if (result.outcome) {
      setSessionState(result.outcome)
      setSkippedCritical(result.skippedCritical ?? [])
    }
  }

  async function handleSelectTest(testId: string, testName: string) {
    if (loadingTestId || sessionState !== "in_progress") return
    setLoadingTestId(testId)
    const result = await selectTestAction(sessionId, testId)
    const { validatorResult, category } = result
    if (validatorResult && category) {
      setOrderedTests((prev) => [
        ...prev,
        { testId, name: testName, validatorResult, category },
      ])
    }
    setLoadingTestId(null)
  }

  const orderedTestIds = new Set(orderedTests.map((t) => t.testId))
  const unorderedTests = tests.filter((t) => !orderedTestIds.has(t.id))
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  if (sessionState !== "in_progress") {
    const isPositive = sessionState === "positive"
    const skippedNames = skippedCritical.map(
      (id) => tests.find((t) => t.id === id)?.name ?? id
    )

    return (
      <main className={styles.result}>
        <h1>Sesja zakończona</h1>
        <p className={styles.outcome} data-positive={isPositive}>
          Wynik: {isPositive ? "Pozytywny ✓" : "Negatywny ✗"}
        </p>
        {skippedNames.length > 0 && (
          <div className={styles.skipped}>
            <p>Pominięte badania krytyczne:</p>
            <ul>
              {skippedNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        <Link href="/dashboard" className={styles.backLink}>
          Wróć do panelu
        </Link>
      </main>
    )
  }

  return (
    <main className={styles.session}>
      <div className={styles.header}>
        <span
          className={styles.timer}
          data-urgent={remainingSeconds < 60}
        >
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        <button
          className={styles.endButton}
          onClick={handleEndSession}
          disabled={isEnding}
        >
          {isEnding ? "Kończenie..." : "Zakończ sesję"}
        </button>
      </div>

      <div className={styles.columns}>
        <section className={styles.column}>
          <h2>Dostępne badania ({unorderedTests.length})</h2>
          <div className={styles.testList}>
            {unorderedTests.map((test) => (
              <TestCard
                key={test.id}
                name={test.name}
                onSelect={() => handleSelectTest(test.id, test.name)}
                isLoading={loadingTestId === test.id}
              />
            ))}
          </div>
        </section>

        <section className={styles.column}>
          <h2>Zlecone badania ({orderedTests.length})</h2>
          <div className={styles.testList}>
            {orderedTests.map((test) => (
              <TestCard
                key={test.testId}
                name={test.name}
                validatorResult={test.validatorResult}
                category={test.category}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
