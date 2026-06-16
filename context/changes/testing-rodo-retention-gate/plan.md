# Testing RODO Retention Gate — Plan implementacji

## Przegląd

Weryfikacja mechanizmu retencji RODO: pokrycie testami logiki 30-dniowego progu,
cascadowego usuwania danych usera oraz fix luki `verificationToken` (email PII
nieusuwany przez hard-delete). Skrypt cleanup jest refaktoryzowany do postaci
testowalnej przed napisaniem testów.

## Analiza stanu obecnego

- **Skrypt**: `scripts/cleanup-expired-accounts.mjs` — 24 linie, brak eksportów,
  brak guard `import.meta.main`. Niemodulowalny — żaden test nie może go
  zaimportować bez uruchomienia efektów.
- **Luka RODO**: `verificationToken` nie ma FK do `user` → wiersze z emailem
  (PII) przeżywają hard-delete. Skrypt nie ma logiki cleanup dla tej tabeli.
- **Warunek granicy**: strict `<`
  (`deletion_requested_at < NOW() - INTERVAL '30 days'`), nie `<=` — user
  exactly na granicy 30 dni jest zachowany.
- **Test infra**: `vitest.config.ts:7` ma `include: ['src/**/*.test.ts']` —
  pliki `scripts/**` są poza zasięgiem.
- **Zero testów**: żaden plik testowy nie pokrywa logiki cleanup ani retencji.

## Pożądany stan końcowy

Po zakończeniu planu:

- `scripts/cleanup-expired-accounts.mjs` eksportuje `runCleanup(sql)` i usuwa
  `verificationToken` atomowo przez CTE.
- Zestaw testów pokrywa granicę 30 dni, CASCADE (5 tabel), cleanup
  verificationToken oraz ścieżkę błędu.
- `vitest.config.ts` obejmuje `scripts/**`.
- `npm test` jest zielony bez `DATABASE_URL_TEST`; z `DATABASE_URL_TEST`
  integration suite też zielona.

### Kluczowe odkrycia:

- `scripts/cleanup-expired-accounts.mjs:9` — `{ prepare: false }` wymagane przez
  Supabase PgBouncer; musi pozostać niezmienione.
- `src/shared/lib/schema.ts:55-63` — `verificationToken` ma PK
  `(identifier, token)`, brak FK; `identifier` przechowuje email.
- `src/modules/session/actions.test.ts:23-25` — wzorzec
  `describe.skipIf(!process.env.DATABASE_URL_TEST)` do skopiowania dla
  integration testów.
- `vitest.config.ts:7` — `include` wymaga rozszerzenia o
  `scripts/**/*.test.mjs`.
- Node.js ESM: guard `import.meta.main` przez
  `fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`.

## Czego NIE robimy

- Nie testujemy `requestDeletionAction` / `cancelDeletionAction` (poza zakresem
  tej zmiany).
- Nie naprawiamy `actions/checkout@v6` / `setup-node@v6` w `cleanup.yml`
  (odkryte podczas researchu, odłożone na późniejszy PR).
- Nie dodajemy FK constraint dla `verificationToken` (zmiana migracji DB poza
  zakresem).
- Nie zmieniamy logiki granicy 30 dni — testujemy zachowanie istniejące.

## Podejście do implementacji

Trzy fazy sekwencyjne: najpierw skrypt musi być refaktoryzowany i naprawiony
(warunek wstępny dla testowalności), potem unit testy z mockiem sql (hermetic,
zawsze zielone), potem integration testy z prawdziwą bazą (skipowane bez
`DATABASE_URL_TEST`).

## Krytyczne szczegóły implementacji

- **CTE data-modifying**: PostgreSQL pozwala na modyfikujące CTE. Składnia:
  `WITH deleted_users AS (DELETE FROM "user" ... RETURNING id, email), deleted_tokens AS (DELETE FROM "verificationToken" WHERE identifier IN (SELECT email FROM deleted_users)) SELECT count(*)::int AS users_deleted, count(*)::int AS tokens_deleted`
  — obie operacje wykonują się atomowo w jednej transakcji. Zewnętrzny SELECT
  agreguje oba liczniki z CTE.
