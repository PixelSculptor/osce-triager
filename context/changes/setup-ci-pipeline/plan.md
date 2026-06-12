# Setup CI Pipeline — Plan implementacji

## Przegląd

Wdrożyć workflow GitHub Actions wyzwalany na każdy PR do `main`, zawierający 4
joby: lint/typecheck (gate), unit tests, integration tests (Supabase lokalny),
E2E tests (Playwright + form fill auth). Przy okazji zastąpić przestarzały
`auth.setup.ts` (pre-saved token wygasł 2026-06-11) logiką form fill zgodną z
Phase 4 test-plan.md.

## Analiza stanu obecnego

- `deploy.yml` — trigger tylko `push→main`, zero PR triggerów, zero etapu testów
- `cleanup.yml` — niezwiązany, trigger cron daily
- `playwright.config.ts:91` — `baseURL: http://localhost:3000`, brak
  `webServer`, serwer musi być uruchomiony zewnętrznie
- `src/__tests__/e2e/auth.setup.ts:6-14` — wczytuje pre-saved `user.json`; jeśli
  nie istnieje → throw z instrukcją do ręcznego `codegen`. Token wygasł.
- `src/shared/lib/seed.ts` — seeduje scenariusze + testy diagnostyczne, brak
  usera testowego
- `drizzle.config.ts:3` — ładuje `.env.local` via dotenv; `DATABASE_URL` czytany
  z env
- `vitest.setup.ts:8-10` — jeśli `DATABASE_URL_TEST` ustawiony → nadpisuje
  `DATABASE_URL` przed importem `db.ts`
- `package.json` — skrypty: `test` (vitest run), `test:e2e` (playwright test),
  `seed` (tsx seed.ts), brak `seed:test`

## Pożądany stan końcowy

Każdy PR do `main` przechodzi przez bramkę CI:

1. Lint + typecheck (blokuje pozostałe joby przy błędzie)
2. Unit + hermetic tests (bez DB)
3. Integration tests (lokalne Supabase)
4. E2E tests (form fill auth, lokalne Supabase, Next.js start)

