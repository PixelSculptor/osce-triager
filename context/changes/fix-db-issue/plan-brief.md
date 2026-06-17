# Per-request DB client (fix "Worker hung") — Krótki plan

> Pełny plan: `context/changes/fix-db-issue/plan.md` Badania:
> `context/changes/fix-db-issue/research.md`

## Co i dlaczego

Produkcja (Cloudflare Workers / OpenNext) zwraca `Worker's code had hung`, bo
`src/shared/lib/db.ts` trzyma **module-level singleton** klienta postgres-js:
socket utworzony w kontekście I/O jednego requestu jest reużywany w kolejnym,
czego `workerd` zabrania → handler wisi. Zamieniamy singleton na **fabrykę
per-request** `getDb()`.

## Punkt wyjścia

`db.ts` eksportuje
`db = drizzle(postgres(process.env.DATABASE_URL!, { prepare: false }))` na
poziomie modułu; importuje go 8 plików (auth, user.util, account ×2, session ×2,
2 testy). Strategia auth to JWT + Credentials, więc DrizzleAdapter jest w
runtime uśpiony, ale i tak przechwytuje singleton. Lokalnie błąd nie występuje
(Node nie izoluje I/O per-request).

## Pożądany stan końcowy

`db.ts` eksportuje wyłącznie `getDb()` (React `cache()` → jeden klient na
request, świeży w następnym). Każda ścieżka serwerowa pobiera klienta przez
`getDb()`. Trzy przepływy (dashboard → wejście w sesję → zlecanie badań)
działają na workerd bez zawieszeń i bez błędu "hung" w Cloudflare logs.

## Kluczowe podjęte decyzje

| Decyzja            | Wybór                                                                          | Dlaczego                                                         | Źródło  |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------- |
| Wzorzec klienta    | `getDb = cache(() => drizzle(postgres(...)))`                                  | `cache()` memoizuje per-request — dokładnie izolacja I/O workerd | Badania |
| Higiena połączenia | `max:3, prepare:false, fetch_types:false, connect_timeout:10`, bez `sql.end()` | Szybkie failowanie, mniej ryzyka niż jawne zamykanie             | Plan    |
| Źródło env         | `process.env.DATABASE_URL` w fabryce                                           | Minimalna zmiana, `nodejs_compat` włączony, działa w testach     | Plan    |
| NextAuth           | Lazy factory `NextAuth(req => ({…}))` + `getDb()`                              | Eksporty stabilne, adapter per-request, bez socketu na top-level | Badania |
| Połykane błędy     | Dodać `console.error` w `start/selectTestAction`                               | Bez logu prawdziwa przyczyna niewidoczna w Workers Logs          | Plan    |
| Weryfikacja        | `preview` (workerd) + deploy na prod                                           | Lokalny Node nie odtwarza błędu                                  | Plan    |
| Hyperdrive         | Poza zakresem                                                                  | Osobna warstwa transportu/TLS                                    | Plan    |

## Zakres

**W zakresie:** `db.ts` → `getDb()`; migracja 8 konsumentów + 2 testów;
lazy-init NextAuth; logowanie w 2 blokach catch; weryfikacja preview+prod.

**Poza zakresem:** Hyperdrive, zmiana `DATABASE_URL`/poolera,
`auth.config.ts`/`middleware.ts`, migracje schematu, `sql.end()`/`waitUntil`,
zmiana logiki zapytań.

## Architektura / Podejście

`db.ts` udostępnia `getDb()` (cache-wrapped factory). RSC, server actions, route
handlery i adapter NextAuth wołają `getDb()` w obrębie własnego requestu —
postgres-js otwiera socket leniwie przy pierwszym zapytaniu, w tym samym
kontekście I/O, który go zużywa. NextAuth przechodzi na formę funkcyjną, by
adapter budował się per-request przy stabilnych eksportach.

## Fazy w skrócie

| Faza                                    | Co dostarcza                                                              | Kluczowe ryzyko                                                  |
| --------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Fabryka + konsumenci nie-auth        | `getDb()` + migracja 6 plików/2 testów + logowanie; `db` chwilowo zostaje | Testy integracyjne muszą przejść na `getDb()`                    |
| 2. NextAuth lazy + usunięcie singletonu | `auth.ts` funkcyjny; `export const db` usunięty                           | Forma funkcyjna musi zwracać pełny config przy `req===undefined` |
| 3. Weryfikacja workerd                  | Smoke na preview + deploy prod, brak "hung"                               | Bez Hyperdrive może wyjść TLS/cert na prod (osobna zmiana)       |

**Wymagania wstępne:** poprawny `DATABASE_URL` (Supavisor pooler) w sekretach CF
— już ustawiony. **Szacowany nakład pracy:** ~1-2 sesje, 3 fazy (2 kodowe +
weryfikacja).

## Otwarte ryzyka i założenia

- Bez Hyperdrive na prod może ujawnić się błąd TLS/cert (nie "hung") — to inny
  problem, potwierdza potrzebę Hyperdrive jako kolejnej zmiany.
- Założenie: `process.env.DATABASE_URL` jest zasilane w request scope na workerd
  (potwierdzone przez `nodejs_compat`).
- `cache()` poza request scope (testy) tworzy świeżego klienta — akceptowalne.

## Kryteria sukcesu (podsumowanie)

- `grep -rn "import { db }" src` pusto; `db.ts` eksportuje tylko `getDb()`.
- Dashboard, wejście w sesję i zlecanie badań działają na prod bez HTTP
  500/zawieszeń.
- Cloudflare Workers Logs nie zawierają "code had hung"; błędy DB (jeśli są)
  logowane czytelnie.
