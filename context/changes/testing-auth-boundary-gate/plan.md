# Auth boundary gate — Plan implementacji

## Przegląd

Phase 3 rollout planu testów: udowodnij, że middleware blokuje
nieuwierzytelniony dostęp do `/dashboard/*`. Dostarcza `auth.setup.ts`
(walidacja sesji z istniejącego `playwright/.auth/user.json`) oraz
`auth-boundary.spec.ts` (2 testy negatywne + 1 pozytywny). Koryguje błąd w §2
test-plan.md (redirect → `"/"`, nie `"/login"`) i wypełnia §6.3 cookbooka.

## Analiza stanu obecnego

- **Middleware** (`src/middleware.ts:16`) przekierowuje do `"/"` (root), nie do
  `"/login"`. Matcher pokrywa wszystkie trasy poza `_next/*` i `favicon.ico` —
  `/dashboard/*` jest w zakresie.
- **`auth.config.ts`** jest Edge-safe (brak DB, czyste sprawdzenie JWT via
  `req.auth`). Konfiguracja Cloudflare Workers (`wrangler.jsonc:28-29`)
  poprawna.
- **`playwright/.auth/user.json`** już istnieje z ważną sesją. Nie wymaga
  regeneracji.
- **`playwright.config.ts`** ma projekt `setup` (matchuje `auth.setup.ts`) i
  `chromium` (zależny od `setup`, używa
  `storageState: 'playwright/.auth/user.json'`). Plik `auth.setup.ts` jeszcze
  nie istnieje — projekt `setup` nie uruchamia żadnych testów.
- **`seed.spec.ts`** to wzorzec, nie realny test — Phase 3 pisze wszystkie testy
  od zera.
- **Nav.tsx:10** — `<nav aria-label='Nawigacja główna'>` — locator z wzorca
  działa.
- **LoginForm.tsx**: `label[for="email"] = "Adres email"`,
  `label[for="password"] = "Hasło"`, przycisk submit = `"Zaloguj się"`.

## Pożądany stan końcowy

Po zakończeniu Phase 3:

- `npx playwright test` uruchamia 3 testy w `auth-boundary.spec.ts` i
  przechodzi.
- Projekt `setup` waliduje sesję przed uruchomieniem `chromium`.
- §2 test-plan.md poprawne (redirect do `"/"`).
- §6.3 wypełniony wzorcem auth boundary.

### Kluczowe odkrycia:

- `src/middleware.ts:16` — `NextResponse.redirect(new URL("/", req.url))` (nie
  `/login`)
- `src/middleware.ts:21` — matcher:
  `["/((?!_next/static|_next/image|favicon.ico).*)"]`
- `playwright/.auth/` w `.gitignore` — `user.json` nie jest commitowany; plik
  istnieje lokalnie
- `seed.spec.ts:22` — wzorzec izolacji:
  `test.use({ storageState: { cookies: [], origins: [] } })`
- `src/app/dashboard/page.tsx:14` — `<h1>Panel studenta</h1>` (asercja w
  pozytywnym teście)

## Czego NIE robimy

- Nie tworzymy auth.setup.ts z pełnym flow logowania — istniejący `user.json`
  jest używany.
- Nie pokrywamy `/dashboard/history` ani `/dashboard/session/[id]/details` —
  middleware chroni je identycznie; 2 trasy z risk response guidance
  wystarczają.
- Nie modyfikujemy `playwright.config.ts` — konfiguracja jest poprawna.
- Nie dodajemy `E2E_EMAIL`/`E2E_PASSWORD` — auth.setup.ts nie robi logowania.

## Podejście do implementacji

Trzy niezależne fazy. Fazy 1 i 2 są niezależne od siebie względem kodu; Faza 3
to tylko edycja dokumentów.

**auth.setup.ts** — setup-as-validation: test `setup` ładuje
`playwright/.auth/user.json` explicite (`browser.newContext({ storageState })`),
nawiguje do `/dashboard` i asertuje URL. Jeśli sesja wygasła — test failuje z
czytelnym komunikatem. Projekt `setup` w Playwright.config.ts nie ma własnego
storageState, więc auth.setup.ts musi załadować go ręcznie.

**auth-boundary.spec.ts** — trzy testy w dwóch describe-blokach. Blok negatywny
używa `test.use({ storageState: { cookies: [], origins: [] } })` — żadnego
`user.json` nie jest potrzebne. Blok pozytywny używa domyślnego `storageState`
projektu `chromium` (`playwright/.auth/user.json`). Wszystkie locatory przez
`getByRole` (lub `getByLabel` tylko dla `input[type="password"]` jeśli role nie
zadziała — per seed pattern priority: `getByRole → getByLabel`).

## Krytyczne szczegóły implementacji

- **auth.setup.ts ładuje storageState explicite**:
  `browser.newContext({ storageState: 'playwright/.auth/user.json' })`. Bez tego
  `setup` projekt uruchamia się bez sesji i nawigacja do `/dashboard` zawsze
  kończy się przekierowaniem do `/` — fałszywy alarm.
