---
date: 2026-06-16T09:38:26+00:00
researcher: Kacper Nadstoga
git_commit: 43098945100a3b3bc45bab9b86b0a1b5b2d31575
branch: add-missing-tests
repository: osce-traiger
topic: 'Jakie komponenty UI są w sesji triagingu'
tags: [research, session-ui, components, dnd-kit, triage-flow]
status: complete
last_updated: 2026-06-16
last_updated_by: Kacper Nadstoga
---

# Research: Komponenty UI w sesji triagingu

**Date**: 2026-06-16T09:38:26+00:00 **Researcher**: Kacper Nadstoga **Git
Commit**: 43098945100a3b3bc45bab9b86b0a1b5b2d31575 **Branch**: add-missing-tests
**Repository**: osce-traiger

## Research Question

Jakie komponenty UI są w sesji triagingu?

## Summary

Sesja triagingu składa się z 4 tras w `src/app/dashboard/` i 8 komponentów
współdzielonych z `src/modules/session/components/`. Głównym orkiestratorem jest
`SessionView` — jedyny `'use client'` komponent w aktywnej sesji, zarządzający
timerem, drag-and-drop (dnd-kit) i wywoływaniem Server Actions. Cały stan sesji
jest kolokowany w `SessionView` — brak zewnętrznych providerów ani customowych
hooków sesji.

---

## Detailed Findings

### Trasy (Routes)

| Trasa                                    | Plik                                                     | Typ | Opis                                                          |
| ---------------------------------------- | -------------------------------------------------------- | --- | ------------------------------------------------------------- |
| `/dashboard`                             | `src/app/dashboard/page.tsx`                             | RSC | Lista scenariuszy; renderuje `ScenarioCard` dla każdego       |
| `/dashboard/session/[sessionId]`         | `src/app/dashboard/session/[sessionId]/page.tsx`         | RSC | Aktywna sesja; pobiera dane i hydratuje `SessionView`         |
| `/dashboard/session/[sessionId]/details` | `src/app/dashboard/session/[sessionId]/details/page.tsx` | RSC | Przegląd zakończonej sesji; brak sub-komponentów — czysty SSR |
| `/dashboard/history`                     | `src/app/dashboard/history/page.tsx`                     | RSC | Historia sesji; renderuje `HistoryFilter`                     |

### Komponenty aktywnej sesji

#### `SessionView` — główny orkiestrator

- **Plik**: `src/modules/session/components/SessionView.tsx`
- **Typ**: `'use client'`
- **Props**:
  - `sessionId: string`
  - `timeLimitSeconds: number`
  - `startedAt: string` (ISO)
  - `tests: Array<{ id: string; name: string }>`
  - `classifications: Record<string, TestCategory>`
  - `initialEvents: Array<{ testId: string; validatorResult: ValidatorResult }>`
  - `sessionOutcome: 'in_progress' | 'positive' | 'negative'`
- **Stan wewnętrzny**:
  - `orderedTests: OrderedTest[]` — testy wybrane przez użytkownika (prawa
    kolumna)
  - `sessionState: 'in_progress' | 'positive' | 'negative'`
  - `remainingSeconds: number` — odliczanie przez `setInterval`
  - `skippedCritical: string[]` — krytyczne brakujące testy po zakończeniu
  - `loadingTestId: string | null` — blokada podczas pending `selectTestAction`
  - `isEnding: boolean` + `endingRef` — guard przeciw double-end
  - `activeId / activeName / activeSource` — stan DragOverlay
  - `selectError: string | null`
- **Zachowanie**:
  - Timer → auto-wywołuje `handleEndSession()` przy 0
  - Przeciągnięcie z lewej kolumny → `handleSelectTest()` → `selectTestAction`
  - Przeciągnięcie w prawej kolumnie → reorder via `arrayMove`
  - Po zakończeniu sesji renderuje ekran wynikowy zamiast layoutu dwukolumnowego
