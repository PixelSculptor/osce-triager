import { redirect } from "next/navigation"
import { auth } from "@/modules/auth/auth"
import { ScenarioCard } from "@/modules/session/components"
import { getScenarios } from "@/modules/session/queries"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const scenarioList = await getScenarios()

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Panel studenta</h1>
      <ul style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: 0, marginTop: "1.5rem" }}>
        {scenarioList.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            id={scenario.id}
            title={scenario.title}
            description={scenario.description}
            timeLimitSeconds={scenario.timeLimitSeconds}
          />
        ))}
      </ul>
    </main>
  )
}