- **Vitest + ESM .mjs**: Vitest 1.x obsługuje `.mjs` natively gdy test
  environment jest `node`. `include` pattern musi używać glob
  `scripts/**/*.test.mjs` (nie `.ts`).
- **import.meta.main w Node.js ESM**: nie ma natywnego `import.meta.main`.
  Wzorzec: `import { fileURLToPath } from 'url'` + porównanie
  `fileURLToPath(import.meta.url)` z `path.resolve(process.argv[1])`.

---

## Faza 1: Refactor + fix skryptu

### Przegląd

Uczynić skrypt testowalnym przez wyodrębnienie logiki do eksportowanej funkcji
oraz usunąć lukę RODO przez dodanie atomowego cleanup `verificationToken`.

### Wymagane zmiany:

#### 1. Skrypt cleanup

**Plik**: `scripts/cleanup-expired-accounts.mjs`

**Cel**: Wyodrębnij logikę do eksportowanej `runCleanup(sql)`. Dodaj atomowy
cleanup `verificationToken` przez data-modifying CTE. Uruchamiaj cleanup tylko
gdy skrypt jest wywołany bezpośrednio (guard `import.meta.main`).

**Kontrakt**:

- Export: `export async function runCleanup(sql)` — przyjmuje instancję
  postgres.js, zwraca `{ usersDeleted: number, tokensDeleted: number }`.
- SQL: jedno zapytanie CTE —
  `WITH deleted_users AS (DELETE FROM "user" WHERE ... RETURNING id, email), deleted_tokens AS (DELETE FROM "verificationToken" WHERE identifier IN (SELECT email FROM deleted_users)) SELECT count(*)::int AS users_deleted, count(*)::int AS tokens_deleted`.
- Logowanie: `Deleted N expired account(s), M verification token(s) cleaned`.
- Guard: blok `if (isMain)` tworzy
  `sql = postgres(DATABASE_URL, { prepare: false })`, wywołuje
  `runCleanup(sql)`, łapie błędy → `process.exit(1)`, zawsze woła `sql.end()` w
  `finally`.
- `{ prepare: false }` pozostaje niezmienione (wymagane przez Supabase
  PgBouncer).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Skrypt uruchamia się bez błędu składni:
  `node --check scripts/cleanup-expired-accounts.mjs`

#### Weryfikacja ręczna:

- `node scripts/cleanup-expired-accounts.mjs` z produkcyjnym `DATABASE_URL`
  loguje poprawny output i kończy z kodem 0.
- Import skryptu w teście nie wywołuje efektów ubocznych.

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne
potwierdzenie od człowieka, że testy ręczne zakończyły się sukcesem, zanim
przejdziesz do następnej fazy.

---

## Faza 2: Test infrastruktura + testy jednostkowe

### Przegląd

Rozszerzyć vitest config, aby objął `scripts/`, i napisać hermetic unit testy
`runCleanup` z mockowanym `sql`.

### Wymagane zmiany:

#### 1. Konfiguracja Vitest

**Plik**: `vitest.config.ts`

**Cel**: Dodaj `scripts/**/*.test.mjs` do `include`, aby unit i integration
testy w `scripts/__tests__/` były wykrywane przez `npm test`.

**Kontrakt**: `test.include` rozszerzone o `'scripts/**/*.test.mjs'`.

#### 2. Unit testy (hermetic)

**Plik**: `scripts/__tests__/cleanup.test.mjs`

**Cel**: Przetestować `runCleanup(sql)` z mockowanym klientem postgres.js — bez
prawdziwej bazy. Pokryć ścieżkę sukcesu (N usuniętych), ścieżkę 0 usuniętych i
ścieżkę błędu.

**Kontrakt**: Trzy testy w `describe('runCleanup — hermetic')`:

