import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, ChevronDown, Timer } from 'lucide-react';
import { auth } from '@/modules/auth/auth';
import { getSessionDetails } from '@/modules/session/queries';
import styles from './page.module.css';

const VALIDATOR_LABELS: Record<string, string> = {
  correct: 'Prawidłowy',
  suboptimal: 'Suboptymalny',
  unnecessary: 'Zbędny',
  critical_miss: 'Krytyczny brak',
};

const VALIDATOR_CLASS: Record<string, string> = {
  correct: styles.resultCorrect,
  suboptimal: styles.resultSuboptimal,
  unnecessary: styles.resultUnnecessary,
  critical_miss: styles.resultCriticalMiss,
};

function formatDuration(startedAt: Date, completedAt: Date) {
  const totalSeconds = Math.round(
    (completedAt.getTime() - startedAt.getTime()) / 1000,
  );
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export default async function SessionDetailsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const details = await getSessionDetails(sessionId, session.user.id);
  if (!details) notFound();

  return (
    <main className={styles.main}>
      <Link href='/dashboard/history' className={styles.back}>
        <ChevronLeft size={16} aria-hidden='true' />
        Wróć do historii
      </Link>
      <h1 className={styles.heading}>{details.scenarioTitle}</h1>
      <div className={styles.meta}>
        <span
          className={`${styles.badge} ${details.outcome === 'positive' ? styles.badgePositive : styles.badgeNegative}`}
        >
          {details.outcome === 'positive' ? 'Pozytywny' : 'Negatywny'}
        </span>
        <span>{details.completedAt.toLocaleDateString('pl-PL')}</span>
        <p className={styles.metaItem}>
          <Timer size={16} />
          <span>
            Czas: {formatDuration(details.startedAt, details.completedAt)}
          </span>
        </p>
      </div>

      <div className={styles.eventsCard}>
        <h2 className={styles.eventsHeading}>Wybrane badania</h2>
        {details.events.length === 0 ? (
          <p>Brak wybranych badań.</p>
        ) : (
          <>
            <p className={styles.orderHint}>
              <ChevronDown size={16} aria-hidden='true' />
              kolejność zlecania (od pierwszego do ostatniego)
            </p>
            <ol className={styles.eventList} role='list'>
              {details.events.map((event, index) => (
                <li
                  key={`${event.testId}-${event.selectedAt.getTime()}`}
                  className={styles.eventItem}
                  data-result={event.validatorResult}
                >
                  <span className={styles.eventOrder}>{index + 1}</span>
                  <span className={styles.eventName}>{event.testName}</span>
                  <span className={VALIDATOR_CLASS[event.validatorResult]}>
                    {VALIDATOR_LABELS[event.validatorResult]}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </main>
  );
}
