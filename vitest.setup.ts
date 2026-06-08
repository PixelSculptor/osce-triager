import dotenv from 'dotenv'

dotenv.config({ path: '.env.test', override: true, quiet: true })

// Point db.ts at the test schema when DATABASE_URL_TEST is configured.
// setupFiles run before test-file imports, so db.ts picks up the overridden
// DATABASE_URL when it is first loaded.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
}
