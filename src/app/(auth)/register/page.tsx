import type { Metadata } from "next"
import { RegisterForm } from "@/modules/auth/components"

export const metadata: Metadata = {
  title: "Rejestracja — OSCE Triager",
}

export default function RegisterPage() {
  return <RegisterForm />
}
