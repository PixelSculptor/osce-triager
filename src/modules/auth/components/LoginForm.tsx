"use client"

import { useActionState } from "react"
import Link from "next/link"
import { loginAction } from "@/modules/auth/actions"
import { SubmitButton } from "./SubmitButton"
import styles from "./LoginForm.module.css"

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, null)

  return (
    <form className={styles.form} action={formAction}>
      <h1 className={styles.title}>Logowanie</h1>

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
          autoComplete="current-password"
        />
        {state?.errors?.password && (
          <p className={styles.fieldError}>{state.errors.password}</p>
        )}
      </div>

      {state?.errors?._form && (
        <p className={styles.formError}>{state.errors._form}</p>
      )}

      <div className={styles.submit}>
        <SubmitButton loadingLabel="Logowanie…">Zaloguj się</SubmitButton>
      </div>

      <p className={styles.footer}>
        Nie masz konta?{" "}
        <Link href="/register">Zarejestruj się</Link>
      </p>
    </form>
  )
}
