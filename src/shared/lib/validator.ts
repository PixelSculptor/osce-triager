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
