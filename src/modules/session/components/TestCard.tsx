"use client"

import type { ValidatorResult } from "@/shared/lib/validator"
import styles from "./TestCard.module.css"

interface TestCardProps {
  name: string
  validatorResult?: ValidatorResult
  onSelect?: () => void
  isLoading?: boolean
}

const BADGE_LABELS: Partial<Record<ValidatorResult, string>> = {
  correct: "Poprawne",
  suboptimal: "Akceptowalne",
  unnecessary: "Zbędne",
}

export function TestCard({
  name,
  validatorResult,
  onSelect,
  isLoading,
}: TestCardProps) {
  const isSelected = validatorResult !== undefined

  return (
    <div className={styles.card} data-selected={isSelected}>
      <span className={styles.name}>{name}</span>
      {isSelected && validatorResult && BADGE_LABELS[validatorResult] ? (
        <span className={styles.badge} data-result={validatorResult}>
          {BADGE_LABELS[validatorResult]}
        </span>
      ) : !isSelected ? (
        <button
          className={styles.button}
          onClick={onSelect}
          disabled={isLoading || !onSelect}
        >
          {isLoading ? "..." : "Zleć"}
        </button>
      ) : null}
    </div>
  )
}
