"use client"

import { useActionState, useState } from "react"
import { requestDeletionAction, type AccountActionState } from "@/modules/account/actions"

export function DeleteAccountSection() {
  const [inputValue, setInputValue] = useState("")
  const [state, formAction] = useActionState<AccountActionState, FormData>(
    requestDeletionAction,
    null
  )

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2>Usuń konto</h2>
      <p style={{ marginBottom: "1rem", opacity: 0.8 }}>
        Twoje konto zostanie trwale usunięte po 30 dniach. W tym czasie możesz anulować żądanie.
      </p>
      <form action={formAction}>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="confirmation" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
            Wpisz <strong>DELETE</strong> aby potwierdzić:
          </label>
          <input
            id="confirmation"
            name="confirmation"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid rgba(128,128,128,0.4)", borderRadius: "4px", width: "100%", maxWidth: "300px" }}
          />
        </div>
        {state?.error && (
          <p style={{ color: "red", marginBottom: "0.5rem", fontSize: "0.875rem" }}>{state.error}</p>
        )}
        {state?.success && (
          <p style={{ color: "green", marginBottom: "0.5rem", fontSize: "0.875rem" }}>Żądanie usunięcia zostało zgłoszone.</p>
        )}
        <button
          type="submit"
          disabled={inputValue !== "DELETE"}
          style={{
            padding: "0.5rem 1rem",
            background: inputValue === "DELETE" ? "#dc2626" : "rgba(128,128,128,0.2)",
            color: inputValue === "DELETE" ? "white" : "rgba(128,128,128,0.6)",
            border: "none",
            borderRadius: "4px",
            cursor: inputValue === "DELETE" ? "pointer" : "not-allowed",
          }}
        >
          Usuń konto
        </button>
      </form>
    </section>
  )
}
