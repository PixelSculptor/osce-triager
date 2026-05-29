"use client"

import { useFormStatus } from "react-dom"

interface SubmitButtonProps {
  children: React.ReactNode
  loadingLabel?: string
}

export function SubmitButton({ children, loadingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? (loadingLabel ?? "Proszę czekać…") : children}
    </button>
  )
}
