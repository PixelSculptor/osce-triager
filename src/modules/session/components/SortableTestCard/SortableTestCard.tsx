'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ValidatorResult } from '@/shared/lib/validator';
import { TestCard } from '../TestCard/TestCard';

interface SortableTestCardProps {
  testId: string;
  name: string;
  validatorResult?: ValidatorResult;
}

export function SortableTestCard({
  testId,
  name,
  validatorResult,
}: SortableTestCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: testId, data: { source: 'ordered' } });

  return (
    <div
      ref={setNodeRef}
      aria-label={`Zmień kolejność: ${name}`}
      data-dragging={isDragging}
      style={{
        transform: CSS.Transform.toString(transform) ?? undefined,
        transition: transition ?? undefined,
        opacity: isDragging ? 0.4 : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      <TestCard name={name} validatorResult={validatorResult} />
    </div>
  );
}
