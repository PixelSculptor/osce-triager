import { redirect } from 'next/navigation';
import { auth } from '@/modules/auth/auth';
import { getUserSessions } from '@/modules/session/queries';
import { HistoryFilter } from '@/modules/session/components/HistoryFilter/HistoryFilter';
import styles from './page.module.css';
import { EmptyHistory } from '@/modules/session/components/EmptyHistory/EmptyHistory';

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const sessions = await getUserSessions(session.user.id);
  const completed = sessions
    .filter((s) => s.completedAt !== null)
    .map((s) => ({
      id: s.id,
      scenarioTitle: s.scenarioTitle,
      outcome: s.outcome as 'positive' | 'negative',
      startedAt: s.startedAt,
      completedAt: s.completedAt!,
    }));

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Historia sesji</h1>
      {completed.length === 0 ? (
        <EmptyHistory />
      ) : (
        <HistoryFilter sessions={completed} />
      )}
    </main>
  );
}
