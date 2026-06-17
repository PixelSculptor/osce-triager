import { redirect } from 'next/navigation';
import { auth } from '@/modules/auth/auth';
import { getAccountSettings } from '@/modules/account/queries';
import { DeleteAccountSection } from './DeleteAccountSection';
import { CancelDeletionSection } from './CancelDeletionSection';
import styles from './page.module.css';

export default async function SettingsPage() {
  let session = null;
  try {
    session = await auth();
  } catch (e) {
    console.error('[SettingsPage] auth() threw:', e);
  }
  if (!session) redirect('/login');

  const user = await getAccountSettings(session.user!.id!);

  return (
    <main className={styles.main}>
      <h1>Ustawienia konta</h1>
      {user?.deletionRequestedAt ? (
        <CancelDeletionSection deletionDate={user.deletionRequestedAt} />
      ) : (
        <DeleteAccountSection />
      )}
    </main>
  );
}
