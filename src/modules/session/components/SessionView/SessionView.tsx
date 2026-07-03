'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TestCategory, ValidatorResult } from '@/shared/lib/validator';
import {
  collisionDetection,
  applyReorder,
  type OrderedTest,
} from './SessionView.utils';
import { endSessionAction, selectTestAction } from '@/modules/session/actions';
import { Button } from '@/shared/components/Button/Button';
import { Spinner } from '@/shared/components/Spinner/Spinner';
import { TestCard } from '../TestCard/TestCard';
import { DraggableTestCard } from '../DraggableTestCard/DraggableTestCard';
import { SortableTestCard } from '../SortableTestCard/SortableTestCard';
import styles from './SessionView.module.css';
import { ChevronLeft, CircleCheck, CircleX } from 'lucide-react';

interface SessionViewProps {
  sessionId: string;
  timeLimitSeconds: number;
  startedAt: string;
  tests: Array<{ id: string; name: string }>;
  classifications: Record<string, TestCategory>;
  initialEvents: Array<{ testId: string; validatorResult: ValidatorResult }>;
  sessionOutcome: 'in_progress' | 'positive' | 'negative';
}

export function SessionView({
  sessionId,
  timeLimitSeconds,
  startedAt,
  tests,
  classifications,
  initialEvents,
  sessionOutcome,
}: SessionViewProps) {
  const [orderedTests, setOrderedTests] = useState<OrderedTest[]>(() =>
    initialEvents
      .filter((e) => e.validatorResult !== 'critical_miss')
      .flatMap((e) => {
        const test = tests.find((t) => t.id === e.testId);
        if (!test) return [];
        const category = classifications[e.testId] ?? 'unnecessary';
        return [
          {
            testId: e.testId,
            name: test.name,
            validatorResult: e.validatorResult,
            category,
          },
        ];
      }),
  );

  const [sessionState, setSessionState] = useState(sessionOutcome);

  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const elapsed = Math.floor(
      (Date.now() - new Date(startedAt).getTime()) / 1000,
    );
    return Math.max(0, timeLimitSeconds - elapsed);
  });

  const [skippedCritical, setSkippedCritical] = useState<string[]>(() => {
    if (sessionOutcome !== 'in_progress') {
      return initialEvents
        .filter((e) => e.validatorResult === 'critical_miss')
        .map((e) => e.testId);
    }
    return [];
  });

  const [loadingTestId, setLoadingTestId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const endingRef = useRef(false);

  const { setNodeRef: setRightColumnRef, isOver: isOverRightColumn } =
    useDroppable({
      id: 'right-column',
    });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (sessionState !== 'in_progress') return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionState]);

  useEffect(() => {
    if (remainingSeconds === 0 && sessionState === 'in_progress') {
      handleEndSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  async function handleEndSession() {
    if (endingRef.current) return;
    endingRef.current = true;
    setIsEnding(true);
    try {
      const result = await endSessionAction(sessionId);
      if (result.outcome) {
        setSessionState(result.outcome);
        setSkippedCritical(result.skippedCritical ?? []);
      } else {
        endingRef.current = false;
        setIsEnding(false);
      }
    } catch {
      endingRef.current = false;
      setIsEnding(false);
    }
  }

  async function handleSelectTest(testId: string, testName: string) {
    if (loadingTestId || sessionState !== 'in_progress') return;
    setSelectError(null);
    setLoadingTestId(testId);
    try {
      const result = await selectTestAction(sessionId, testId);
      if (result.error) {
        setSelectError(result.error);
      } else if (result.validatorResult && result.category) {
        setOrderedTests((prev) => [
          ...prev,
          {
            testId,
            name: testName,
            validatorResult: result.validatorResult!,
            category: result.category!,
          },
        ]);
      }
    } finally {
      setLoadingTestId(null);
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
    setActiveName(active.data.current?.name ?? null);
    setActiveSource(active.data.current?.source ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setActiveName(null);
    setActiveSource(null);
    if (loadingTestId || sessionState !== 'in_progress') return;

    const source = active.data.current?.source;

    if (source === 'available') {
      // The drag gesture itself is the selection intent — no valid droppable
      // is needed on the right column because collision detection returns null
      // when the right column is empty.
      handleSelectTest(
        active.id as string,
        active.data.current?.name ?? '',
      ).catch(console.error);
      return;
    }

    // Within-right reorder: needs a valid sortable target
    if (!over || source !== 'ordered' || active.id === over.id) return;
    setOrderedTests((prev) =>
      applyReorder(prev, active.id as string, over.id as string),
    );
  }

  const orderedTestIds = useMemo(
    () => new Set(orderedTests.map((t) => t.testId)),
    [orderedTests],
  );
  const unorderedTests = useMemo(
    () => tests.filter((t) => !orderedTestIds.has(t.id)),
    [tests, orderedTestIds],
  );
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  if (sessionState !== 'in_progress') {
    const isPositive = sessionState === 'positive';
    const skippedNames = skippedCritical.map(
      (id) => tests.find((t) => t.id === id)?.name ?? id,
    );

    return (
      <main className={styles.resultWrapper}>
        <h1>Sesja zakończona</h1>
        <div className={styles.result}>
          <p className={styles.outcome}>
            Wynik:
            {isPositive ? (
              <span className={styles.resultBadge} data-positive={isPositive}>
                Pozytywny <CircleCheck />
              </span>
            ) : (
              <span className={styles.resultBadge} data-positive={isPositive}>
                Negatywny <CircleX />
              </span>
            )}
          </p>
          {skippedNames.length > 0 && (
            <div className={styles.skipped}>
              <p>Pominięte badania krytyczne:</p>
              <ul>
                {skippedNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          <Link href='/dashboard' className={styles.backLink}>
            <ChevronLeft size={16} aria-hidden='true' />
            Wróć do panelu
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.session}>
      <div className={styles.header}>
        <span className={styles.timer} data-urgent={remainingSeconds < 60}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        <Button variant='danger' onClick={handleEndSession} disabled={isEnding}>
          {isEnding ? (
            <>
              <Spinner size='sm' /> Kończenie…
            </>
          ) : (
            'Zakończ sesję'
          )}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.columns}>
          <section className={styles.column}>
            <h2>Dostępne badania ({unorderedTests.length})</h2>
            {selectError && <p className={styles.selectError}>{selectError}</p>}
            <div className={styles.testList}>
              {unorderedTests.map((test) => (
                <DraggableTestCard
                  key={test.id}
                  testId={test.id}
                  name={test.name}
                  onSelect={() => handleSelectTest(test.id, test.name)}
                  isLoading={loadingTestId === test.id}
                />
              ))}
            </div>
          </section>

          <section ref={setRightColumnRef} className={styles.column}>
            <h2>Zlecone badania ({orderedTests.length})</h2>
            <div
              className={styles.testList}
              data-drop-target={activeSource === 'available'}
              data-is-over={isOverRightColumn && activeSource === 'available'}
            >
              <SortableContext
                items={orderedTests.map((t) => t.testId)}
                strategy={verticalListSortingStrategy}
              >
                {orderedTests.map((test) => (
                  <SortableTestCard
                    key={test.testId}
                    testId={test.testId}
                    name={test.name}
                    validatorResult={test.validatorResult}
                  />
                ))}
              </SortableContext>
            </div>
          </section>
        </div>

        <DragOverlay>
          {activeId ? <TestCard name={activeName ?? ''} /> : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
