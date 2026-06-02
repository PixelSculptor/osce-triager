import { redirect } from "next/navigation"
import { auth } from "@/modules/auth/auth"
import { getAccountSettings } from "@/modules/account/queries"
import { DeleteAccountSection } from "./DeleteAccountSection"
import { CancelDeletionSection } from "./CancelDeletionSection"

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const user = await getAccountSettings(session.user!.id!)

  return (
    <main style={{ padding: "2rem", maxWidth: "600px" }}>
      <h1>Ustawienia konta</h1>
      {user?.deletionRequestedAt ? (
        <CancelDeletionSection deletionDate={user.deletionRequestedAt} />
      ) : (
        <DeleteAccountSection />
      )}
    </main>
  )
}
