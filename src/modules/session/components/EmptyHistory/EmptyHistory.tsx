import Link from 'next/link';
import styles from './EmptyHistory.module.css';
import { ChevronRight } from 'lucide-react';

export function EmptyHistory() {
  return (
    <div className={styles.emptyContainer}>
      <p className={styles.banner}>Brak zakończonych sesji.</p>
      <Link href='/dashboard' className={styles.backToTests}>
        Lista testów
        <ChevronRight size={16} aria-hidden='true' />
      </Link>
    </div>
  );
}
