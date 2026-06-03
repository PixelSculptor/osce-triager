"use client"

import { useFormStatus } from "react-dom"
import { Spinner } from "@/shared/components/Spinner/Spinner"

interface SubmitButtonProps {
  children: React.ReactNode
  loadingLabel?: string
}

export function SubmitButton({ children, loadingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      style={pending ? { display: "inline-flex", alignItems: "center", gap: "0.375rem" } : undefined}
    >
      {pending ? (
        <>
          <Spinner size="sm" />
          {loadingLabel ?? "Proszę czekać…"}
        </>
      ) : children}
    </button>
  )
}
