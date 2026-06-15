import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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
      <h3 className={styles.title}>{scenarioTitle}</h3>
      <div className={styles.meta}>
        <span className={`${styles.badge} ${styles[outcome]}`}>
          {outcome === 'positive' ? 'Pozytywny' : 'Negatywny'}
        </span>
        <span>{dateStr}</span>
        <span>Czas: {duration}</span>
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
