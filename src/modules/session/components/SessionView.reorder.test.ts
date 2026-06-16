import { describe, it, expect, vi } from 'vitest';

vi.mock('@/modules/session/actions', () => ({
  selectTestAction: vi.fn(),
  endSessionAction: vi.fn(),
}));

import { applyReorder, type OrderedTest } from './SessionView';

function makeTest(id: string): OrderedTest {
  return {
    testId: id,
    name: `Test ${id}`,
    validatorResult: 'correct',
    category: 'critical',
  };
}

describe('applyReorder', () => {
  it('moves first test to last position', () => {
    const [A, B, C] = ['a', 'b', 'c'].map(makeTest);
    expect(applyReorder([A, B, C], 'a', 'c')).toEqual([B, C, A]);
  });

  it('moves last test to first position', () => {
    const [A, B, C] = ['a', 'b', 'c'].map(makeTest);
    expect(applyReorder([A, B, C], 'c', 'a')).toEqual([C, A, B]);
  });

  it('moves middle test one position forward', () => {
    const [A, B, C] = ['a', 'b', 'c'].map(makeTest);
    expect(applyReorder([A, B, C], 'b', 'c')).toEqual([A, C, B]);
  });

  it('returns unchanged list when activeId not in tests', () => {
    const tests = ['a', 'b', 'c'].map(makeTest);
    expect(applyReorder(tests, 'x', 'a')).toBe(tests);
  });

  it('returns unchanged list when overId not in tests', () => {
    const tests = ['a', 'b', 'c'].map(makeTest);
    expect(applyReorder(tests, 'a', 'x')).toBe(tests);
  });
});
