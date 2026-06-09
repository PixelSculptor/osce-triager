# Session History Save — Plan implementacji

## Przegląd

Implementacja S-03: student może przeglądać historię swoich zakończonych sesji diagnostycznych w dedykowanym widoku `/dashboard/history` oraz wejść w szczegóły każdej sesji na stronie `/dashboard/session/[id]/details`. Zapis wyników do DB jest już realizowany przez `endSessionAction` (S-02) — ten plan to wyłącznie warstwa query + UI.

## Analiza stanu obecnego

- `sessionResults` i `sessionEvents` są w pełni hydratowane po zakończeniu sesji przez `endSessionAction` (S-02, done 2026-06-01).
- Brak strony historii: dashboard (`/dashboard`) pokazuje tylko listę scenariuszy.
- Brak query dla listy sesji użytkownika — `queries.ts` nie ma funkcji filtrowanej po `userId`.
- `SessionView` po zakończeniu sesji wyświetla wynik inline na tej samej stronie i ma link "Wróć do panelu" — ten flow zostaje bez zmian.
- Nav (`Nav.tsx`) nie ma linku do historii.

## Pożądany stan końcowy

Student zalogowany może wejść w "Historia" z nawigacji, zobaczyć listę swoich zakończonych sesji (scenariusz, wynik, data, czas trwania), kliknąć wpis i zobaczyć read-only breakdown wybranych badań z wynikami walidatora. Dane każdego studenta są izolowane — każde zapytanie filtruje po `userId`.

### Kluczowe odkrycia:

- `sessionResults.completedAt` jest nullable — ustawiany przez `endSessionAction`; filtr `outcome != 'in_progress'` gwarantuje, że `completedAt` nie będzie null w historii.
- `sessionResults.userId` (FK do `users.id`) to jedyny klucz izolacji — musi być w WHERE każdego zapytania historii.
- Drizzle `queries.ts` importuje tylko `eq` z `drizzle-orm` — potrzebne dodanie `and`, `ne`, `desc` dla nowych queries.
- `SessionView` jest `"use client"` z pełną logiką timera — strona szczegółów to oddzielna trasa RSC, nie reuse SessionView.
- CSS Modules to obowiązujący wzorzec dla wszystkich komponentów.

## Czego NIE robimy

- Nie zmieniamy schematu Drizzle ani migracji — wszystkie tabele istnieją.
- Nie modyfikujemy `endSessionAction` ani `SessionView` — flow zakończenia sesji bez zmian.
- Nie pokazujemy sesji `in_progress` w historii.
- Nie dodajemy dashboard stats ani pass-rate aggregates (poza MVP).
- Nie tworzymy CMS ani widoku dla innych użytkowników.
- Nie dodajemy przycisku "Wznów" dla przerwanej sesji.

## Podejście do implementacji

Dwie fazy niezależne od siebie pod względem ryzyka. Faza 1 (listing) jest blokerem PR-mergeable; Faza 2 (detail view) jest rozszerzeniem. Każda query musi mieć `userId` w WHERE. Strony są RSC zgodnie z lessons.md (query modules, nigdy self-calling REST routes).

## Faza 1: Historia sesji — listing

### Przegląd

Dodanie funkcji `getUserSessions`, strony `/dashboard/history`, komponentu `HistoryCard` i linku w Nav.

### Wymagane zmiany:

#### 1. Query — lista sesji użytkownika

**Plik**: `src/modules/session/queries.ts`

**Cel**: Nowa funkcja zwracająca zakończone sesje użytkownika, posortowane od najnowszej, z nazwą scenariusza.

**Kontrakt**: `getUserSessions(userId: string)` — SELECT z inner join `sessionResults ↔ scenarios`, WHERE `userId = userId AND outcome != 'in_progress'`, ORDER BY `completedAt DESC`. Zwraca array `{ id, outcome, startedAt, completedAt, scenarioTitle }`. Importy do dodania do istniejącego importu z `drizzle-orm`: `and`, `ne`, `desc`.

---

#### 2. Strona historii

**Plik**: `src/app/dashboard/history/page.tsx` (nowy)

