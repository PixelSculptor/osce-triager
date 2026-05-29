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