- **Biblioteka DnD**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Renderuje**: `DraggableTestCard`, `SortableTestCard`, `TestCard`
  (DragOverlay), `Button`, `Spinner`, `DndContext`, `SortableContext`,
  `DragOverlay`

#### `DraggableTestCard`

- **Plik**: `src/modules/session/components/DraggableTestCard.tsx`
- **Props**: `testId`, `name`, `onSelect?`, `isLoading?`
- Owija `TestCard` hookiem
  `useDraggable({ id: testId, data: { source: 'available', name } })`
- CSS transform podczas przeciągania; atrybut `data-dragging`
- `aria-label`: `"Przeciągnij: ${name}"`

#### `SortableTestCard`

- **Plik**: `src/modules/session/components/SortableTestCard.tsx`
- **Props**: `testId`, `name`, `validatorResult?`
- Owija `TestCard` hookiem
  `useSortable({ id: testId, data: { source: 'ordered' } })`
- `opacity: 0.4` podczas przeciągania
- `aria-label`: `"Zmień kolejność: ${name}"`

#### `TestCard` — liść wyświetlający

- **Plik**: `src/modules/session/components/TestCard.tsx`
- **Props**: `name`, `validatorResult?`, `onSelect?`, `isLoading?`
- Jeśli `validatorResult` zdefiniowany → badge z etykietą i kolorem
- Jeśli niewybrany → przycisk "Zleć" wywołujący `onSelect`
- Używany też standalone w `DragOverlay` (tylko `name`)
- **Mapowanie badge**:
  - `correct` → `--color-success-*` (zielony)
  - `suboptimal` → `--color-warning-*` (żółty)
  - `unnecessary` → `--color-danger-*` (czerwony)
  - `critical_miss` → `--color-danger-*` / szary

### Komponenty wyboru scenariusza

#### `ScenarioCard`

- **Plik**: `src/modules/session/components/ScenarioCard.tsx`
- **Props**: `id`, `title`, `description`, `timeLimitSeconds`
- **Stan**: `loading: boolean`, `error: string | null`
- Przycisk "Rozpocznij sesję" → `startSessionAction(id)` →
  `router.push(/dashboard/session/${sessionId})`
- Renderuje `Spinner` podczas ładowania

### Komponenty historii

#### `HistoryFilter`

- **Plik**: `src/modules/session/components/HistoryFilter.tsx`
- **Typ**: `'use client'`
- **Props**: `sessions: SessionItem[]`
- **Stan**: `filter: 'all' | 'positive' | 'negative'`
- Renderuje 3 przyciski toggle (`aria-pressed`) + przefiltrowaną listę
  `HistoryCard`

#### `HistoryCard`

- **Plik**: `src/modules/session/components/HistoryCard.tsx`
- **Props**: `id`, `scenarioTitle`, `outcome`, `startedAt`, `completedAt`
- Wyświetla: tytuł scenariusza, badge wyniku, datę, czas trwania (MM:SS), Link
  do `/details`
- Brak stanu; czysty display

### Współdzielone komponenty UI

#### `Button`

- **Plik**: `src/shared/components/Button/Button.tsx`
- **Warianty**: `primary | secondary | ghost | danger`
- **Rozmiary**: `sm | md`
- Używany w: `ScenarioCard`, `TestCard`, `SessionView`, `HistoryFilter`

#### `Spinner`

- **Plik**: `src/shared/components/Spinner/Spinner.tsx`
- **Props**: `size?: 'sm' | 'md'`
- `<span role="status" aria-label="Ładowanie">`
- Używany w: `ScenarioCard`, `TestCard`/`DraggableTestCard` (pending state)

---

## Code References

- `src/modules/session/components/SessionView.tsx` — główny orkiestrator
  aktywnej sesji (timer, DnD, Server Actions)
- `src/modules/session/components/TestCard.tsx` — liść wyświetlający test z
  badge walidatora
- `src/modules/session/components/DraggableTestCard.tsx` — wrapper DnD dla
  dostępnych testów
- `src/modules/session/components/SortableTestCard.tsx` — wrapper DnD dla testów
  w kolejce
