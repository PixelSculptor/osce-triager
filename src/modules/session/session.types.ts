import type { TestCategory, ValidatorResult } from "@/shared/lib/validator"

export interface StartSessionResult {
  sessionId?: string
  error?: string
}

export interface SelectTestResult {
  validatorResult?: ValidatorResult
  category?: TestCategory
  error?: string
}

export interface EndSessionResult {
  outcome?: "positive" | "negative"
  isFailed?: boolean
  skippedCritical?: string[]
  error?: string
}
