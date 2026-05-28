import { auth } from "@/modules/auth/auth"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Logged in as: {session?.user?.email}</p>
    </main>
  )
}
