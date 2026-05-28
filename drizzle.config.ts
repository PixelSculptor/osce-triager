import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env.local", override: false })

export default defineConfig({
  schema: "./src/shared/lib/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
