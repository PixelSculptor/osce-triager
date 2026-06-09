import Link from "next/link"
import { auth } from "@/modules/auth/auth"
import { logoutAction } from "@/modules/auth/actions"
import styles from "./Nav.module.css"

export async function Nav() {
  const session = await auth()

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.logo}>
        OSCE Triager
      </Link>

      <div className={styles.links}>
        {session ? (
          <>
            <span className={styles.email}>{session.user?.email}</span>
            <Link href="/dashboard/history" className={styles.settingsLink}>Historia</Link>
            <Link href="/account/settings" className={styles.settingsLink}>Ustawienia</Link>
            <form>
              <button
                className={styles.logoutButton}
                formAction={logoutAction}
              >
                Wyloguj
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login">Zaloguj się</Link>
            <Link href="/register">Zarejestruj się</Link>
          </>
        )}
      </div>
    </nav>
  )
}