`auth.setup.ts` generuje sesję w każdym CI run przez formularz logowania
(eliminuje problem wygaśnięcia tokenu i pokrywa Ryzyko #8 z test-plan.md).
`playwright.config.ts` zarządza serwerem automatycznie przez `webServer`.

### Kluczowe odkrycia

- `LoginForm.tsx:17,25` — `<label htmlFor="email">Adres email</label>` +
  `<label htmlFor="password">Hasło</label>` +
  `<SubmitButton>Zaloguj się</SubmitButton>` → lokatory Playwright:
  `getByLabel('Adres email')`, `getByLabel('Hasło')`,
  `getByRole('button', { name: 'Zaloguj się' })`
- `auth.ts:2` — `import bcrypt from 'bcryptjs'` → seed-test.ts musi hashować tym
  samym modułem
- `schema.ts` — tabela `user`: pola `email` (unique), `hashedPassword`, `name`
- `vitest.setup.ts:3` — `dotenv.config({ path: '.env.test', override: true })` →
  w CI wystarczy ustawić `DATABASE_URL_TEST` jako env var; vitest wchłonie go
  (override: true, czyli env var z runner-a wygrywa z plikiem)
- `drizzle.config.ts:3` — `config({ path: '.env.local', override: false })` → w
  CI env var `DATABASE_URL` wygrywa nad plikiem; nie trzeba tworzyć `.env.local`
  w CI

## Czego NIE robimy

- Nie zmieniamy `deploy.yml` (push→main deploy workflow pozostaje bez zmian)
- Nie dodajemy cache Supabase Docker images (zysk ~2 min, dodatkowa złożoność —
  można dodać później)
- Nie zmieniamy konfiguracji projektów Playwright (setup + chromium pozostają,
  tylko treść `auth.setup.ts` się zmienia)
- Nie uruchamiamy integracyjnych jako obowiązkowej bramki (per test-plan §4 —
  opcjonalna; job `integration-tests` nie blokuje merge-a przez
  `continue-on-error: false`, ale jest required check do decyzji użytkownika w
  repo settings)
- Nie wdrażamy `opennextjs-cloudflare preview` dla testów E2E — standard
  `next start` wystarczy

## Podejście do implementacji

Trzy niezależne obszary zmian realizowane sekwencyjnie w trzech fazach:

1. Playwright (auth.setup.ts + webServer config) — musi działać lokalnie zanim
   wejdzie do CI
2. Seed testowego użytkownika — musi istnieć przed uruchomieniem E2E job-a
3. Workflow CI YAML — korzysta z obu powyższych; zawiera 4 joby z `needs`
   dependency

## Faza 1: Playwright — form fill auth + webServer

### Przegląd

Zastąpić mechanizm weryfikacji pre-saved `user.json` pełnym form fill flow.
Dodać `webServer` do `playwright.config.ts`, żeby Playwright sam zarządzał
procesem Next.js (auto-start, auto-kill, healthcheck).

### Wymagane zmiany

#### 1. Zastąpienie `auth.setup.ts`

**Plik**: `src/__tests__/e2e/auth.setup.ts`

**Cel**: Wyeliminować dependency na pre-saved tokenie z datą wygaśnięcia. Setup
musi logować się przez formularz używając credentials z env vars i zapisywać
nowy `storageState` do `playwright/.auth/user.json`.

**Kontrakt**: `setup('authenticate via login form', async ({ page }) => {...})`
— nawiguje do `/login`, wypełnia `getByLabel('Adres email')` i
`getByLabel('Hasło')`, klika `getByRole('button', { name: 'Zaloguj się' })`,
czeka na `waitForURL('/dashboard')`, zapisuje `storageState`. Env vars:
`TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (wymagane — brak → błąd
`Cannot read properties of undefined`).

```typescript
import { test as setup } from '@playwright/test';

const AUTH_FILE = 'playwright/.auth/user.json';

setup('authenticate via login form', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adres email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Hasło').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: AUTH_FILE });
});
```

#### 2. Dodanie `webServer` do `playwright.config.ts`

**Plik**: `playwright.config.ts`

**Cel**: Playwright zarządza procesem Next.js automatycznie — startuje
`next start` przed testami, zatrzymuje po. Lokalnie ponownie używa już
działającego serwera (`reuseExistingServer: true`). W CI buduje app oddzielnie
(przed `test:e2e`) i `webServer` tylko startuje `next start`.

**Kontrakt**: Dodać blok `webServer` do `defineConfig`:

```typescript
webServer: {
  command: 'npm run start',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
},
```

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Lokalnie: `TEST_USER_EMAIL=<e> TEST_USER_PASSWORD=<p> npm run test:e2e` —
  setup projekt przechodzi (wymaga działającego `next start` lub `next dev` dla
  `reuseExistingServer: true`)

#### Weryfikacja ręczna

- Uruchomić `npm run test:e2e` lokalnie po seeding testowego usera (Faza 2) i
  `npm run build && npm run start` — `auth state is valid` zastąpione przez
  `authenticate via login form`, test przechodzi i tworzy
  `playwright/.auth/user.json`
- Brak istniejącego `playwright/.auth/user.json` nie blokuje testów (form fill
  tworzy go od zera)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu weryfikacji
automatycznej, zatrzymaj się na weryfikację ręczną przed przejściem do Fazy 2.

---

## Faza 2: Seed testowego użytkownika

### Przegląd

Stworzyć oddzielny skrypt `seed:test` tworzący użytkownika z credentials z env
vars. Skrypt jest idempotentny (`onConflictDoNothing`) — bezpieczny do
wielokrotnego uruchomienia w CI.

### Wymagane zmiany

#### 1. Nowy skrypt `seed-test.ts`

**Plik**: `src/shared/lib/seed-test.ts`

**Cel**: Wstawić testowego usera do tabeli `user` z zahashowanym hasłem. Używa
tych samych credentials co Playwright auth setup (`TEST_USER_EMAIL`,
`TEST_USER_PASSWORD`). Idempotentny — ponowne uruchomienie nie duplikuje usera
(email jest unique).

**Kontrakt**: Async `seedTest()` — hashuje `process.env.TEST_USER_PASSWORD`
przez `bcrypt.hash(password, 12)`, wstawia do `users` via
`db.insert(users).values({ email, name: 'Test User', hashedPassword }).onConflictDoNothing()`,
wywołuje `process.exit(0)`.

Wzorzec importów identyczny jak `seed.ts:72-77` — dynamiczne importy `db` i
`schema` wewnątrz funkcji, żeby `DATABASE_URL` był ustawiony przed inicjalizacją
Postgres clienta.

#### 2. Dodanie skryptu do `package.json`

**Plik**: `package.json`

**Cel**: Umożliwić wywołanie `npm run seed:test` zarówno lokalnie jak i w CI.

**Kontrakt**: Dodać `"seed:test": "tsx src/shared/lib/seed-test.ts"` obok
istniejącego `"seed"`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres TEST_USER_EMAIL=test@example.com TEST_USER_PASSWORD=Test1234! npm run seed:test`
  — "Seed test user: test@example.com" w stdout, exit 0
