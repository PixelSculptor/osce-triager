"use client"

import { cancelDeletionAction } from "@/modules/account/actions"

export function CancelDeletionSection({ deletionDate }: { deletionDate: Date }) {
  const purgeDate = new Date(deletionDate)
  purgeDate.setDate(purgeDate.getDate() + 30)

  return (
    <section style={{ marginTop: "2rem" }}>
      <div style={{ padding: "1rem", border: "1px solid #f59e0b", borderRadius: "6px", background: "rgba(245,158,11,0.1)", marginBottom: "1rem" }}>
        <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Konto zaplanowane do usunięcia</p>
        <p style={{ fontSize: "0.875rem", opacity: 0.8 }}>
          Twoje konto zostanie trwale usunięte{" "}
          <strong>{purgeDate.toLocaleDateString("pl-PL")}</strong>. Możesz anulować do tego czasu.
        </p>
      </div>
      <form>
        <button
          formAction={cancelDeletionAction}
          style={{
            padding: "0.5rem 1rem",
            background: "none",
            border: "1px solid rgba(128,128,128,0.4)",
            borderRadius: "4px",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Anuluj usunięcie
        </button>
      </form>
    </section>
  )
}
