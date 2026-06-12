# Setup CI Pipeline — Krótki plan

> Pełny plan: `context/changes/setup-ci-pipeline/plan.md` Badania:
> `context/changes/setup-ci-pipeline/research.md`

## Co i dlaczego

Wdrożyć workflow GitHub Actions wyzwalany na każdy PR do `main`, zawierający
testy jednostkowe, integracyjne i E2E jako bramkę jakości. Przy okazji zastąpić
przestarzały mechanizm auth w Playwright (pre-saved token wygasł 2026-06-11)
logiką form fill, eliminując Ryzyko #8 z test-plan.md.

## Punkt wyjścia

Istnieją dwa workflow: `deploy.yml` (push→main, zero testów) i `cleanup.yml`
(cron, niezwiązany). Trzy warstwy testów są gotowe (unit, integration z
`describe.skipIf`, E2E boundary), ale żadna nie jest uruchamiana automatycznie
na PR. `auth.setup.ts` ładuje pre-saved token, który wygasł.

## Pożądany stan końcowy

Każdy PR do `main` przechodzi przez 4-jobową bramkę CI (~8-10 min). Playwright
loguje się przez formularz na każdym CI run (nowa sesja, zero problemu z
wygaśnięciem). `playwright.config.ts` zarządza serwerem Next.js automatycznie
przez `webServer`.

## Kluczowe podjęte decyzje

| Decyzja              | Wybór                              | Dlaczego (1 zdanie)                                                                                      | Źródło  |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| Auth strategia E2E   | Form fill (Opcja A)                | Token pre-saved wygasł; form fill pokrywa Ryzyko #8 i nie wymaga zarządzania sekretem z datą wygaśnięcia | Badania |
| AUTH_SECRET w CI     | Dedykowany test secret             | Izolacja — tokeny z CI nie są dekodownable w produkcji                                                   | Plan    |
| Server management    | `webServer` w playwright.config.ts | Playwright zarządza auto-start/auto-kill/healthcheck; lokalnie reuse istniejącego serwera                | Plan    |
| Seed testowego usera | Oddzielny `seed:test` script       | Nie zaśmieca produkcyjnych seedów; credentials dopasowane do GitHub Secrets                              | Plan    |
| Job architecture     | 4 joby, Job 1 gate                 | lint-typecheck blokuje drogie joby przy błędach składni; 3/4 parallel oszczędza ~5 min                   | Badania |

## Zakres

**W zakresie:**

- Nowy `.github/workflows/ci.yml` (trigger: `pull_request → main`)
- Zastąpienie `src/__tests__/e2e/auth.setup.ts` form fill logiką
- Dodanie `webServer` do `playwright.config.ts`
- Nowy `src/shared/lib/seed-test.ts` + `"seed:test"` w `package.json`

**Poza zakresem:**

- Zmiany w `deploy.yml` (push→main pozostaje bez zmian)
- Cache Supabase Docker images (optymalizacja do dodania później)
- Zmiana konfiguracji projektów Playwright (setup + chromium projects)
- Uruchomienie `opennextjs-cloudflare preview` dla E2E

## Architektura / Podejście

```
PR → main
  └─ lint-typecheck (~1-2 min)
       ├─ unit-tests (~1 min)         ← no DB, vitest run
       ├─ integration-tests (~5-7 min) ← supabase start + drizzle push + vitest run (DATABASE_URL_TEST)
       └─ e2e-tests (~6-8 min)        ← supabase start + drizzle push + seed + seed:test
                                          + next build + playwright test (webServer: next start)
```

`auth.setup.ts` (Playwright setup project) → form fill →
`playwright/.auth/user.json` (runtime, nie commitowany)  
`seed-test.ts` → bcryptjs hash → insert do `user` table → credentials z GitHub
Secrets

## Fazy w skrócie

| Faza                                     | Co dostarcza                                                     | Kluczowe ryzyko                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Playwright form fill auth + webServer | `auth.setup.ts` loguje przez formularz; config zarządza serwerem | `getByLabel` lokatory muszą pasować do aktualnego DOM formularza        |
| 2. Test user seed                        | `npm run seed:test` tworzy usera w test DB                       | bcrypt hash musi być kompatybilny z `auth.ts` (ten sam moduł: bcryptjs) |
| 3. CI PR workflow                        | `.github/workflows/ci.yml` z 4 jobami                            | Sekrety muszą być dodane do GitHub repo przed pierwszym uruchomieniem   |

**Wymagania wstępne:** GitHub Secrets do dodania ręcznie przed Fazą 3:
`AUTH_SECRET_TEST` (`openssl rand -base64 32`), `TEST_USER_EMAIL`,
`TEST_USER_PASSWORD`. Vars `NEXT_PUBLIC_SUPABASE_URL` i
`NEXT_PUBLIC_SUPABASE_ANON_KEY` już istnieją.

**Szacowany nakład pracy:** ~1-2 sesje, 3 fazy. Fazy 1 i 2 można realizować
lokalnie bez dostępu do GitHub Actions.

## Otwarte ryzyka i założenia

- `npx supabase start` bez cache pobiera obrazy Docker (~2-3 min pierwsza run);
  akceptowalne dla MVP CI
- `npm run build` w job `e2e-tests` zajmuje ~1-2 min na ubuntu-latest; łączny
  czas joba ~8 min
- `drizzle-kit push --force` na pustej DB — `--force` wymagany w CI, żeby
  pominąć interaktywne pytania
- Lokalnie `reuseExistingServer: !process.env.CI` — tester musi mieć działający
  serwer (`next dev` lub `next start`) przed `npm run test:e2e`

## Kryteria sukcesu (podsumowanie)

- PR do `main` pokazuje 4 zielone checksy w GitHub Actions
- Log `e2e-tests` → `authenticate via login form` (PASSED)
- PR z błędem lintowania jest blokowany przez `lint-typecheck` gate
