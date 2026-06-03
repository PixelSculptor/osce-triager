"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { startSessionAction } from "@/modules/session/actions"
import { Spinner } from "@/shared/components/Spinner/Spinner"
import styles from "./ScenarioCard.module.css"

interface ScenarioCardProps {
  id: string
  title: string
  description: string
  timeLimitSeconds: number
}

export function ScenarioCard({
  id,
  title,
  description,
  timeLimitSeconds,
}: ScenarioCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setLoading(true)
    setError(null)
    const result = await startSessionAction(id)
    if (result.error || !result.sessionId) {
      setError(result.error ?? "Wystąpił błąd. Spróbuj ponownie.")
      setLoading(false)
      return
    }
    router.push(`/dashboard/session/${result.sessionId}`)
  }

  const minutes = Math.floor(timeLimitSeconds / 60)

  return (
    <li className={styles.card}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      <p className={styles.meta}>Czas: {minutes} min</p>
      {error && <p className={styles.error}>{error}</p>}
      <button
        className={styles.button}
        onClick={handleStart}
        disabled={loading}
      >
        {loading ? <Spinner size="sm" /> : "Rozpocznij sesję"}
      </button>
    </li>
  )
}