**Cel**: RSC — auth check (redirect do `/login` jeśli brak sesji), pobranie userId z `session.user.id`, wywołanie `getUserSessions(userId)`, render listy `HistoryCard`. Pusty stan gdy brak wyników ("Brak zakończonych sesji.").

**Kontrakt**: Eksportuje domyślnie async function `HistoryPage`. Nie przyjmuje props. Pattern auth + query jak `DashboardPage` (`src/app/dashboard/page.tsx`).

---

#### 3. Komponent HistoryCard

**Plik**: `src/modules/session/components/HistoryCard.tsx` (nowy)

**Cel**: Karta historii — wyświetla tytuł scenariusza, badge wyniku (Pozytywny/Negatywny), datę zakończenia, czas trwania sesji (formatowany jako MM:SS), link do `/dashboard/session/[id]/details`.

**Kontrakt**:
```typescript
interface HistoryCardProps {
  id: string
  scenarioTitle: string
  outcome: "positive" | "negative"
  startedAt: Date
  completedAt: Date
}
```
Czas trwania: `Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)` → formatowany MM:SS. Link wraps całą kartę lub jest dedykowanym przyciskiem. CSS Module: `HistoryCard.module.css`.

---

#### 4. CSS dla HistoryCard

**Plik**: `src/modules/session/components/HistoryCard.module.css` (nowy)

**Cel**: Style dla karty historii — zgodne z istniejącą stylistyką (CSS Modules, prostota).

---

#### 5. Barrel export

**Plik**: `src/modules/session/components/index.ts`

**Cel**: Dodanie eksportu `HistoryCard`.

**Kontrakt**: Dołożyć `export { HistoryCard } from "./HistoryCard"` do istniejących eksportów.

---

#### 6. Link w nawigacji

**Plik**: `src/shared/components/Nav/Nav.tsx`

**Cel**: Dodanie linku "Historia" widocznego dla zalogowanego użytkownika, obok emaila i przycisku "Wyloguj".

**Kontrakt**: `<Link href="/dashboard/history">Historia</Link>` wewnątrz bloku `{session ? (...)}`, między `<span>` z emailem a linkiem `Ustawienia` — wynik: email | Historia | Ustawienia | Wyloguj.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Typecheck przechodzi: `npm run typecheck`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Weryfikacja ręczna:

- Zalogowany student widzi link "Historia" w Nav
- `/dashboard/history` wyświetla zakończone sesje z tytułem scenariusza, wynikiem, datą i czasem trwania
- Pusty stan widoczny gdy brak zakończonych sesji
- Zalogowany jako student A nie widzi sesji studenta B (test isolation)
- Kliknięcie wpisu przenosi do `/dashboard/session/[id]/details` (może być 404 przed Fazą 2 — akceptowalne)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych weryfikacji, zatrzymaj się na ręczne potwierdzenie przed przejściem do Fazy 2.

---

## Faza 2: Szczegóły sesji — read-only view

### Przegląd

Nowa trasa `/dashboard/session/[sessionId]/details` z read-only widokiem: metadane sesji + lista wybranych badań z wynikami walidatora.

### Wymagane zmiany:

#### 1. Query — szczegóły sesji

**Plik**: `src/modules/session/queries.ts`

**Cel**: Nowa funkcja `getSessionDetails(sessionId, userId)` — pobiera sesję z join scenariusza (z filtrem userId dla izolacji) oraz wszystkie eventy z join nazw badań. Zwraca null jeśli sesja nie istnieje lub nie należy do użytkownika.

**Kontrakt**:
```typescript
getSessionDetails(sessionId: string, userId: string): Promise<{
  id: string
  outcome: "positive" | "negative"
  startedAt: Date
  completedAt: Date
  scenarioTitle: string
  events: Array<{
    testId: string
    testName: string
    validatorResult: "correct" | "suboptimal" | "unnecessary" | "critical_miss"
    selectedAt: Date
  }>
} | null>
```
Dwa osobne zapytania: (1) session + scenario join z `WHERE id = sessionId AND userId = userId AND outcome != 'in_progress'`, (2) events + diagnosticTests join z `WHERE sessionId = sessionId`. Events posortowane po `selectedAt ASC`.

---

#### 2. Strona szczegółów sesji

