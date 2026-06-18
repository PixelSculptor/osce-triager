import 'server-only';

export type TestCategory =
  | 'critical'
  | 'optimal'
  | 'acceptable'
  | 'unnecessary';

export type ValidatorResult =
  | 'correct'
  | 'suboptimal'
  | 'unnecessary'
  | 'critical_miss';

export interface TestValidationResult {
  category: TestCategory;
  validatorResult: ValidatorResult;
}

export interface SessionEndResult {
  irreversibleFail: boolean;
  skippedCritical: string[];
}

export const CATEGORY_TO_RESULT: Record<TestCategory, ValidatorResult> = {
  critical: 'correct',
  optimal: 'correct',
  acceptable: 'suboptimal',
  unnecessary: 'unnecessary',
};

export function validateTestSelection(
  testId: string,
  classifications: Record<string, TestCategory>,
): TestValidationResult {
  const category = classifications[testId] ?? 'unnecessary';
  return { category, validatorResult: CATEGORY_TO_RESULT[category] };
}

/**
 * Server-side grace buffer (seconds) for expiry checks. The client auto-ends a
 * session exactly at 0:00 with no buffer; the server adds this small margin so a
 * legitimate click made just before the deadline (clock skew / network latency)
 * is not rejected after the fact. Applies only to server-side guards.
 */
export const EXPIRY_GRACE_SECONDS = 3;

/**
 * Deterministic check for whether a session has exceeded its time limit.
 * Returns `true` when elapsed time is strictly greater than
 * `timeLimitSeconds + graceSeconds`. `now` defaults to the current time but is
 * passed explicitly in tests for determinism.
 */
export function isSessionExpired(
  startedAt: Date,
  timeLimitSeconds: number,
  now: Date = new Date(),
  graceSeconds: number = EXPIRY_GRACE_SECONDS,
): boolean {
  const elapsedSeconds = (now.getTime() - startedAt.getTime()) / 1000;
  return elapsedSeconds > timeLimitSeconds + graceSeconds;
}

export function evaluateSessionEnd(
  orderedTestIds: string[],
  classifications: Record<string, TestCategory>,
): SessionEndResult {
  const ordered = new Set(orderedTestIds);
  const skippedCritical = Object.entries(classifications)
    .filter(([id, cat]) => cat === 'critical' && !ordered.has(id))
    .map(([id]) => id);
  return { irreversibleFail: skippedCritical.length > 0, skippedCritical };
}
