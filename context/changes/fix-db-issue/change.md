---
change_id: fix-db-issue
title:
  Fix unstable Supabase DB communication from Cloudflare Worker (hung-request
  errors)
status: implemented
created: 2026-06-17
updated: 2026-06-18
archived_at: null
---

## Notes

Database URL is now confirmed correct (validated by manual research). The
remaining problem is runtime instability in production: communication with the
Supabase DB fails intermittently, many requests cannot complete or must be
retried several times.

Recurring error:

> Error: The Workers runtime canceled this request because it detected that your
> Worker's code had hung and would never generate a response.
> https://developers.cloudflare.com/workers/observability/errors/

Reference: similar problem reported in TanStack Router issue #5323, with a
well-rated solution comment:

- https://github.com/TanStack/router/issues/5323
- https://github.com/TanStack/router/issues/5323#issuecomment-3548779998

Goal: research whether a similar fix can resolve the Next.js-on-Cloudflare ↔
Supabase communication issue. Related prior context: prod DB connection required
Hyperdrive (workerd does not trust Supabase certs over raw sockets); see memory
project-prod-db-connection.

## Resolution (2026-06-18)

**Co było problemem ostatecznie:** `src/shared/lib/db.ts` trzymał klienta
postgres-js jako **singleton na poziomie modułu**
(`const client = postgres(...)`

- `export const db`). Na Cloudflare Workers (workerd) socket TCP otwarty w
  kontekście I/O jednego requestu był reużywany w kolejnym requeście — czego
  workerd zabrania. Zapytanie nigdy się nie kończyło, handler wisiał, a runtime
  kasował request z błędem „code had hung". Lokalnie (Node) nie występowało, bo
  Node nie izoluje I/O per-request. Wbrew wcześniejszej hipotezie **Hyperdrive
  NIE był potrzebny** — to nie była warstwa transportu/TLS, tylko cykl życia
  klienta.

**Jak rozwiązane:** zamieniono singleton na fabrykę **per-request `getDb()`**
opartą o React `cache()` (jeden klient w obrębie requestu, świeży w następnym —
dokładnie izolacja, której wymaga workerd). Wszyscy konsumenci (RSC, server
actions, `registerUser`, seedy) pobierają klienta przez `getDb()`; NextAuth
przeszedł na lazy config factory `NextAuth(() => ({…}))` z adapterem i
`authorize` na `getDb()`, po czym usunięto singleton. Dodano hardening
połączenia
(`max:3, prepare:false, fetch_types:false, connect_timeout:10, idle_timeout:20`).
Zweryfikowane na workerd: `preview` lokalnie i po `deploy` na prod — trzy
przepływy (dashboard → sesja → zlecanie badań) działają, w Workers Logs brak
„code had hung".

**Commity:** Faza 1 `a541269`, Faza 2 `e7933c7`, hardening `465fca1`.

**Follow-up (poza tym change):** sekret prod `DATABASE_URL` warto przełączyć na
pooler **port 6543** (transaction mode — `prepare:false` jest pod niego; było
5432/session). Hyperdrive pozostaje opcjonalną przyszłą optymalizacją.
