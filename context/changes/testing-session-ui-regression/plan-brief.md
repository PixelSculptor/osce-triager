# Regresja UI sesji — baseline — Krótki plan

> Pełny plan: `context/changes/testing-session-ui-regression/plan.md` Badania:
> `context/changes/testing-session-ui-regression/research.md`

## Co i dlaczego

Testy regresji UI sesji (Faza 5 planu testów) chronią przed cichą awarią DnD,
gdzie zmiana kodu `SessionView` lub konfiguracji `@dnd-kit` sprawia, że
przeciągnięcie pierwszego lub ostatniego badania na listę milcząco nic nie robi
— udokumentowany poprzedni incydent (wywiad Q2). Ryzyko jest wysokie, bo
`src/modules/session/components` miał 32 zmiany/30 dni.

## Punkt wyjścia

`@testing-library/react` nie jest zainstalowane; vitest działa w
`environment: 'node'`; logika reorder jest prywatna wewnątrz `handleDragEnd` w
`SessionView.tsx:183–209`. Istniejący E2E (`session-flow.spec.ts`) testuje tylko
ścieżkę klik-button — brak weryfikacji samego `arrayMove`.

## Pożądany stan końcowy

Po ukończeniu: `applyReorder` jest eksportowaną czystą funkcją z testami
jednostkowymi dla edge cases first→last i last→first; `SessionView.test.tsx`
(jsdom) weryfikuje, że klik "Zleć" wyświetla badge "Poprawne"; §6.5 w
test-plan.md ma gotowy wzorzec podręcznika.

## Kluczowe podjęte decyzje

| Decyzja               | Wybór                                   | Dlaczego (1 zdanie)                                                                                      | Źródło |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| Jak testować DnD      | Wyodrębnij `applyReorder` + unit test   | PointerSensor z `distance: 8` jest nieprzewidywalny w jsdom; czysta funkcja daje deterministyczny sygnał | Plan   |
| Scope pliku testowego | Jeden `SessionView.test.tsx`            | Oba testy (reorder + badge) dotyczą SessionView — jeden setup, jedna faza                                | Plan   |
| Konfiguracja jsdom    | Per-file `// @vitest-environment jsdom` | Globalna zmiana złamałaby istniejące testy integracyjne DB                                               | Plan   |

## Zakres

**W zakresie:**

- Instalacja 4 devDependencies (`@testing-library/react` v16, `user-event` v14,
  `jest-dom`, `jsdom`)
- Ekstrakcja `applyReorder` + `export interface OrderedTest` z `SessionView.tsx`
- 5 testów jednostkowych dla `applyReorder` (node env)
- 1 test komponentowy badge feedback (jsdom)
- Uzupełnienie §6.5 cookbook + §3 Faza 5 status `complete`

**Poza zakresem:**

- Symulacja pointer drag w jsdom
- DnD collision detection (zakres E2E / Playwright)
- Testy reorder przez KeyboardSensor
- Refaktoryzacja SessionView poza ekstrakcją funkcji

## Architektura / Podejście

```
SessionView.tsx
  └─ export applyReorder(tests, activeId, overId): OrderedTest[]
  └─ export interface OrderedTest

SessionView.reorder.test.ts  (node env)
  └─ applyReorder: 5 unit tests

SessionView.test.tsx  (jsdom)
  └─ vi.mock actions + next/link
  └─ vi.useFakeTimers() (timer guard)
  └─ click "Zleć" → selectTestAction mock → findByLabelText → badge
```

## Fazy w skrócie

| Faza              | Co dostarcza                            | Kluczowe ryzyko                                                   |
| ----------------- | --------------------------------------- | ----------------------------------------------------------------- |
| 1. Setup          | 4 devDependencies + vitest.setup.ts     | Konflikt wersji (React 19 + @testing-library/react v15)           |
| 2. applyReorder   | Czysta funkcja + 5 unit testów          | Eksport `OrderedTest` może wymagać aktualizacji barrel `index.ts` |
| 3. Badge feedback | `SessionView.test.tsx` (jsdom)          | `act()` ostrzeżenia z `setInterval`; `findByLabelText` timeout    |
| 4. §6.5 cookbook  | Wzorzec podręcznika + Faza 5 = complete | —                                                                 |

**Wymagania wstępne:** Node.js ≥ 20 (już); Fazy 1–3 ukończonej planu testów
(done) **Szacowany nakład pracy:** ~2 sesje, 4 fazy sekwencyjne

## Otwarte ryzyka i założenia

- `@testing-library/react` v16 jest RC dla React 19 — sprawdź peer deps przy
  instalacji; jeśli conflict, spróbuj `--legacy-peer-deps`
- `jsdom` v26 wymaga Node 20+ — projekt już na Node 22 (CI:
  `node-version: '22'`)
- CSS Modules w jsdom: Vitest 3 obsługuje je natywnie (zwraca pusty obiekt);
  brak dodatkowej konfiguracji

## Kryteria sukcesu (podsumowanie)

- `npm run test` przechodzi bez `DATABASE_URL_TEST` (wszystkie 5+1 nowych testów
  zielone)
- Celowe złamanie logiki reorder lub wartości mock `validatorResult` powoduje
  czerwony test
- §6.5 w `context/foundation/test-plan.md` uzupełniony; brak `DO UZUPEŁNIENIA`
