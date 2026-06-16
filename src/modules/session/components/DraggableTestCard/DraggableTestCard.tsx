'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { TestCard } from './TestCard';
import styles from './DraggableTestCard.module.css';

interface DraggableTestCardProps {
  testId: string;
  name: string;
  onSelect?: () => void;
  isLoading?: boolean;
}

export function DraggableTestCard({
  testId,
  name,
  onSelect,
  isLoading,
}: DraggableTestCardProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } =
    useDraggable({ id: testId, data: { source: 'available', name } });

  return (
    <div
      ref={setNodeRef}
      aria-label={`Przeciągnij: ${name}`}
      className={styles.wrapper}
      data-dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform) ?? undefined }}
      {...attributes}
      {...listeners}
    >
      <TestCard name={name} onSelect={onSelect} isLoading={isLoading} />
    </div>
  );
}
