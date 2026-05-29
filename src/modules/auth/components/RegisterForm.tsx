"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { registerAction } from "@/modules/auth/actions"
import { SubmitButton } from "./SubmitButton"
import styles from "./RegisterForm.module.css"

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value
    const confirmPassword = (
      form.elements.namedItem("confirmPassword") as HTMLInputElement
    ).value

    if (password !== confirmPassword) {
      event.preventDefault()
      setConfirmError("Hasła nie są identyczne")
      return
    }

    setConfirmError(null)
  }

  return (
    <form className={styles.form} action={formAction} onSubmit={handleSubmit}>
      <h1 className={styles.title}>Rejestracja</h1>

      <div className={styles.field}>
        <label htmlFor="email">Adres email</label>
        <input id="email" name="email" type="email" autoComplete="email" />
        {state?.errors?.email && (
          <p className={styles.fieldError}>{state.errors.email}</p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="password">Hasło</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        {state?.errors?.password && (
          <p className={styles.fieldError}>{state.errors.password}</p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="confirmPassword">Potwierdź hasło</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
        />
        {confirmError && (
          <p className={styles.fieldError}>{confirmError}</p>
        )}
      </div>

      {state?.errors?._form && (
        <p className={styles.formError}>{state.errors._form}</p>
      )}

      <div className={styles.submit}>
        <SubmitButton loadingLabel="Rejestracja…">Zarejestruj się</SubmitButton>
      </div>

      <p className={styles.footer}>
        Masz już konto?{" "}
        <Link href="/login">Zaloguj się</Link>
      </p>
    </form>
  )
}
