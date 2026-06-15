'use client';

import { cancelDeletionAction } from '@/modules/account/actions';
import styles from './CancelDeletionSection.module.css';

export function CancelDeletionSection({
  deletionDate,
}: {
  deletionDate: Date;
}) {
  const purgeDate = new Date(deletionDate);
  purgeDate.setDate(purgeDate.getDate() + 30);

  return (
    <section className={styles.section}>
      <div className={styles.warningBanner}>
        <p className={styles.bannerTitle}>Konto zaplanowane do usunięcia</p>
        <p className={styles.bannerText}>
          Twoje konto zostanie trwale usunięte{' '}
          <strong>{purgeDate.toLocaleDateString('pl-PL')}</strong>. Możesz
          anulować do tego czasu.
        </p>
      </div>
      <form>
        <button
          formAction={cancelDeletionAction}
          className={styles.cancelButton}
        >
          Anuluj usunięcie
        </button>
      </form>
    </section>
  );
}
