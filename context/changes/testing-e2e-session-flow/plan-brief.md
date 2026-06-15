# E2E Main Session Flow — Krótki plan

> Pełny plan: `context/changes/testing-e2e-session-flow/plan.md`

## Co i dlaczego

Dodajemy dwa pliki spec Playwright chroniące Ryzyko #7 (pełny flow diagnostyczny
w przeglądarce) i Ryzyko #8 (formularz logowania) z Fazy 4 planu testów. Bez
nich regresja w głównej ścieżce produktu (S-02: student wybiera badania, dostaje
feedback, kończy sesję) jest wykrywana tylko ręcznie.

## Punkt wyjścia

Playwright jest zainstalowany i skonfigurowany. `auth.setup.ts` już wypełnia
formularz logowania. Istnieją testy dla middleware (Risk #6). Brakuje testów dla
samego flow sesji i dla login form jako jawnego, nazwanego testu.

## Pożądany stan końcowy

Dwa nowe pliki spec w `src/__tests__/e2e/`: `session-flow.spec.ts` (DnD → badge
"Poprawne" → "Pozytywny" w historii) i `login-form.spec.ts` (form fill →
redirect → "Panel studenta"). Oba zielone w
`npx playwright test src/__tests__/e2e/`. Sekcja §6.4 w `test-plan.md`
uzupełniona o wzorce.

## Kluczowe podjęte decyzje

| Decyzja                         | Wybór                                     | Dlaczego (1 zdanie)                                                                                                                                                                                                             | Źródło |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Metoda selekcji testu (Risk #7) | Przycisk "Zleć" (nie DnD)                 | Anti-pattern test-plan.md łączy button click Z brakiem asercji na feedback UI — używamy przycisku ale asertujemy pełny łańcuch; DnD w headless CI z PointerSensor jest niestabilny, a DnD regression należy do Risk #4 / Fazy 5 | Plan   |
| Risk #8 spec                    | Osobny plik, nie zmiana auth.setup.ts     | `auth.setup.ts` to infrastruktura — bez dedykowanego testu regresja login form daje nieczytelny sygnał                                                                                                                          | Plan   |
| Izolacja historii               | Assert po nazwie scenariusza, bez cleanup | Kumulacja sesji testowych akceptowalna dla MVP; cleanup wymagałby endpointu DB                                                                                                                                                  | Plan   |
| Podział na fazy                 | 2 fazy (Risk #7 → Risk #8)                | Każde ryzyko ma własny commit i milestone; Faza 1 jest bardziej złożona (DnD)                                                                                                                                                   | Plan   |

## Zakres

**W zakresie:**

- `src/__tests__/e2e/session-flow.spec.ts` (Risk #7)
- `src/__tests__/e2e/login-form.spec.ts` (Risk #8)
- Uzupełnienie `context/foundation/test-plan.md` §6.4

**Poza zakresem:**

- Zmiana `auth.setup.ts`
- Testy DnD edge cases (pierwsze/ostatnie badanie) — to Faza 5
- Negatywny wynik sesji, flow timer auto-end
- Cleanup sesji testowych w historii
- Formularz rejestracji (poza zakresem per test-plan.md §7)

## Architektura / Podejście

Oba testy korzystają z istniejącej infrastruktury (`playwright.config.ts`,
projekt chromium, `storageState`). `session-flow.spec.ts` używa storageState
(inherits z setup); `login-form.spec.ts` overrideuje na puste cookies. Selekcja
testu przez przycisk "Zleć" scoped do karty zawierającej nazwę badania —
deterministyczna i stabilna w headless CI. Oracle: badge "Poprawne" pochodzi z
klasyfikacji `critical` dt-001 w Scenariuszu 1 (fixed seed data).

## Fazy w skrócie

| Faza                 | Co dostarcza                                                           | Kluczowe ryzyko                                                     |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Main session flow | `session-flow.spec.ts` zielony, przycisk "Zleć" + walidator + historia | Scoping przycisku "Zleć" do właściwej karty gdy lista ma wiele kart |
| 2. Login form + §6.4 | `login-form.spec.ts` zielony, test-plan.md §6.4 uzupełniony            | Brak — flow login jest dobrze znany z auth.setup.ts                 |

**Wymagania wstępne:** Działająca aplikacja (`npm run start` lub dev server na
porcie 3000), `TEST_USER_EMAIL` i `TEST_USER_PASSWORD` ustawione w środowisku.  
**Szacowany nakład pracy:** ~1 sesja, 2 fazy.

## Otwarte ryzyka i założenia

- Seed data jest stała (dt-001 = critical w Scenariuszu 1) — oracle jest
  stabilny dopóki seed się nie zmieni
- DnD regression (Risk #4) jest celowo pozostawiony do Fazy 5 — jeśli zakres się
  zmieni, plan wymaga aktualizacji

## Kryteria sukcesu (podsumowanie)

- `npx playwright test src/__tests__/e2e/` — wszystkie cztery pliki spec zielone
- Intentional break potwierdzony dla obu testów (test czerwony gdy ryzyko się
  zmaterializuje)
- §6.4 w `test-plan.md` zawiera wzorce, nie placeholder
