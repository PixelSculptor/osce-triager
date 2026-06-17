import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// prepare: false — required for Supabase PgBouncer transaction mode pooler
// connect_timeout — fail fast instead of hanging the Worker indefinitely
// max: 1 — one connection per Worker isolate (Workers are stateless)
// ssl: 'require' for remote Supabase; false for local dev/CI (127.0.0.1)
const dbUrl = process.env.DATABASE_URL ?? '';
const client = postgres(dbUrl, {
  prepare: false,
  ssl:
    dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost')
      ? false
      : 'require',
  connect_timeout: 10,
  idle_timeout: 20,
  max: 1,
});

export const db = drizzle(client, { schema });
