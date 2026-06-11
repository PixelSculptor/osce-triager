---
date: 2026-06-11T00:00:00+02:00
researcher: Kacper Nadstoga
git_commit: 2c15df12f3572f0ace2b2831c2b176644d0da22b
branch: setup-ci-cd
repository: osce-traiger
topic:
  'CI workflow na PR — testy jednostkowe, integracyjne, E2E + strategia auth dla
  Playwright w CI'
tags: [research, ci, github-actions, playwright, supabase, vitest, auth]
status: complete
last_updated: 2026-06-11
last_updated_by: Kacper Nadstoga
---

# Research: CI workflow na PR — unit + integration + E2E + auth strategy

**Date**: 2026-06-11  
**Researcher**: Kacper Nadstoga  
**Git Commit**: 2c15df12f3572f0ace2b2831c2b176644d0da22b  
**Branch**: setup-ci-cd  
**Repository**: osce-traiger

## Research Question

Wdrożyć workflow CI na otwarty PR zawierający typowe akcje CI: testy
jednostkowe, integracyjne i E2E. Wyzwanie E2E: testowa instancja Supabase +
uwierzytelnianie w CI. Dwie opcje auth:

- **A**: Test wypełniający formularz logowania z sekretami GitHub
  (`TEST_USER_EMAIL` + `TEST_USER_PASSWORD`)
- **B**: Gotowy `auth.json` przez sekret CI (wymaga tokenu z nieograniczonym
  czasem życia)

## Summary

- **Żaden PR CI workflow nie istnieje** — `deploy.yml` wyzwala tylko na
  `push→main`, brak triggera `pull_request`
- **Trzy warstwy testów są już zaimplementowane** (fazy 1–3 z test-plan.md):
  testy jednostkowe + hermetyczne (nie wymagają DB), integracyjne (Supabase +
  `describe.skipIf`), E2E boundary (Playwright + pre-saved auth.json)
- **auth.json wygasa DZIŚ (2026-06-11)** — Opcja B jest operacyjnie kosztowna i
  maskuje Ryzyko #8; Opcja A (form fill) to właściwa ścieżka
- **Supabase CLI jest dostępny** (`supabase@^2.101.0` w devDependencies) +
  `supabase/config.toml` gotowy — `supabase start` w GitHub Actions jest
  feasible (Docker dostępny na ubuntu-latest)
- **Playwright nie ma `webServer`** — `playwright.config.ts` nie uruchamia
  serwera automatycznie; musi być explicite w workflow

## Detailed Findings

### 1. Stan istniejących workflows CI

Istnieją dwa pliki w `.github/workflows/`:

**`deploy.yml`** (`trigger: push→main`)

- Kroki: `npm ci` → lint → typecheck → `npx drizzle-kit migrate` →
  `npm run deploy`
- **Brak etapu testów** — `npm run test` nie jest uruchamiany
- Secrets: `DATABASE_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**`cleanup.yml`** (`trigger: schedule daily 02:00 UTC`)

- Uruchamia `scripts/cleanup-expired-accounts.mjs`
- Niezwiązany z testem PR

**Brakuje**: workflow z triggerem `pull_request` zawierający testy.

---

### 2. Inwentarz istniejących testów

| Plik                                      | Typ                    | Wymaga DB?          | Wymaga przeglądarki? |
| ----------------------------------------- | ---------------------- | ------------------- | -------------------- |
| `src/__tests__/smoke.test.ts`             | unit                   | nie                 | nie                  |
| `src/shared/lib/validator.test.ts`        | unit                   | nie                 | nie                  |
| `src/modules/session/actions.test.ts`     | integration + hermetic | opcjonalnie         | nie                  |
| `src/modules/session/queries.test.ts`     | integration            | opcjonalnie         | nie                  |
| `src/__tests__/e2e/auth-boundary.spec.ts` | E2E                    | nie (auth boundary) | tak                  |
| `src/__tests__/e2e/auth.setup.ts`         | E2E setup              | nie                 | tak                  |

**`npm run test` bez `DATABASE_URL_TEST`** → uruchamia unit + testy hermetyczne;
integracyjne są pomijane przez `describe.skipIf(!process.env.DATABASE_URL_TEST)`
w `actions.test.ts:23` i `queries.test.ts:7`.

**Testy hermetyczne (`endSessionAction`)** działają wszędzie — używają
`vi.spyOn(db)`, nie potrzebują połączenia (`actions.test.ts:81-158`).

---

### 3. Supabase w GitHub Actions

**Lokalna konfiguracja (wzorzec do odwzorowania w CI):**

- CLI zainstalowany: `package.json` devDependencies `"supabase": "^2.101.0"`
- Konfiguracja: `supabase/config.toml` z `[db] port = 54322`
- `.env.test`:
  `DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `vitest.setup.ts:8-10`: jeśli `DATABASE_URL_TEST` ustawiony → nadpisuje
  `DATABASE_URL` przed importem `db.ts`

