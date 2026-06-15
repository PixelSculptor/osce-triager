'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/modules/auth/actions';
import { Button } from '@/shared/components/Button/Button';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import styles from './Nav.module.css';

interface NavLinksProps {
  isLoggedIn: boolean;
  email?: string | null;
}

export function NavLinks({ isLoggedIn, email }: NavLinksProps) {
  const pathname = usePathname();

  if (isLoggedIn) {
    return (
      <>
        {email && <span className={styles.email}>{email}</span>}
        <Link
          href='/dashboard'
          className={styles.navLink}
          aria-current={pathname === '/dashboard' ? 'page' : undefined}
        >
          Pulpit
        </Link>
        <Link
          href='/dashboard/history'
          className={styles.navLink}
          aria-current={
            pathname === '/dashboard/history' ||
            pathname.startsWith('/dashboard/history/')
              ? 'page'
              : undefined
          }
        >
          Historia
        </Link>
        <Link
          href='/account/settings'
          className={styles.navLink}
          aria-current={
            pathname.startsWith('/account/settings') ? 'page' : undefined
          }
        >
          Ustawienia
        </Link>
        <ThemeToggle />
        <form>
          <Button variant='ghost' size='sm' formAction={logoutAction}>
            Wyloguj
          </Button>
        </form>
      </>
    );
  }

  return <ThemeToggle />;
}
