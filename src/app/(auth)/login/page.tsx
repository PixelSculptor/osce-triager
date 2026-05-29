import type { Metadata } from "next"
import { LoginForm } from "@/modules/auth/components"

export const metadata: Metadata = {
  title: "Logowanie — OSCE Triager",
}

export default function LoginPage() {
  return <LoginForm />
}
