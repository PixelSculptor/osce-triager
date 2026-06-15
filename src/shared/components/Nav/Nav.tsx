import Link from 'next/link';
import { auth } from '@/modules/auth/auth';
import { logoutAction } from '@/modules/auth/actions';
import { Button } from '@/shared/components/Button/Button';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import styles from './Nav.module.css';

export async function Nav() {
  const session = await auth();

  return (
    <nav className={styles.nav} aria-label='Nawigacja główna'>
      <Link href='/' className={styles.logo}>
        OSCE Triager
      </Link>

      <div className={styles.links}>
        {session ? (
          <>
            <span className={styles.email}>{session.user?.email}</span>
            <Link href='/dashboard/history' className={styles.settingsLink}>
              Historia
            </Link>
            <Link href='/account/settings' className={styles.settingsLink}>
              Ustawienia
            </Link>
            <form>
              <Button variant='ghost' size='sm' formAction={logoutAction}>
                Wyloguj
              </Button>
            </form>
          </>
        ) : (
          <>
            <Link href='/login'>Zaloguj się</Link>
            <Link href='/register'>Zarejestruj się</Link>
          </>
        )}
        <ThemeToggle />
      </div>
    </nav>
  );
}
