'use client';

import Link from 'next/link';
import { ChevronRight, Timer } from 'lucide-react';
import { DeleteSessionButton } from '../DeleteSessionButton/DeleteSessionButton';
import styles from './HistoryCard.module.css';

interface HistoryCardProps {
  id: string;
  scenarioTitle: string;
  outcome: 'positive' | 'negative';
  startedAt: Date;
  completedAt: Date;
}

export function HistoryCard({
  id,
  scenarioTitle,
  outcome,
  startedAt,
  completedAt,
}: HistoryCardProps) {
  const durationSec = Math.round(
    (completedAt.getTime() - startedAt.getTime()) / 1000,
  );
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const duration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const dateStr = completedAt.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <li className={styles.card}>
      <div className={styles.deleteArea}>
        <DeleteSessionButton
          sessionId={id}
          scenarioTitle={scenarioTitle}
          completedAt={completedAt}
        />
      </div>
      <h3 className={styles.title}>{scenarioTitle}</h3>
      <div className={styles.meta}>
        <span className={`${styles.badge} ${styles[outcome]}`}>
          {outcome === 'positive' ? 'Pozytywny' : 'Negatywny'}
        </span>
        <span>{dateStr}</span>
        <p className={styles.metaItem}>
          <Timer size={16} />
          <span>Czas: {duration}</span>
        </p>
      </div>
      <Link
        href={`/dashboard/session/${id}/details`}
        className={styles.detailsLink}
      >
        Szczegóły
        <ChevronRight size={16} aria-hidden='true' />
      </Link>
    </li>
  );
}
