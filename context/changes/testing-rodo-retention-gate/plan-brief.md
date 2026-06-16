# Testing RODO Retention Gate — Krótki plan

> Pełny plan: `context/changes/testing-rodo-retention-gate/plan.md` Badania:
> `context/changes/testing-rodo-retention-gate/research.md`

## Co i dlaczego

Skrypt `cleanup-expired-accounts.mjs` usuwa konta po 30 dniach, ale nie ma
żadnych testów i ma lukę RODO: `verificationToken` (zawiera email = PII) nie
jest czyszczony przez CASCADE ani przez skrypt. Faza 6 projektu account-deletion
— dodajemy testy i zamykamy lukę.

## Punkt wyjścia

`scripts/cleanup-expired-accounts.mjs` to 24-liniowy effect-only script — brak
eksportów, brak guard `import.meta.main`, brak obsługi `verificationToken`.
`vitest.config.ts` obejmuje tylko `src/**` — pliki testowe dla `scripts/` są
poza zasięgiem.

## Pożądany stan końcowy

Po zakończeniu planu: skrypt eksportuje `runCleanup(sql)`, atomowo czyści
`verificationToken` przez data-modifying CTE, a `npm test` uruchamia 8 testów (3
hermetic + 5 integration) pokrywających granicę 30 dni, CASCADE przez 4 tabele i
cleanup tokenów.

## Kluczowe podjęte decyzje

| Decyzja                   | Wybór                                                       | Dlaczego (1 zdanie)                                                         | Źródło |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| Testabilność skryptu      | Refactor → `runCleanup(sql)` + guard `import.meta.main`     | Izoluje SQL logikę bez subprocess, umożliwia mocking bez efektów            | Plan   |
| Cleanup verificationToken | CTE z RETURNING email (jedno atomowe zapytanie)             | Atomowość — oba DELETE wykonują się razem, brak ryzyka osieroconych tokenów | Plan   |
| Lokalizacja testów        | `scripts/__tests__/cleanup.test.mjs` + extend vitest config | Proximity convention — test przy kodzie który testuje                       | Plan   |
| Obsługa błędów            | Fail fast — exit(1) jak obecnie                             | Spójne z obecnym zachowaniem; GH Actions oznaczy run jako failed            | Plan   |
| actions/checkout@v6 → v4  | Odłożone                                                    | Nie blokuje; to osobny PR                                                   | Plan   |

## Zakres

**W zakresie:**

- Refactor skryptu do postaci testowalnej
- Fix: cleanup `verificationToken` przez CTE
- Unit testy (hermetic, mocked sql): 3 testy
- Integration testy (`DATABASE_URL_TEST`): 5 testów (granica 30 dni, CASCADE,
  verificationToken)
- Rozszerzenie `vitest.config.ts`

**Poza zakresem:**

- Testy `requestDeletionAction` / `cancelDeletionAction`
- FK constraint dla `verificationToken`
- Fix `actions/checkout@v6` → v4 w cleanup.yml
- Zmiana logiki granicy 30 dni

## Architektura / Podejście

Skrypt używa `postgres.js` bezpośrednio (nie Drizzle) z `{ prepare: false }`
(wymagane przez Supabase PgBouncer — nienaruszalne). Refaktoryzacja eksponuje
`runCleanup(sql)` przyjmujące instancję klienta, co pozwala testom przekazać
mock. Integration testy reużywają wzorzec
`describe.skipIf(!process.env.DATABASE_URL_TEST)` z `actions.test.ts`.

## Fazy w skrócie

| Faza                       | Co dostarcza                                  | Kluczowe ryzyko                                                             |
| -------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Refactor + fix skryptu  | `runCleanup(sql)` + CTE dla verificationToken | CTE data-modifying musi działać atomowo; `{ prepare: false }` musi pozostać |
| 2. Test infra + unit testy | vitest config + 3 hermetic testy              | Vitest + ESM `.mjs` może wymagać dodatkowej config                          |
| 3. Testy integracyjne      | 5 integration testów z `DATABASE_URL_TEST`    | Cleanup seeded danych w `afterEach` musi być niezawodny                     |

**Wymagania wstępne:** `DATABASE_URL_TEST` dostępny w środowisku dla Fazy 3
(wzorzec potwierdzony w `actions.test.ts`). **Szacowany nakład pracy:** ~1-2
sesje, 3 fazy sekwencyjne.

## Otwarte ryzyka i założenia

- `verificationToken.identifier` faktycznie przechowuje email (nie UUID czy coś
  innego) — potwierdzone w research i schemacie, ale warto zweryfikować w test
  DB.
- `DATABASE_URL_TEST` jest dostępne — pattern z `actions.test.ts` potwierdza że
  ktoś to wcześniej skonfigurował.

## Kryteria sukcesu (podsumowanie)

- `npm test` zielony bez żadnych env vars (unit testy zawsze przechodzą)
- `DATABASE_URL_TEST=<url> npm test` zielony — 5 integration testów zaliczone
- Hard-delete usera z 31-dniowym `deletionRequestedAt` → user + 4 tabele
  CASCADE + verificationToken — wszystko znika z DB