**Plik**: `src/app/dashboard/session/[sessionId]/details/page.tsx` (nowy)

**Cel**: RSC — auth check, wywołanie `getSessionDetails(sessionId, userId)`, jeśli null → `notFound()`. Render: tytuł scenariusza, badge wyniku, data, czas trwania, lista eventów (test name + badge validatorResult). Link powrotu do `/dashboard/history`.

**Kontrakt**: Przyjmuje `{ params: Promise<{ sessionId: string }> }` (Next.js 15 async params pattern — jak w istniejącej `src/app/dashboard/session/[sessionId]/page.tsx`). Inline JSX/styles bez nowego komponentu — widok jest prosty.

**Uwaga implementacyjna**: `notFound()` wymaga importu z `"next/navigation"`. Zapewnia izolację — URL `/dashboard/session/cudzaId/details` zwraca 404 dla niewłaściwego użytkownika.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Typecheck przechodzi: `npm run typecheck`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Weryfikacja ręczna:

- Kliknięcie wpisu w historii otwiera `/dashboard/session/[id]/details` z pełnym breakdown
- Wyświetlone: tytuł scenariusza, wynik, data, czas trwania, badania z wynikami
- `critical_miss` eventy wyraźnie oznaczone
- Próba wejścia na `/dashboard/session/cudzaId/details` zwraca 404
- Link "Wróć do historii" działa

---

## Strategia testowania

### Weryfikacja automatyczna:

- `npm run typecheck` — sprawdza typy wszystkich nowych i zmodyfikowanych plików
- `npm run lint` — ESLint na całym projekcie
- `npm run build` — Next.js build (łapie błędy kompilacji RSC/SSR)

### Kroki testowania ręcznego:

1. Zaloguj się jako student A → wejdź w "Historia" → zweryfikuj puste state
2. Ukończ sesję → wróć do historii → zweryfikuj czy wpis pojawił się z poprawnymi danymi
3. Kliknij wpis → zweryfikuj szczegóły (badania, wyniki walidatora, critical_miss widoczny)
4. Zaloguj się jako student B → wejdź w `/dashboard/history` → zweryfikuj brak sesji studenta A
5. Jako student B wejdź bezpośrednio w URL sesji studenta A (`/dashboard/session/[idStudentaA]/details`) → zweryfikuj 404

## Referencje

- Roadmap S-03: `context/foundation/roadmap.md` (linia 139–148)
- Istniejące queries: `src/modules/session/queries.ts`
- Schema: `src/shared/lib/schema.ts`
- Wzorzec RSC auth: `src/app/dashboard/page.tsx`
- Wzorzec async params: `src/app/dashboard/session/[sessionId]/page.tsx`
- Lessons: `context/foundation/lessons.md` (RSC query modules, npm script verification)

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Historia sesji — listing

#### Automatyczne

- [ ] 1.1 Typecheck przechodzi: `npm run typecheck`
- [ ] 1.2 Lint przechodzi: `npm run lint`
- [ ] 1.3 Build przechodzi: `npm run build`

#### Ręczne

- [ ] 1.4 Link "Historia" widoczny w Nav dla zalogowanego użytkownika
- [ ] 1.5 `/dashboard/history` wyświetla zakończone sesje z poprawnymi danymi
- [ ] 1.6 Pusty stan widoczny gdy brak zakończonych sesji
- [ ] 1.7 Izolacja danych — student A nie widzi sesji studenta B
- [ ] 1.8 Kliknięcie wpisu w historii przenosi do /dashboard/session/[id]/details (może być 404 przed Fazą 2 — akceptowalne)

### Faza 2: Szczegóły sesji — read-only view

#### Automatyczne

- [ ] 2.1 Typecheck przechodzi: `npm run typecheck`
- [ ] 2.2 Lint przechodzi: `npm run lint`
- [ ] 2.3 Build przechodzi: `npm run build`

#### Ręczne

- [ ] 2.4 Strona szczegółów wyświetla breakdown badań z wynikami walidatora
- [ ] 2.5 `critical_miss` eventy wyraźnie oznaczone
- [ ] 2.6 Dostęp do cudzej sesji zwraca 404
- [ ] 2.7 Link "Wróć do historii" działa
