import Link from "next/link"
import { auth } from "@/modules/auth/auth"
import styles from "./page.module.css"

export default async function HomePage() {
  const session = await auth()

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.heading}>OSCE Triager</h1>
        <p className={styles.description}>
          Interaktywny symulator ścieżki diagnostycznej OSCE. Ćwicz kliniczne
          podejmowanie decyzji w realistycznych scenariuszach pacjentów.
        </p>

        {session ? (
          <>
            <p className={styles.welcome}>
              Witaj, {session.user?.email}
            </p>
            <div className={styles.ctas}>
              <Link href="/dashboard" className={styles.primaryBtn}>
                Przejdź do Pulpitu
              </Link>
            </div>
          </>
        ) : (
          <div className={styles.ctas}>
            <Link href="/login" className={styles.primaryBtn}>
              Zaloguj się
            </Link>
            <Link href="/register" className={styles.secondaryBtn}>
              Zarejestruj się
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
