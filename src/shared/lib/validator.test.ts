import { describe, it, expect } from 'vitest'
import { validateTestSelection, evaluateSessionEnd } from './validator'

describe('validateTestSelection', () => {
  it('critical test returns correct', () => {
    const result = validateTestSelection('dt-001', { 'dt-001': 'critical' })
    expect(result).toEqual({ category: 'critical', validatorResult: 'correct' })
  })

  it('optimal test returns correct', () => {
    const result = validateTestSelection('dt-001', { 'dt-001': 'optimal' })
    expect(result).toEqual({ category: 'optimal', validatorResult: 'correct' })
  })

  it('acceptable test returns suboptimal', () => {
    const result = validateTestSelection('dt-001', { 'dt-001': 'acceptable' })
    expect(result).toEqual({ category: 'acceptable', validatorResult: 'suboptimal' })
  })

  it('unnecessary test returns unnecessary', () => {
    const result = validateTestSelection('dt-001', { 'dt-001': 'unnecessary' })
    expect(result).toEqual({ category: 'unnecessary', validatorResult: 'unnecessary' })
  })

  // Documents the silent default: when testId is absent from the classifications map
  // (e.g. empty map from a failed DB load), the ?? "unnecessary" fallback fires silently.
  // Protection at the action level relies on the guard at actions.ts:92.
  it('unknown test id silently defaults to unnecessary when not in classifications', () => {
    const result = validateTestSelection('dt-001', {})
    expect(result).toEqual({ category: 'unnecessary', validatorResult: 'unnecessary' })
  })
})

describe('evaluateSessionEnd', () => {
  it('all critical tests selected — no irreversible fail', () => {
    const result = evaluateSessionEnd(
      ['dt-001', 'dt-002'],
      { 'dt-001': 'critical', 'dt-002': 'critical' }
    )
    expect(result).toEqual({ irreversibleFail: false, skippedCritical: [] })
  })

  it('one critical test skipped — irreversible fail with that test id', () => {
    const result = evaluateSessionEnd(
      ['dt-002'],
      { 'dt-001': 'critical', 'dt-002': 'critical' }
    )
    expect(result).toEqual({ irreversibleFail: true, skippedCritical: ['dt-001'] })
  })

  it('non-critical skipped tests are never reported in skippedCritical', () => {
    const result = evaluateSessionEnd(
      [],
      { 'dt-001': 'optimal', 'dt-002': 'acceptable', 'dt-003': 'unnecessary' }
    )
    expect(result).toEqual({ irreversibleFail: false, skippedCritical: [] })
  })
})
