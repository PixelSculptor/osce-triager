import { auth } from "@/modules/auth/auth"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Panel studenta</h1>
      <p>{session?.user?.email}</p>
    </main>
  )
}
