"use client"

import { useDraggable } from "@dnd-kit/core"
import { TestCard } from "./TestCard"
import styles from "./DraggableTestCard.module.css"

interface DraggableTestCardProps {
  testId: string
  name: string
  onSelect?: () => void
  isLoading?: boolean
}

export function DraggableTestCard({
  testId,
  name,
  onSelect,
  isLoading,
}: DraggableTestCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({ id: testId, data: { source: "available", name } })

  return (
    <div
      ref={setNodeRef}
      className={styles.wrapper}
      data-dragging={isDragging}
      {...attributes}
      {...listeners}
    >
      <TestCard name={name} onSelect={onSelect} isLoading={isLoading} />
    </div>
  )
}