- `src/modules/session/components/ScenarioCard.tsx` — karta wyboru scenariusza
- `src/modules/session/components/HistoryCard.tsx` — karta historii
- `src/modules/session/components/HistoryFilter.tsx` — filtr historii
  (all/positive/negative)
- `src/modules/session/components/index.ts` — public exports
- `src/modules/session/actions.ts` — Server Actions: `startSessionAction`,
  `selectTestAction`, `endSessionAction`
- `src/modules/session/queries.ts` — zapytania DB do sesji
- `src/modules/session/session.types.ts` — typy: `StartSessionResult`,
  `SelectTestResult`, `EndSessionResult`
- `src/shared/lib/validator.ts` — typy: `ValidatorResult`, `TestCategory`
- `src/app/dashboard/page.tsx` — RSC renderujący `ScenarioCard`
- `src/app/dashboard/session/[sessionId]/page.tsx` — RSC hydratujący
  `SessionView`
- `src/app/dashboard/session/[sessionId]/details/page.tsx` — RSC przeglądu sesji
  (brak sub-komponentów)
- `src/app/dashboard/history/page.tsx` — RSC renderujący `HistoryFilter`

---

## Architecture Insights

1. **Cały stan w `SessionView`** — brak zewnętrznych Context Providerów ani
   customowych hooków sesji. Upraszcza testowanie komponentowe (można przekazać
   props bezpośrednio), ale `SessionView` jest dużym komponentem.

2. **DnD edge case — znane ryzyko**: `over` może być `null` gdy kursor jest na
   krawędzi listy (pierwszy/ostatni element). Jest to udokumentowany
   wcześniejszy błąd. Bieżąca zmiana (`testing-session-ui-regression`) ma pokryć
   ten edge case.

3. **CSS Modules + tokeny**: Wszystkie komponenty sesji mają parowane
   `.module.css`. Kolory badge używają zmiennych `--color-success-*`,
   `--color-warning-*`, `--color-danger-*` — tematowanie działa przez CSS custom
   properties.

4. **Strona `/details` nie ma sub-komponentów** — jest czystym SSR HTML + CSS
   Modules, co utrudnia testowanie izolowane komponentu.

5. **Aria-labels specyficzne dla DnD**: `"Przeciągnij: ${name}"` (dostępne) i
   `"Zmień kolejność: ${name}"` (zamówione) — używane w istniejących testach E2E
   jako selektory (`getByLabel`).

---

## Historical Context (from prior changes)

- `context/changes/first-playable-session/plan.md` — Pierwotna implementacja
  `SessionView`, `TestCard`, `DraggableTestCard`, `SortableTestCard`,
  `ScenarioCard`; S-02
- `context/changes/session-history-save/plan.md` — Dodanie `HistoryCard`, strony
  `/history`, strony `/details`; S-03
- `context/changes/ui-design-system/plan.md` — Migracja CSS Modules, tokeny
  designu, `Button`, `ThemeToggle`; faza 4
- `context/changes/ui-refresh/plan.md` — `HistoryFilter`, responsywne gridy,
  redesign badge, efekty hover; fazy 1–6
- `context/changes/testing-e2e-session-flow/plan.md` — E2E testy głównego
  przepływu sesji (`session-flow.spec.ts`, `login-form.spec.ts`); używa
  `getByLabel('Zmień kolejność: ...')` jako selektora

---

## Related Research

Brak innych plików `research.md` w `context/changes/`.

---

## Open Questions

1. **DnD edge case** — Jak dokładnie zachowuje się `onDragOver` gdy
   `over === null` na krawędzi? Wymaga sprawdzenia `SessionView.tsx` przy
   planowaniu testów regresji.
2. **`SessionView` jako duży komponent** — czy warto wyodrębnić logikę timera i
   DnD do customowych hooków dla łatwiejszego testowania? (poza zakresem tej
   zmiany)
3. **Strona `/details` bez sub-komponentów** — testy E2E lub snapshot są jedyną
   opcją pokrycia tego widoku.
