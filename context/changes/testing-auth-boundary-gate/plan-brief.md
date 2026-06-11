# Auth boundary gate — Krótki plan

> Pełny plan: `context/changes/testing-auth-boundary-gate/plan.md` Badania:
> `context/changes/testing-auth-boundary-gate/research.md`

## Co i dlaczego

Udowodnić, że middleware Next.js/Auth.js blokuje nieuwierzytelniony dostęp do
`/dashboard/*` i że istniejąca konfiguracja (Cloudflare Workers, auth.config.ts
split) działa zgodnie z oczekiwaniami. Risk #6 z planu testów: brak testu = brak
ochrony przed regresją w konfiguracji middleware.

## Punkt wyjścia

`playwright/.auth/user.json` istnieje z ważną sesją. Playwright jest
skonfigurowany z projektem `setup` i `chromium`, ale brak `auth.setup.ts` —
projekt `setup` uruchamia zero testów. `seed.spec.ts` to wzorzec (nie realny
test).

## Pożądany stan końcowy

`npx playwright test` uruchamia 3 testy w `auth-boundary.spec.ts`: 2 negatywne
(unauthenticated → redirect do `/`) i 1 pozytywny (authenticated → "Panel
studenta" widoczny). `auth.setup.ts` waliduje sesję przed uruchomieniem
`chromium`.

## Kluczowe podjęte decyzje

| Decyzja                   | Wybór                                    | Dlaczego (1 zdanie)                                                                                          | Źródło             |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------ |
| Redirect target w testach | `"/"` (root), nie `"/login"`             | `middleware.ts:16` redirectuje do `/` — page-level redirect do `/login` nigdy nie odpala dla unauthenticated | Badania            |
| auth.setup.ts podejście   | Walidacja sesji, nie re-login            | `playwright/.auth/user.json` istnieje i jest ważny — re-login byłby zbędny                                   | Badania + feedback |
| Locatory                  | `getByRole` (priorytet)                  | Przeżywa zmiany CSS, DOM i komponentów; per seed pattern priority                                            | Plan               |
| Zakres testów             | `/dashboard` + `/dashboard/session/[id]` | Minimalne pokrycie wskazane w risk response guidance                                                         | Plan               |
| Pozytywny test            | Tak                                      | Weryfikuje, że auth.setup.ts faktycznie waliduje działającą sesję                                            | Plan               |

## Zakres

**W zakresie:**

- `src/__tests__/e2e/auth.setup.ts` — nowy plik, walidacja sesji
- `src/__tests__/e2e/auth-boundary.spec.ts` — 3 testy E2E
- `context/foundation/test-plan.md` §2 korekta redirect target
- `context/foundation/test-plan.md` §6.3 wypełnienie wzorcem

**Poza zakresem:**

- Modyfikacja `playwright.config.ts`
- Testy dla `/dashboard/history`, `/dashboard/session/[id]/details`
- Tworzenie test user / flow rejestracji w setupie
- `E2E_EMAIL`/`E2E_PASSWORD` env vars

## Architektura / Podejście

```
auth.setup.ts (projekt "setup")
  └─ browser.newContext({ storageState: user.json })
  └─ goto('/dashboard') → assert URL = '/dashboard' (sesja ważna)

auth-boundary.spec.ts (projekt "chromium", depends on "setup")
  ├─ describe A: test.use({ storageState: { cookies: [], origins: [] } })
  │   ├─ Test 1: goto('/dashboard') → waitForURL('/') → assert "Zaloguj się" visible
  │   └─ Test 2: goto('/dashboard/session/fake-id') → waitForURL('/') → same
  └─ describe B: (default storageState = user.json)
      └─ Test 3: goto('/dashboard') → waitForURL('/dashboard') → "Panel studenta" visible
```

## Fazy w skrócie

| Faza                     | Co dostarcza                                 | Kluczowe ryzyko                                               |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------- |
| 1. auth.setup.ts         | Projekt `setup` uruchamia testy zamiast zera | Sesja w user.json może wygasnąć — trzeba ją odświeżyć ręcznie |
| 2. auth-boundary.spec.ts | 3 testy pokrywające Risk #6                  | Pozytywny test wymaga działającego dev servera z DB           |
| 3. Backport test-plan    | §2 poprawiony, §6.3 gotowy                   | Brak ryzyka — edycja dokumentów                               |

**Wymagania wstępne:** `npm run dev` uruchomiony, `playwright/.auth/user.json` z
ważną sesją  
**Szacowany nakład pracy:** ~1 sesja, 3 fazy

## Otwarte ryzyka i założenia

- Sesja w `playwright/.auth/user.json` ma `expires: 1783754747` (ważna do
  2026-05) — jeśli wygaśnie, test `setup` failuje; trzeba ją odświeżyć przez
  `npx playwright codegen`
- Test 3 (pozytywny) wywołuje `getScenarios()` z DB — jeśli DB jest down, test
  failuje z powodu braku danych, nie braku auth

## Kryteria sukcesu (podsumowanie)

- `npx playwright test --project=setup` przechodzi (sesja ważna)
- `npx playwright test auth-boundary` — 3/3 testy przechodzą
- §2 test-plan.md nie zawiera `"/login"` jako redirect target dla Risk #6