- **Redirect target: `"/"`**, nie `"/login"`\*\*: testy negatywne używają
  `page.waitForURL('/')` i `page.waitForURL('/')`. Nigdy `waitForURL('/login')`.
- **Unauthenticated test dla `/dashboard/session/[id]`**: ID może być dowolnym
  stringiem (`'nonexistent-session-id'`). Middleware blokuje zanim page code się
  uruchomi — ID nie jest sprawdzane.

---

## Faza 1: auth.setup.ts — walidacja sesji

### Przegląd

Utwórz `src/__tests__/e2e/auth.setup.ts`. Projekt `setup` w playwright.config.ts
matchuje ten plik i musi go znaleźć. Test waliduje, że
`playwright/.auth/user.json` istnieje i zawiera ważną sesję, zanim projekt
`chromium` uruchomi swoje testy.

### Wymagane zmiany:

#### 1. `src/__tests__/e2e/auth.setup.ts` (nowy plik)

**Plik**: `src/__tests__/e2e/auth.setup.ts`

**Cel**: Walidacja istniejącej sesji z `playwright/.auth/user.json`. Jeśli sesja
wygasła lub plik nie istnieje — test failuje z czytelnym komunikatem wskazującym
jak odświeżyć sesję. Nie wykonuje żadnego flow logowania.

**Kontrakt**:

- Import: `test as setup, expect` z `@playwright/test`; `existsSync` z `node:fs`
- Stała `AUTH_FILE = 'playwright/.auth/user.json'`
- Sprawdź `existsSync(AUTH_FILE)` — jeśli false, `throw new Error(...)` z
  instrukcją regeneracji
- `browser.newContext({ storageState: AUTH_FILE })` → nowa strona →
  `page.goto('/dashboard')`
- Assert: `page.url()` kończy się `/dashboard` (brak przekierowania = sesja
  ważna)
- Zamknij context w `finally` (cleanup)

Komunikat błędu przy braku pliku lub wygasłej sesji musi wskazywać jak
wygenerować nowy `user.json`:
`npx playwright codegen http://localhost:3000 --save-storage=playwright/.auth/user.json`

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx playwright test --project=setup` przechodzi bez błędu

#### Weryfikacja ręczna:

- Output testu pokazuje `auth state is valid` (lub podobna nazwa)
- Tymczasowe usunięcie `playwright/.auth/user.json` powoduje failowanie testu z
  czytelnym komunikatem

---

## Faza 2: auth-boundary.spec.ts

### Przegląd

Utwórz `src/__tests__/e2e/auth-boundary.spec.ts` z 3 testami pokrywającymi Risk
#6. Plik jest testami produkcyjnymi dla Phase 3 rollout — nie wzorcem. Struktura
i nazwy testów muszą być risk-tied (wzorzec Pattern 4 z seed.spec.ts).

### Wymagane zmiany:

#### 1. `src/__tests__/e2e/auth-boundary.spec.ts` (nowy plik)

**Plik**: `src/__tests__/e2e/auth-boundary.spec.ts`

**Cel**: Zaimplementować 3 testy w 2 describe-blokach:

**Blok A** — `'auth boundary — unauthenticated access is blocked'`:

- `test.use({ storageState: { cookies: [], origins: [] } })` — izolacja
  per-describe
- **Test 1**:
  `'unauthenticated request to /dashboard is redirected and never serves protected content'`
- **Test 2**:
  `'unauthenticated request to /dashboard/session/[id] is redirected and never serves protected content'`

**Blok B** — `'auth boundary — authenticated user can access dashboard'`:

- Brak `test.use` — dziedziczy `storageState: 'playwright/.auth/user.json'` z
  projektu `chromium`
- **Test 3**:
  `'authenticated user reaches dashboard and sees protected content'`

**Kontrakt** dla każdego testu negatywnego (Test 1 i 2):

1. `page.goto('/dashboard')` /
   `page.goto('/dashboard/session/nonexistent-session-id')`
2. `page.waitForURL('/')` — middleware redirectuje do `"/"` (nie `"/login"`)
3. Asercja pozytywna:
   `getByRole('navigation', { name: 'Nawigacja główna' }).getByRole('link', { name: 'Zaloguj się' })`
   → `toBeVisible()`
4. Asercja negatywna: `getByRole('heading', { name: 'Panel studenta' })` →
   `not.toBeVisible()`
5. Cleanup: brak (flow stateless, brak danych server-side)

**Kontrakt** dla testu pozytywnego (Test 3):

1. `page.goto('/dashboard')`
2. `page.waitForURL('/dashboard')`
3. `getByRole('heading', { name: 'Panel studenta' })` → `toBeVisible()`
4. Cleanup: brak

**Zasada locatorów** (per seed pattern priority
`getByRole → getByLabel → getByText → getByTestId`):

- Wszystkie locatory w tym pliku używają `getByRole` lub zagnieżdżonego
  `getByRole`
- `getByLabel` nie jest używane (testy nie wypełniają formularzy)

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx playwright test auth-boundary` — wszystkie 3 testy przechodzą
- `npx playwright test --project=chromium` — przechodzi (wymaga działającego
  `setup`)