- Ponowne uruchomienie nie zwraca błędu (idempotentność)

#### Weryfikacja ręczna

- Po `npm run seed:test`, user istnieje w lokalnej testowej DB
- `npm run test:e2e` kończy się sukcesem dla projektu `setup` (form fill loguje
  się na seeded user)

**Uwaga implementacyjna**: Faza 2 wymaga działającego lokalnego Supabase
(`npx supabase start`). Po weryfikacji ręcznej, zatrzymaj się przed Fazą 3.

---

## Faza 3: CI PR workflow

### Przegląd

Nowy plik `.github/workflows/ci.yml` z triggerem `pull_request → main`. Cztery
joby: `lint-typecheck` (gate), `unit-tests`, `integration-tests`, `e2e-tests`.
Job 2/3/4 startują równolegle po Job 1. Szacowany czas pełnego CI: ~8-10 min.

### Wymagane zmiany

#### 1. Nowy workflow CI

**Plik**: `.github/workflows/ci.yml`

**Cel**: Zablokować merge PR-ów z testami/lintem nie przechodzącymi. Pokryć
wszystkie trzy warstwy testów (unit, integration, e2e) na dedykowanych
runnerach.

**Kontrakt**: Plik YAML z czterema jobami jak poniżej. Secrets wymagane w GitHub
repo przed pierwszym uruchomieniem: `AUTH_SECRET_TEST` (dedykowany, nie
produkcyjny), `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`. Vars już dostępne:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

