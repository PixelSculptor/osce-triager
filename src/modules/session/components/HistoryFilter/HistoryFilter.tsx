'use client';

import { useState } from 'react';
import { HistoryCard } from '../HistoryCard/HistoryCard';
import styles from './HistoryFilter.module.css';

type FilterValue = 'all' | 'positive' | 'negative';

interface SessionItem {
  id: string;
  scenarioTitle: string;
  outcome: 'positive' | 'negative';
  startedAt: Date;
  completedAt: Date;
}

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'positive', label: 'Pozytywne' },
  { value: 'negative', label: 'Negatywne' },
];

export function HistoryFilter({ sessions }: { sessions: SessionItem[] }) {
  const [filter, setFilter] = useState<FilterValue>('all');

  const filtered =
    filter === 'all' ? sessions : sessions.filter((s) => s.outcome === filter);

  return (
    <>
      <div
        role='group'
        aria-label='Filtruj wyniki'
        className={styles.filterGroup}
      >
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type='button'
            className={styles.filterBtn}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className={styles.empty}>Brak sesji dla wybranego filtra.</p>
      ) : (
        <ul className={styles.list}>
          {filtered.map((s) => (
            <HistoryCard
              key={s.id}
              id={s.id}
              scenarioTitle={s.scenarioTitle}
              outcome={s.outcome}
              startedAt={s.startedAt}
              completedAt={s.completedAt}
            />
          ))}
        </ul>
      )}
    </>
  );
}
