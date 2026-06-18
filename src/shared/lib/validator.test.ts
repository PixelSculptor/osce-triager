import { describe, it, expect } from 'vitest';
import {
  validateTestSelection,
  evaluateSessionEnd,
  isSessionExpired,
  EXPIRY_GRACE_SECONDS,
} from './validator';

describe('validateTestSelection', () => {
  it('critical test returns correct', () => {
    const result = validateTestSelection('dt-001', { 'dt-001': 'critical' });
    expect(result).toEqual({
      category: 'critical',
      validatorResult: 'correct',
    });
  });

  it('optimal test returns correct', () => {
    const result = validateTestSelection('dt-001', { 'dt-001': 'optimal' });
    expect(result).toEqual({ category: 'optimal', validatorResult: 'correct' });
  });

  it('acceptable test returns suboptimal', () => {
    const result = validateTestSelection('dt-001', { 'dt-001': 'acceptable' });
    expect(result).toEqual({
      category: 'acceptable',
      validatorResult: 'suboptimal',
    });
  });

  it('unnecessary test returns unnecessary', () => {
    const result = validateTestSelection('dt-001', { 'dt-001': 'unnecessary' });
    expect(result).toEqual({
      category: 'unnecessary',
      validatorResult: 'unnecessary',
    });
  });

  // Documents the silent default: when testId is absent from the classifications map
  // (e.g. empty map from a failed DB load), the ?? "unnecessary" fallback fires silently.
  // Protection at the action level relies on the guard at actions.ts:92.
  it('unknown test id silently defaults to unnecessary when not in classifications', () => {
    const result = validateTestSelection('dt-001', {});
    expect(result).toEqual({
      category: 'unnecessary',
      validatorResult: 'unnecessary',
    });
  });
});

describe('evaluateSessionEnd', () => {
  it('all critical tests selected — no irreversible fail', () => {
    const result = evaluateSessionEnd(['dt-001', 'dt-002'], {
      'dt-001': 'critical',
      'dt-002': 'critical',
    });
    expect(result).toEqual({ irreversibleFail: false, skippedCritical: [] });
  });

  it('one critical test skipped — irreversible fail with that test id', () => {
    const result = evaluateSessionEnd(['dt-002'], {
      'dt-001': 'critical',
      'dt-002': 'critical',
    });
    expect(result).toEqual({
      irreversibleFail: true,
      skippedCritical: ['dt-001'],
    });
  });

  it('non-critical skipped tests are never reported in skippedCritical', () => {
    const result = evaluateSessionEnd([], {
      'dt-001': 'optimal',
      'dt-002': 'acceptable',
      'dt-003': 'unnecessary',
    });
    expect(result).toEqual({ irreversibleFail: false, skippedCritical: [] });
  });
});

describe('isSessionExpired', () => {
  const startedAt = new Date('2024-01-01T00:00:00.000Z');
  // Wall clock `seconds` after startedAt — passed explicitly for determinism.
  const at = (seconds: number) =>
    new Date(startedAt.getTime() + seconds * 1000);
  const GRACE = 3;
  const LIMIT = 300;

  it('elapsed below the limit — not expired', () => {
    expect(isSessionExpired(startedAt, LIMIT, at(299), GRACE)).toBe(false);
  });

  it('elapsed exactly at the limit — not expired', () => {
    expect(isSessionExpired(startedAt, LIMIT, at(LIMIT), GRACE)).toBe(false);
  });

  it('elapsed within the grace buffer — not expired', () => {
    expect(isSessionExpired(startedAt, LIMIT, at(LIMIT + 1), GRACE)).toBe(
      false,
    );
  });

  it('elapsed exactly at limit + grace — not expired (boundary is strict >)', () => {
    expect(isSessionExpired(startedAt, LIMIT, at(LIMIT + GRACE), GRACE)).toBe(
      false,
    );
  });

  it('elapsed beyond limit + grace — expired', () => {
    expect(
      isSessionExpired(startedAt, LIMIT, at(LIMIT + GRACE + 1), GRACE),
    ).toBe(true);
  });

  it('graceSeconds defaults to EXPIRY_GRACE_SECONDS', () => {
    expect(
      isSessionExpired(startedAt, LIMIT, at(LIMIT + EXPIRY_GRACE_SECONDS)),
    ).toBe(false);
    expect(
      isSessionExpired(startedAt, LIMIT, at(LIMIT + EXPIRY_GRACE_SECONDS + 1)),
    ).toBe(true);
  });
});