1. `sql` mockowany do zwracania `[{ users_deleted: 2, tokens_deleted: 1 }]` →
   `runCleanup` zwraca `{ usersDeleted: 2, tokensDeleted: 1 }` i loguje poprawny
   string.
2. `sql` mockowany do zwracania `[{ users_deleted: 0, tokens_deleted: 0 }]` →
   `runCleanup` zwraca `{ usersDeleted: 0, tokensDeleted: 0 }`.
3. `sql` mockowany do rzucania `Error('DB error')` → `runCleanup` propaguje błąd
   (nie łapie go wewnątrz).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm test` przechodzi (wszystkie testy zielone bez `DATABASE_URL_TEST`).
- Unit testy w `scripts/__tests__/cleanup.test.mjs` są wykrywane:
  `npx vitest run scripts` wyświetla 3 testy.

#### Weryfikacja ręczna:

- `npx vitest run --reporter=verbose` pokazuje `runCleanup — hermetic` z 3
  zaliczonymi testami.

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne
potwierdzenie od człowieka, że testy ręczne zakończyły się sukcesem, zanim
przejdziesz do następnej fazy.

---

## Faza 3: Testy integracyjne

### Przegląd

Napisać integration suite z prawdziwą bazą (`DATABASE_URL_TEST`) weryfikującą
granicę 30 dni, pełny CASCADE przez 4 tabele oraz cleanup `verificationToken`.

### Wymagane zmiany:

#### 1. Integration testy

**Plik**: `scripts/__tests__/cleanup.test.mjs` (rozszerzenie istniejącego pliku)

**Cel**: Zweryfikować zachowanie `runCleanup` na prawdziwej bazie testowej:
boundary condition (31/1 dni), CASCADE coverage (4 tabele), verificationToken
cleanup. Pattern `describe.skipIf(!process.env.DATABASE_URL_TEST)` analogicznie
do `src/modules/session/actions.test.ts:25`.

**Kontrakt**:
`describe.skipIf(!process.env.DATABASE_URL_TEST)('runCleanup — integration')`
zawierający:

1. **Granica 30 dni — usunięty (31 dni)**:
   - Seed: wstaw usera z `deletion_requested_at = NOW() - INTERVAL '31 days'`.
   - Wywołaj `runCleanup(sql)`.
   - Assert: `runCleanup` zwraca `{ usersDeleted: 1, tokensDeleted: 0 }` (brak
     tokenu dla tego usera).
   - Assert: user nie istnieje w `user` table.

2. **Granica 30 dni — zachowany (1 dzień temu)**:
   - Seed: wstaw usera z `deletion_requested_at = NOW() - INTERVAL '1 day'`.
   - Wywołaj `runCleanup(sql)`.
   - Assert: `runCleanup` zwraca `{ usersDeleted: 0, tokensDeleted: 0 }`.
   - Assert: user nadal istnieje.

3. **CASCADE — wszystkie 4 tabele czyszczone**:
   - Seed: wstaw usera z `deletion_requested_at = NOW() - INTERVAL '31 days'` +
     powiązany `account` + `session` + `session_result` + `session_event`.
   - Wywołaj `runCleanup(sql)`.
   - Assert: wszystkie 4 wiersze zniknęły (`account`, `session`,
     `session_result`, `session_event`).

4. **verificationToken cleanup**:
   - Seed: wstaw usera (31 dni temu, email `test-rodo@test.local`) + wstaw
     `verificationToken` z `identifier = 'test-rodo@test.local'`.
   - Wywołaj `runCleanup(sql)`.
   - Assert: `runCleanup` zwraca `{ usersDeleted: 1, tokensDeleted: 1 }`.
   - Assert: wiersz w `verificationToken` z
     `identifier = 'test-rodo@test.local'` nie istnieje.

5. **NULL `deletion_requested_at` — zachowany**:
   - Seed: wstaw usera bez ustawiania `deletionRequestedAt`.
   - Wywołaj `runCleanup(sql)`.
   - Assert: user istnieje.

**Cleanup**: `afterEach` lub `afterAll` usuwa seeded wiersze w odwrotnej
kolejności FK (identycznie jak `src/modules/session/actions.test.ts:55-63`).
Użyj unikalnych id z prefiksem `test-rodo-` + timestamp, aby uniknąć kolizji z
równoległymi runami.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `DATABASE_URL_TEST=<url> npm test` — integration suite przechodzi (5 testów
  zielonych).
- `npm test` bez `DATABASE_URL_TEST` — integration suite jest skipowana (0
  failures).

#### Weryfikacja ręczna:

- `DATABASE_URL_TEST=<url> npx vitest run --reporter=verbose scripts` wyświetla
  obie grupy: hermetic (3) + integration (5), wszystkie zielone.
- Po uruchomieniu integration testów: tabele w test DB nie zawierają danych z
  prefiksem `test-rodo-`.

---

## Strategia testowania

### Testy jednostkowe:

- `runCleanup(sql)` z mock zwracającym N usuniętych — weryfikacja zwracanego
  obiektu i logowania.
- `runCleanup(sql)` z mock rzucającym błąd — weryfikacja propagacji błędu.

### Testy integracyjne:

- 5 scenariuszy seed → runCleanup → assert na prawdziwej bazie testowej.
- `afterEach` cleanup — każdy test jest niezależny, nie polega na kolejności.

### Kroki testowania ręcznego:

1. Po Fazie 1: `node scripts/cleanup-expired-accounts.mjs` z `DATABASE_URL`
   produkcyjnym w trybie dry-run (jeśli nie ma kont do usunięcia, output
   `Deleted 0 expired account(s), 0 verification token(s) cleaned`).
2. Po Fazie 2: `npx vitest run --reporter=verbose` — 3 unit testy zielone bez
   żadnych env vars.
3. Po Fazie 3:
   `DATABASE_URL_TEST=<url> npx vitest run --reporter=verbose scripts` — 8
   testów zielonych.

## Referencje

- Research: `context/changes/testing-rodo-retention-gate/research.md`
- Wzorzec integration testów: `src/modules/session/actions.test.ts:23-63`
- Skrypt do refactoru: `scripts/cleanup-expired-accounts.mjs`
- Schema verificationToken: `src/shared/lib/schema.ts:55-63`
- Vitest config: `vitest.config.ts`

---

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz
> `references/progress-format.md`.

### Faza 1: Refactor + fix skryptu

#### Automatyczne

- [x] 1.1 Skrypt przechodzi syntax check:
      `node --check scripts/cleanup-expired-accounts.mjs`

#### Ręczne

- [x] 1.2 `node scripts/cleanup-expired-accounts.mjs` z `DATABASE_URL` loguje
      poprawny output i kończy z kodem 0
- [x] 1.3 Import skryptu w teście nie wywołuje efektów ubocznych

### Faza 2: Test infrastruktura + testy jednostkowe

#### Automatyczne

- [x] 2.1 `npm test` przechodzi (wszystkie testy zielone bez
      `DATABASE_URL_TEST`)
- [x] 2.2 `npx vitest run scripts` wykrywa i uruchamia 3 unit testy

#### Ręczne

- [ ] 2.3 `npx vitest run --reporter=verbose` pokazuje `runCleanup — hermetic` z
      3 zaliczonymi testami

### Faza 3: Testy integracyjne

#### Automatyczne

- [ ] 3.1 `DATABASE_URL_TEST=<url> npm test` — integration suite przechodzi (5
      testów zielonych)
- [ ] 3.2 `npm test` bez `DATABASE_URL_TEST` — integration suite skipowana (0
      failures)

#### Ręczne

- [ ] 3.3 `DATABASE_URL_TEST=<url> npx vitest run --reporter=verbose scripts` —
      8 testów łącznie (3 hermetic + 5 integration), wszystkie zielone
- [ ] 3.4 Test DB nie zawiera danych z prefiksem `test-rodo-` po zakończeniu
      runów
