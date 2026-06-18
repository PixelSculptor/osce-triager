import { cache } from 'react';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Per-request DB client (workerd-safe). React cache() memoizes per request, so
// the whole client (postgres-js socket + drizzle) is built once per request and
// fresh on the next — a TCP socket opened in one request's I/O context is never
// reused in another, which is what workerd forbids. Outside a request (Node
// tests, seed) cache() simply returns a fresh client on each call.
export const getDb: () => PostgresJsDatabase<typeof schema> = cache(() =>
  drizzle(
    postgres(process.env.DATABASE_URL!, {
      max: 3,
      prepare: false,
      fetch_types: false,
      connect_timeout: 10,
      // Self-close idle sockets. In workerd the request-scoped I/O is torn down
      // anyway; this matters for long-lived Node hosts (`next dev`, tests) where
      // per-request cache() pools would otherwise linger and exhaust the local
      // Postgres connection slots.
      idle_timeout: 20,
    }),
    { schema },
  ),
);