**Schemat bazy danych:**

- Migracje w `supabase/migrations/` (3 pliki SQL)
- Seedowanie: `npm run seed` → `tsx src/shared/lib/seed.ts`

**Procedura w CI (na podstawie lokalnego wzorca):**

```yaml
- name: Start local Supabase
  run: npx supabase start

- name: Apply schema to test DB
  run: npx drizzle-kit push
  env:
    DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres

- name: Seed test data
  run: npm run seed
  env:
    DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**Uwaga**: `supabase start` pobiera obrazy Dockera (~2-3 min pierwsza run,
szybciej z cache). GitHub Actions ubuntu-latest ma Docker pre-installed.

**Komentarz z test-plan §6.2:**

> "Bramka CI: testy integracyjne NIE są obowiązkową bramką CI (uruchamianie
> lokalnego Supabase w CI jest kosztowne)."

Jednak ponieważ celem tej zmiany jest pełny CI na PR, integracyjne warto
dołączyć — ale jako osobny job (możliwe cache na obrazy Supabase).

---

### 4. Strategia auth dla E2E w CI

#### Stan obecny (problematyczny)

`src/__tests__/e2e/auth.setup.ts:6-28`:

- Ładuje pre-zapisany `playwright/.auth/user.json`
- Jeśli plik nie istnieje → test pada z instrukcją:
  `npx playwright codegen --save-storage=...`
- **Lokalny `playwright/.auth/user.json` wygasa DZIŚ** (`authjs.session-token`
  expires `1783754747` = 2026-06-11)
- To jest Ryzyko #8 z test-plan.md — pre-saved state nie testuje rzeczywistego
  formularza logowania

#### Opcja A: Formularz logowania (recommended)

**Jak działa login:**

- Formularz: `src/modules/auth/components/LoginForm.tsx`
  - `<input id="email" name="email" type="email">` (linia ~17)
  - `<input id="password" name="password" type="password">` (linia ~25)
- Akcja serwera: `src/modules/auth/actions.ts:23-49` →
  `signIn("credentials", { email, password, redirectTo: "/dashboard" })`
- Auth.js Credentials provider: `src/modules/auth/auth.ts` — bcrypt compare z
  `users.hashedPassword`
- Route handler: `src/app/api/auth/[...nextauth]/route.ts` → deleguje do
  `handlers`

**Implementacja `auth.setup.ts` dla CI:**

```typescript
import { test as setup, expect } from '@playwright/test';

