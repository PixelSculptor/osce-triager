import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { TestCategory, ValidatorResult } from '@/shared/lib/validator';

export interface OrderedTest {
  testId: string;
  name: string;
  validatorResult: ValidatorResult;
  category: TestCategory;
}

export const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return rectIntersection(args);
};

export function applyReorder(
  tests: OrderedTest[],
  activeId: string,
  overId: string,
): OrderedTest[] {
  const oldIndex = tests.findIndex((t) => t.testId === activeId);
  const newIndex = tests.findIndex((t) => t.testId === overId);
  if (oldIndex === -1 || newIndex === -1) return tests;
  return arrayMove(tests, oldIndex, newIndex);
}
