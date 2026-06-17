import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// prepare: false — required for Supabase PgBouncer transaction mode pooler
// connect_timeout: 15 — allow a cold Worker isolate enough time for the
//   socket + TLS handshake to Supabase (5s proved too aggressive on cold start)
// connection.statement_timeout — hard server-side per-query cap in ms
//   (< Worker budget) so a dead/recycled PgBouncer connection turns a hang
//   (Error 1101) into a catchable error
// max: 1 — one connection per Worker isolate (Workers are stateless)
// ssl: {} for remote Supabase, false for local dev/CI (127.0.0.1). An empty
//   object enables TLS with normal cert verification but never sets
//   rejectUnauthorized — on Cloudflare Workers postgres.js's Node build maps
//   ssl:'require' to rejectUnauthorized, which workerd's tls.connect rejects
//   (ERR_OPTION_NOT_IMPLEMENTED). The Supavisor pooler presents a valid public
//   cert, so default verification passes.
const dbUrl = process.env.DATABASE_URL ?? '';
const isLocal = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');

// Diagnostic: log the resolved target (host:port, never the password) once per
// isolate so the Worker logs show exactly what DATABASE_URL points at.
try {
  const parsed = new URL(dbUrl);
  console.log(
    `[db] target ${parsed.hostname}:${parsed.port || '5432'} ssl=${!isLocal}`,
  );
} catch {
  console.error('[db] DATABASE_URL is missing or not a valid URL');
}

const client = postgres(dbUrl, {
  prepare: false,
  ssl: isLocal ? false : {},
  connect_timeout: 15,
  connection: { statement_timeout: 8000 },
  idle_timeout: 20,
  max: 1,
  // Skip pg_type discovery query on first connect — avoids a second round-trip
  // that can hang in Cloudflare Workers when the TCP handshake is slow.
  fetch_types: false,
});

export const db = drizzle(client, { schema });
