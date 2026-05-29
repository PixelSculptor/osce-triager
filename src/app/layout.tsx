import type { Metadata } from "next"
import { Nav } from "@/shared/components/Nav"
import "./globals.css"

export const metadata: Metadata = {
  title: "OSCE Triager",
  description: "Interaktywny symulator ścieżki diagnostycznej OSCE",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  )
}