#### Weryfikacja ręczna:

- Dev server (`npm run dev`) uruchomiony na `http://localhost:3000`
- Test 1: nawigacja do `/dashboard` w trybie incognito bez ciasteczek →
  redirectuje do `/`
- Test 2: nawigacja do `/dashboard/session/fake-id` bez sesji → redirectuje do
  `/`
- Test 3: zalogowany użytkownik widzi "Panel studenta"

---

## Faza 3: Backport korekty test-plan + §6.3 cookbook

### Przegląd

Dwie edycje dokumentacji: korekta błędnego redirect-target w §2 test-plan.md
oraz wypełnienie §6.3 (dotychczas TBD) wzorcem auth boundary wynikającym z tej
fazy.

### Wymagane zmiany:

#### 1. `context/foundation/test-plan.md` — §2 Risk Response Guidance

**Plik**: `context/foundation/test-plan.md`

**Cel**: Usunąć błędną informację o redirect do `/login`. Middleware redirectuje
do `"/"`. Korekta udokumentowana przez research (`src/middleware.ts:16`).

**Kontrakt**: W kolumnie "What would prove protection" wiersza Risk #6 zmień
fragment: `"returns HTTP 302 to /login"` → `"returns redirect to / (root)"`

#### 2. `context/foundation/test-plan.md` — §6.3 cookbook

**Plik**: `context/foundation/test-plan.md`

**Cel**: Zastąpić placeholder `TBD — see §3 Phase 3` wzorcem auth boundary test
zbudowanym w Fazie 2. §6.3 będzie opisem jak dodawać przyszłe testy chronionych
tras.

**Kontrakt**: §6.3 (`### 6.3 Adding a middleware / auth boundary test`) musi
zawierać:

- Lokalizację: `src/__tests__/e2e/auth-boundary.spec.ts`
- Wzorzec izolacji: `test.use({ storageState: { cookies: [], origins: [] } })`
- Wzorzec locatorów dla negatywnej asercji:
  `getByRole('navigation', ...).getByRole('link', { name: 'Zaloguj się' })`
- Wzorzec asercji negatywnej: `getByRole('heading', ...).not.toBeVisible()`
- Wzorzec waitForURL: `waitForURL('/')` (redirect middleware → root, nie /login)
- Anti-pattern: `waitForTimeout`, CSS-selektory, asercja na `/login` zamiast
  `"/"`

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run typecheck` przechodzi (edycje markdown, brak wpływu na TS)

#### Weryfikacja ręczna:

- §2 Risk #6 "What would prove protection" nie zawiera `"/login"` jako redirect
  target
- §6.3 nie zawiera `TBD`; zawiera przykład wzorca dla trasy chronionej

---

## Strategia testowania

### Testy E2E:

- 2 testy negatywne: nieuwierzytelniony dostęp → redirect → brak chronionych
  treści
- 1 test pozytywny: uwierzytelniony dostęp → chronione treści widoczne
- Prerequisite: dev server na `localhost:3000`, `playwright/.auth/user.json` z
  ważną sesją

### Kroki testowania ręcznego:

1. Uruchom `npm run dev`
2. `npx playwright test --project=setup` — setup musi przejść
3. `npx playwright test auth-boundary` — 3 testy muszą przejść
4. Otwórz raport: `npx playwright show-report`
5. Zweryfikuj brak `"/login"` w §2 test-plan.md

## Referencje

- Badania: `context/changes/testing-auth-boundary-gate/research.md`
- Wzorzec: `src/__tests__/e2e/seed.spec.ts` (wzorzec, nie realny test)
- Middleware: `src/middleware.ts:15-16`
- Matcher: `src/middleware.ts:21`
- Nav aria-label: `src/shared/components/Nav/Nav.tsx:10`
- Dashboard heading: `src/app/dashboard/page.tsx:14`
- Playwright config: `playwright.config.ts`

---

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku.

### Faza 1: auth.setup.ts — walidacja sesji

#### Automatyczne

- [x] 1.1 `npx playwright test --project=setup` przechodzi — e7a4c97

#### Ręczne

- [ ] 1.2 Tymczasowe usunięcie `playwright/.auth/user.json` powoduje failowanie
      z czytelnym komunikatem

### Faza 2: auth-boundary.spec.ts

#### Automatyczne

- [x] 2.1 `npx playwright test auth-boundary` — wszystkie 3 testy przechodzą

#### Ręczne

- [ ] 2.2 Test 1: nawigacja incognito do `/dashboard` → redirect do `/`
- [ ] 2.3 Test 2: nawigacja incognito do `/dashboard/session/fake-id` → redirect
      do `/`
- [ ] 2.4 Test 3: zalogowany użytkownik widzi "Panel studenta"

### Faza 3: Backport test-plan

#### Ręczne

- [ ] 3.1 §2 Risk #6 nie zawiera `"/login"` jako redirect target
- [ ] 3.2 §6.3 zawiera wzorzec auth boundary (nie TBD)
