# Session History Save — Krótki plan

> Pełny plan: `context/changes/session-history-save/plan.md`

## Co i dlaczego

Student po zakończeniu sesji diagnostycznej nie ma gdzie zobaczyć historii swoich wyników — dashboard pokazuje tylko dostępne scenariusze. S-03 surfuje dane już zapisane w DB przez `endSessionAction` (S-02): dodaje stronę historii, komponent karty, link w Nav i read-only widok szczegółów sesji.

## Punkt wyjścia

`sessionResults` i `sessionEvents` są w pełni wypełniane przez S-02 — zapis do DB działa. Brakuje tylko warstwy query + UI. Nav nie ma linku do historii; nie istnieje żadna strona listująca sesje użytkownika.

## Pożądany stan końcowy

Zalogowany student klika "Historia" w nawigacji, widzi listę zakończonych sesji (scenariusz, wynik, data, czas trwania), klika wpis i widzi read-only breakdown wybranych badań z wynikami walidatora. Każde zapytanie filtruje po `userId` — student A nie widzi sesji studenta B.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Lokalizacja historii | Osobna strona `/dashboard/history` | Czysty podział — dashboard = wybór scenariusza, historia = wyniki | Plan |
| Dane wpisu | Scenariusz + wynik + data + czas trwania | Wystarczające dla MVP bez join z sessionEvents na liście | Plan |
| Sesje in_progress | Filtrowane poza historią | Prosta semantyka — historia = zakończone | Plan |
| Post-session UX | Zostaje na `/session/[id]` (bez zmian) | Zero ryzyka regresji w SessionView | Plan |
| Detail view | Nowa strona `/session/[id]/details` (RSC) | Read-only widok bez reuse SessionView (który ma timer i interakcje) | Plan |
| Izolacja danych | `userId` w WHERE każdego query | NFR z PRD — sesje muszą być izolowane między kontami | Plan |

## Zakres

**W zakresie:**
- `getUserSessions(userId)` w `queries.ts`
- Strona `/dashboard/history` (RSC) + `HistoryCard` komponent
- Link "Historia" w Nav (dla zalogowanych)
- `getSessionDetails(sessionId, userId)` w `queries.ts`
- Strona `/dashboard/session/[id]/details` (RSC, read-only)
- 404 przy próbie dostępu do cudzej sesji

**Poza zakresem:**
- Redirect po zakończeniu sesji (flow SessionView bez zmian)
- Dashboard stats / pass-rate aggregates
- Możliwość wznowienia sesji in_progress
- Zmiana schematu DB (brak migracji)

## Architektura / Podejście

Dwa nowe query functions w istniejącym `queries.ts` (server-only, Drizzle). Dwie nowe RSC strony: jedna listująca, jedna detaliowa. Jeden nowy komponent `HistoryCard` (CSS Module). Izolacja przez `userId` w każdym WHERE — notFound() gdy sesja nie istnieje lub nie należy do użytkownika.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Historia listing | `/dashboard/history` + HistoryCard + Nav link | Pusty stan; izolacja userId w query |
| 2. Szczegóły sesji | `/session/[id]/details` read-only | notFound() isolation; async params pattern |

**Wymagania wstępne:** S-02 done (✓ — 2026-06-01)
**Szacowany nakład pracy:** ~1-2 sesje w 2 fazach

## Otwarte ryzyka i założenia

- `completedAt` jest nullable w schemacie — filtr `outcome != 'in_progress'` gwarantuje, że w historii nigdy nie będzie null (safe cast w TypeScript)
- Drizzle `ne()` (not equal) do importu z `drizzle-orm` — nie ma go jeszcze w `queries.ts`

## Kryteria sukcesu (podsumowanie)

- Student widzi historię zakończonych sesji pod `/dashboard/history`
- Kliknięcie wpisu pokazuje breakdown wybranych badań z wynikami walidatora
- Student A nie ma dostępu do danych studenta B (404 na cudzej sesji)