setup('authenticate via login form', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Hasło').fill(password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();

  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
```

**Wymagania:**

- GitHub Secrets: `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`
- Testowy user musi istnieć w test Supabase (seed)
- App musi być uruchomiony przed setupem
- Pokrywa Ryzyko #8 z test-plan.md Phase 4 (wcześniejsze wdrożenie)

**Zalety:**

- Token nigdy nie wygasa (nowa sesja na każdym CI run)
- Testuje faktyczny flow logowania
- Zgodne z kierunkiem Phase 4 test-plan.md
- Brak zarządzania sekretem z datą wygaśnięcia

**Wady:**

- Wolniejszy niż pre-baked (dodatkowy request)
- Wymaga seeded test user w DB
- Wymaga `AUTH_SECRET` jako CI secret (do walidacji JWT przez app)

#### Opcja B: auth.json przez sekret

**Dlaczego nie rekomendowana:**

1. Bieżący token **wygasa DZIŚ** — immediate breakage
2. Auth.js JWT wygasa po 30 dniach (domyślne `session.maxAge`) — wymaga
   manualnego refreshu lub rozszerzenia `maxAge`
3. Nie testuje formularza logowania — Ryzyko #8 pozostaje nieprzetestowane
4. Operacyjna złożoność: base64 encode/decode + cron do odświeżania sekretu

**Jedyny scenariusz gdzie B ma sens**: gdy Phase 4 (form fill) jest na etapie "w
trakcie" a testy boundary muszą działać **teraz** i `session.maxAge` jest
ustawiony na np. 365 dni. Ale to ad-hoc patch.

#### Decyzja

**Opcja A** — form fill z sekretami. Pokrywa Ryzyko #8, eliminuje problem
wygaśnięcia, naturalne dopasowanie do Phase 4.

---

### 5. Brak konfiguracji webServer w Playwright

`playwright.config.ts` — brak `webServer`:

```typescript
// playwright.config.ts (aktualna)
use: {
  baseURL: 'http://localhost:3000',  // serwer musi być już uruchomiony
  trace: 'on-first-retry',
},
// brak webServer: { command: '...', url: '...' }
```

W CI serwer musi być explicite uruchomiony. Opcje:

1. `npm run dev` w tle (`npm run dev &`) + `wait-on http://localhost:3000`
2. `npm run build && npm run start` w tle (bardziej stabilny w CI)
3. Dodać `webServer` do `playwright.config.ts` (czystsze rozwiązanie)

**Uwaga na Cloudflare adapter**: `npm run start` działa (standard Next.js).
`opennextjs-cloudflare preview` lokalnie symuluje Workers edge, ale nie jest
wymagany dla testów E2E — app bez Workers edge działa dla auth + DB.

---

### 6. Wymagane zmienne środowiskowe dla CI

| Zmienna                         | Gdzie potrzebna                 | Źródło w CI                                       |
| ------------------------------- | ------------------------------- | ------------------------------------------------- |
| `DATABASE_URL_TEST`             | Vitest integration tests        | Hardcoded (`127.0.0.1:54322`) po `supabase start` |
| `DATABASE_URL`                  | App (E2E), drizzle-kit          | Hardcoded (`127.0.0.1:54322`) po `supabase start` |
| `AUTH_SECRET`                   | App (Next-Auth JWT)             | GitHub Secret                                     |
| `AUTH_URL`                      | Next-Auth callbacks             | `http://localhost:3000`                           |
| `NEXT_PUBLIC_SUPABASE_URL`      | Next.js build                   | Istnieje w GitHub vars                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js build                   | Istnieje w GitHub vars                            |
| `TEST_USER_EMAIL`               | Playwright auth setup (Opcja A) | Nowy GitHub Secret                                |
| `TEST_USER_PASSWORD`            | Playwright auth setup (Opcja A) | Nowy GitHub Secret                                |

**`AUTH_SECRET` jest krytyczny**: musi być ten sam secret co w produkcji (lub
dedykowany testowy) — Next-Auth używa go do podpisywania JWT. Brak `AUTH_SECRET`
= sesja nie działa.

---

### 7. Architektura proponowanego workflow CI PR

```
Trigger: pull_request → main

Job 1: lint-typecheck (~2 min, blokuje resztę)
  npm ci → lint → typecheck

Job 2: unit-tests (~1 min, brak DB)
  npm ci → npm run test
  (integracyjne pomijane automatycznie bez DATABASE_URL_TEST)

Job 3: integration-tests (~5-7 min, Supabase)
  npm ci → supabase start → drizzle-kit push → seed → npm run test
  env: DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:54322/postgres

Job 4: e2e-tests (~4-6 min, przeglądarka)
  npm ci → supabase start → drizzle-kit push → seed
  → build → start serwera → playwright install chromium
  → npm run test:e2e
  env: AUTH_SECRET, AUTH_URL, TEST_USER_EMAIL, TEST_USER_PASSWORD, DATABASE_URL
```

**Job 3 i Job 4 mogą biec równolegle** (oba startują Supabase niezależnie na
własnych runnerach).

**Alternatywnie**: Job 4 może zależeć od Job 1 i Job 2 (sequential), a Job 3 od
Job 1 (parallel z Job 4). W ten sposób pełne CI jest ~8-10 min zamiast 15+ min
sequential.

---

## Code References

- `.github/workflows/deploy.yml` — istniejący deploy workflow (brak PR trigger,
  brak testów)
- `playwright.config.ts:84-102` — config Playwright (brak webServer)
- `src/__tests__/e2e/auth.setup.ts:4-28` — pre-saved auth.json load (do
  zastąpienia)
- `playwright/.auth/user.json` — wygasa 2026-06-11 (DZIŚ)
- `src/__tests__/e2e/auth-boundary.spec.ts:8` —
  `test.use({ storageState: { cookies: [], origins: [] } })` — nie wymaga
  auth.json
- `src/modules/auth/components/LoginForm.tsx:17,25` — `id="email"`,
  `id="password"`
- `src/modules/auth/actions.ts:23-49` — `loginAction` →
  `signIn("credentials", ...)`
- `src/modules/auth/auth.ts:15-59` — Credentials provider + bcrypt authorize
- `vitest.setup.ts:8-10` — `DATABASE_URL` override dla testów
- `src/modules/session/actions.test.ts:23-25` —
  `describe.skipIf(!runIntegration)` pattern
- `supabase/config.toml` — `[db] port = 54322`
- `.env.test:1` —
  `DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## Architecture Insights

1. **`describe.skipIf` pattern jest poprawny** — `npm run test` bez
   `DATABASE_URL_TEST` uruchamia tylko unit + hermetyczne, bezpieczne w CI bez
   Supabase
2. **`vitest.setup.ts` ładuje `.env.test`** — wystarczy ustawić
   `DATABASE_URL_TEST` jako env var w CI step, vitest.setup.ts wchłonie go przez
   `dotenv.config({ override: true })`
3. **Auth.js JWT** — musi być ten sam `AUTH_SECRET` co podpisuje tokeny; dla
   testów E2E można użyć dedykowanego sekretu (oddzielna testowa instancja)
4. **`playwright/.auth/user.json` jest w `.gitignore`** (lokalny artefakt) — w
   CI musi być generowany w każdym run przez form fill setup

## Historical Context (from prior changes)

- `context/changes/ci-cd-pipeline/plan.md` — F-03 zakończony. Deploy workflow
  stworzony (push→main). Plan explicite notuje: "Brak test runnera — CI nie
  uruchamia testów jednostkowych". To jest luka do wypełnienia przez tę zmianę.
- `context/foundation/test-plan.md:§4` — "Bramka CI: testy integracyjne NIE są
  obowiązkową bramką CI (uruchamianie lokalnego Supabase w CI jest kosztowne)" —
  ale test-plan.md §5 mówi: "e2e dla głównych przepływów: wymagane po §3 Fazie
  3"
- `context/foundation/test-plan.md:Ryzyko #8` — pre-saved `auth.setup.ts` jest
  dokumentowanym ryzykiem Phase 4; wdrożenie form fill w CI naturalnie zakrywa
  tę fazę wcześniej
- `context/changes/testing-auth-boundary-gate/` — Phase 3 zakończona; E2E
  boundary testy są gotowe i muszą działać w CI

## Open Questions

1. **Czy `AUTH_SECRET` dla testów powinien być ten sam co produkcyjny, czy
   dedykowany?**  
   Dedykowany testowy secret jest czystszy (izolacja); wymaga wpisu jako nowego
   GitHub Secret.

2. **Cache dla Supabase Docker images w CI?**  
   GitHub Actions może cachować `~/.supabase` lub użyć `docker pull` cache;
   zmniejsza czas `supabase start` z 3min do ~30s na kolejnych runach.

3. **`webServer` w `playwright.config.ts` czy start serwera w workflow?**  
   `webServer` w config jest czystsze (Playwright zarządza procesem,
   auto-cleanup). Wymaga zmiany w `playwright.config.ts`.

4. **Czy test user seed powinien być częścią `npm run seed`, czy oddzielnego
   skryptu?**  
   Oddzielny `npm run seed:test` z hardcoded test credentials jest czystszy (nie
   zaśmieca produkcyjnych seeds); wymaga nowego skryptu.

5. **Równoległość Job 3 (integration) i Job 4 (e2e)?**  
   Oba wymagają `supabase start` na osobnych runnerach — brak konfliktu. Mogą
   biec równolegle po Job 1 (`lint-typecheck`).
