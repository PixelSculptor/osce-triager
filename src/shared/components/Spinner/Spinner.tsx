import styles from "./Spinner.module.css"

interface SpinnerProps {
  size?: "sm" | "md"
}

export function Spinner({ size = "sm" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Ładowanie"
      className={size === "md" ? `${styles.spinner} ${styles.md}` : styles.spinner}
    />
  )
}
