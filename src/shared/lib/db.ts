import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// prepare: false — required for Supabase PgBouncer transaction mode pooler
// connect_timeout — fail fast instead of hanging the Worker indefinitely
// max: 1 — one connection per Worker isolate (Workers are stateless)
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  connect_timeout: 10,
  idle_timeout: 20,
  max: 1,
});

export const db = drizzle(client, { schema });