```yaml
name: CI

on:
  pull_request:
    branches:
      - main

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  unit-tests:
    needs: lint-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run test

  integration-tests:
    needs: lint-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: Start local Supabase
        run: npx supabase start
      - name: Apply schema
        run: npx drizzle-kit push --force
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      - name: Run tests with integration suite
        run: npm run test
        env:
          DATABASE_URL_TEST: postgresql://postgres:postgres@127.0.0.1:54322/postgres

  e2e-tests:
    needs: lint-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: Start local Supabase
        run: npx supabase start
      - name: Apply schema
        run: npx drizzle-kit push --force
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      - name: Seed app data
        run: npm run seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      - name: Seed test user
        run: npm run seed:test
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
      - name: Build app
        run: npm run build
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
          AUTH_SECRET: ${{ secrets.AUTH_SECRET_TEST }}
          AUTH_URL: http://localhost:3000
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            ${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
          AUTH_SECRET: ${{ secrets.AUTH_SECRET_TEST }}
          AUTH_URL: http://localhost:3000
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            ${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Otwarcie PR do `main` wyzwala workflow `CI`
- Job `lint-typecheck` kończy się przed uruchomieniem pozostałych
- Job `unit-tests` przechodzi (bez DB)
- Job `integration-tests` przechodzi z `DATABASE_URL_TEST` ustawionym
- Job `e2e-tests` przechodzi z form fill auth

#### Weryfikacja ręczna

- W zakładce Actions widać 4 joby; `unit-tests`, `integration-tests`,
  `e2e-tests` startują równolegle po przejściu `lint-typecheck`
- Log `e2e-tests` → krok `Run E2E tests` → Playwright output pokazuje
  `authenticate via login form` (PASSED)
- PR z błędem lintowania blokuje wszystkie joby (walidacja gating)

---

## Strategia testowania

### Testy automatyczne (CI)

| Job               | Warunek uruchomienia | Czas (~) |
| ----------------- | -------------------- | -------- |
| lint-typecheck    | każdy PR push        | 1-2 min  |
| unit-tests        | po lint-typecheck    | 1 min    |
| integration-tests | po lint-typecheck    | 5-7 min  |
| e2e-tests         | po lint-typecheck    | 6-8 min  |

### Kroki testowania ręcznego (przed mergem faz):

1. Faza 1: `npm run build && npm run start &` →
   `TEST_USER_EMAIL=<e> TEST_USER_PASSWORD=<p> npm run test:e2e` — verify form
   fill setup przechodzi
2. Faza 2: `npx supabase start` → `DATABASE_URL=... npm run seed:test` → verify
   user istnieje w DB
3. Faza 3: push branch → otwórz PR → sprawdź zakładkę Actions

## Uwagi dotyczące migracji

**GitHub Secrets do dodania przed Fazą 3** (bez nich job `e2e-tests` padnie):

- `AUTH_SECRET_TEST` — wygenerować: `openssl rand -base64 32`
- `TEST_USER_EMAIL` — email testowego usera (np. `ci-test@osce-traiger.dev`)
- `TEST_USER_PASSWORD` — hasło (silne, minimum 12 znaków)

`NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` już istnieją jako
GitHub vars.

## Referencje

- Badania: `context/changes/setup-ci-pipeline/research.md`
- Istniejący workflow: `.github/workflows/deploy.yml`
- Test plan: `context/foundation/test-plan.md` §4 (integration gate), §5 (e2e
  required), Ryzyko #8
- `src/modules/auth/auth.ts:2` — bcryptjs (do seed-test.ts)
- `src/modules/auth/components/LoginForm.tsx:17,25,42` — lokatory formularza
- `vitest.setup.ts:8-10` — DATABASE_URL_TEST override pattern
- `drizzle.config.ts:3` — dotenv nie-override pattern

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Playwright — form fill auth + webServer

#### Automatyczne

- [x] 1.1 `npm run test:e2e` z `TEST_USER_EMAIL` i `TEST_USER_PASSWORD`
      ustawionymi — setup projekt przechodzi

#### Ręczne

- [x] 1.2 Form fill loguje się na seeded usera i tworzy
      `playwright/.auth/user.json`
- [x] 1.3 Brak istniejącego `user.json` nie blokuje startu testów

### Faza 2: Seed testowego użytkownika

#### Automatyczne

- [x] 2.1 `npm run seed:test` z `DATABASE_URL`, `TEST_USER_EMAIL`,
      `TEST_USER_PASSWORD` — exit 0, "Seed test user: ..."
- [x] 2.2 Ponowne uruchomienie `seed:test` nie zwraca błędu (idempotentność)

#### Ręczne

- [x] 2.3 `npm run test:e2e` end-to-end po seeding — auth setup + testy boundary
      przechodzą

### Faza 3: CI PR workflow

#### Automatyczne

- [ ] 3.1 PR do `main` wyzwala workflow `CI` (widoczny w zakładce Actions)
- [ ] 3.2 Job `lint-typecheck` kończy się jako pierwszy; pozostałe 3 startują
      równolegle
- [ ] 3.3 Job `unit-tests` przechodzi
- [ ] 3.4 Job `integration-tests` przechodzi z DB suite
- [ ] 3.5 Job `e2e-tests` przechodzi — log Playwright pokazuje
      `authenticate via login form` (PASSED)

#### Ręczne

- [ ] 3.6 PR z błędem lintowania blokuje wszystkie joby — walidacja gating
      działa
