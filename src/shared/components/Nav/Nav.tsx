import Link from 'next/link';
import { auth } from '@/modules/auth/auth';
import { NavLinks } from './NavLinks';
import styles from './Nav.module.css';

export async function Nav() {
  let session = null;
  try {
    session = await auth();
  } catch (e) {
    console.error('[Nav] auth() threw:', e);
  }

  return (
    <nav className={styles.nav} aria-label='Nawigacja główna'>
      <Link href='/' className={styles.logo}>
        OSCE Triager
      </Link>
      <div className={styles.links}>
        <NavLinks isLoggedIn={!!session} email={session?.user?.email} />
      </div>
    </nav>
  );
}
