import { redirect } from "next/navigation"
import { auth } from "@/modules/auth/auth"
import { HistoryCard } from "@/modules/session/components"
import { getUserSessions } from "@/modules/session/queries"
import styles from "./page.module.css"

export default async function HistoryPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const sessions = await getUserSessions(session.user.id)

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Historia sesji</h1>
      {sessions.length === 0 ? (
        <p className={styles.empty}>Brak zakończonych sesji.</p>
      ) : (
        <ul className={styles.list}>
          {sessions.map((s) => (
            <HistoryCard
              key={s.id}
              id={s.id}
              scenarioTitle={s.scenarioTitle}
              outcome={s.outcome as "positive" | "negative"}
              startedAt={s.startedAt}
              completedAt={s.completedAt!}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
