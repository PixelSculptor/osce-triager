import { redirect } from 'next/navigation';
import { auth } from '@/modules/auth/auth';
import { ScenarioCard } from '@/modules/session/components';
import { getScenarios } from '@/modules/session/queries';
import styles from './page.module.css';

export default async function DashboardPage() {
  let session = null;
  try {
    session = await auth();
  } catch (e) {
    console.error('[DashboardPage] auth() threw:', e);
  }
  if (!session) redirect('/login');

  const scenarioList = await getScenarios();

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Panel studenta</h1>
      <ul className={styles.list}>
        {scenarioList.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            id={scenario.id}
            title={scenario.title}
            description={scenario.description}
            timeLimitSeconds={scenario.timeLimitSeconds}
          />
        ))}
      </ul>
    </main>
  );
}
