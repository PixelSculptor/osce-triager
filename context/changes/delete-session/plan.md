# Delete Session — Plan implementacji

## Przegląd

Implementacja funkcjonalności usuwania sesji z historii użytkownika — brakujące
D w CRUD aplikacji. Zakres: nowa funkcja query z ownership check, server action
z blokadą in_progress, komponent UI z modal potwierdzeniem oraz pełne pokrycie
testami (integration + E2E).

## Analiza stanu obecnego

**Istnieje:**

- Tabela `session_result` z FK `user_id → user.id` ON DELETE CASCADE
  (`schema.ts:101-118`)
- Tabela `session_event` z FK `session_id → session_result.id` ON DELETE
  **CASCADE** (`schema.ts:120-134`) — usunięcie sesji automatycznie usuwa jej
  eventy
- `queries.ts` — 5 funkcji read-only (brak delete)
- `actions.ts` — 3 server actions: start, selectTest, end (brak delete)
- `HistoryCard` — wyświetla zakończone sesje bez przycisku delete
- `HistoryFilter` — client component zarządzający listą i filtrami

**Brakuje:**

- `deleteSessionById(sessionId, userId)` w `queries.ts`
- `deleteSessionAction(sessionId)` w `actions.ts`
- `useModal` hook w `src/shared/hooks/`
- `ConfirmModal` komponent w `src/shared/components/`
- `DeleteSessionButton` komponent w `src/modules/session/components/`
- Testów dla wszystkich powyższych

**Brak systemu modal/dialog** w aplikacji — wymaga zbudowania od zera.

## Pożądany stan końcowy

Użytkownik może kliknąć przycisk "Usuń" na karcie w historii sesji, zobaczyć
modal z potwierdzeniem, i po kliknięciu "Potwierdź" karta znika z listy. Sesje
`in_progress` są niewidoczne w historii i blokowane na poziomie server action.
Po usunięciu brak toastu — lista odświeża się przez revalidatePath RSC.

### Kluczowe odkrycia:

- Wzorzec ownership WHERE:
  `and(eq(sessionResults.id, id), eq(sessionResults.userId, userId))` —
  obowiązkowy (IDOR fix z `testing-data-isolation-session-persistence`)
- Wzorzec Drizzle delete z RETURNING:
  `.delete().where(...).returning({ id: ... })` — używamy `.length` jako
  zwróconego count (analogia do endSessionAction `claimed.length`)
- Brak @radix-ui ani żadnych UI primitives — modal budujemy przez natywny
  `<dialog>` HTML + CSS Module
- `HistoryCard` jest renderowany przez client component (`HistoryFilter`) — może
  być client component bez overhead
- `getUserSessions` filtruje `outcome != 'in_progress'` — in_progress nie
  pojawia się w UI, ale blokujemy na poziomie action defensywnie

## Czego NIE robimy

- Żadnych migracji DB — CASCADE już istnieje
- Żadnego systemu toast/notification — cicha aktualizacja przez revalidatePath
- Żadnego globalnego state management dla modala — hook lokalny w
  DeleteSessionButton
- Nie usuwamy sesji in_progress przez UI — action je blokuje
- Nie pokrywamy R-DEL-08 (concurrent delete) w tej zmianie — niski priorytet,
  MVP
- Nie instalujemy bibliotek UI (radix, headlessui) — używamy native `<dialog>`

## Podejście do implementacji

Backend (Faza 1) → Integration Tests (Faza 2) → UI (Faza 3) → E2E Tests (Faza
4).

Fazy 1 i 2 są niezależne od UI i mogą być zweryfikowane przez testy zanim
powstanie komponent. Faza 3 buduje na przetestowanym backendzie.

## Krytyczne szczegóły implementacji

- **Drizzle `.delete().returning()`**: W Drizzle z postgres-js, samo
  `db.delete(...).where(...)` nie zwraca liczby usuniętych wierszy; użyj
  `.returning({ id: sessionResults.id })` i zwróć `.length`. Ten wzorzec jest
  spójny z `endSessionAction` który sprawdza `claimed.length === 0`.
- **`<dialog>` element**: Natywny `<dialog>` wymaga `open` attr lub
  `.showModal()` JS API. Użyj kontrolowanego renderowania warunkowego
  (`{isOpen && <dialog open>...</dialog>}`) bez JS `showModal()` — prostsze i
  działa w jsdom dla testów komponentowych.
- **`"use client"` w HistoryCard**: `HistoryCard` prawdopodobnie nie ma
  `"use client"` — wymaga dodania, gdy importuje `DeleteSessionButton` (client
  component z `useState`). Ponieważ `HistoryCard` jest już renderowany przez
  client component `HistoryFilter`, to nie zmienia granicy client/server
  bundlowania.

---

## Faza 1: Backend — Query + Server Action

### Przegląd

Dodaj `deleteSessionById` do query module i `deleteSessionAction` do server
actions. Backend jest w pełni testowalny bez UI.

### Wymagane zmiany:

#### 1. `deleteSessionById` — nowa funkcja query

**Plik**: `src/modules/session/queries.ts`

**Cel**: Usunąć wiersz `session_result` należący do danego użytkownika i zwrócić
liczbę usuniętych wierszy (0 = nie znaleziono lub brak ownership). CASCADE DB
automatycznie usunie powiązane `session_event`.

**Kontrakt**:

```typescript
export async function deleteSessionById(
  sessionId: string,
  userId: string,
): Promise<number>;
```

WHERE clause:
`and(eq(sessionResults.id, sessionId), eq(sessionResults.userId, userId))` — ten
sam wzorzec co `getSessionById` (linii 17-26). Implementacja przez
`.returning({ id: sessionResults.id })`, zwraca `.length`.

---

#### 2. `deleteSessionAction` — nowy server action

**Plik**: `src/modules/session/actions.ts`

**Cel**: Zwalidować autoryzację i status sesji, wywołać deleteSessionById,
zrewalidować stronę historii. Blokować sesje in_progress jako defensywny guard.

**Kontrakt**:

```typescript
export async function deleteSessionAction(
  sessionId: string,
): Promise<{ error?: string }>;
```

Sekwencja: `auth()` → check `session.user.id` →
`getSessionById(sessionId, userId)` → check `outcome === 'in_progress'` →
`deleteSessionById(sessionId, userId)` → `revalidatePath('/dashboard/history')`
→ `return {}`.

Kody błędów: `'Unauthorized'` (brak auth), `'Not found'` (null z
getSessionById), `'Cannot delete an active session'` (outcome in_progress).

---

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Typecheck przechodzi: `npm run typecheck`
- Linting przechodzi: `npm run lint`

#### Weryfikacja ręczna:

- `deleteSessionById` i `deleteSessionAction` są eksportowane i widoczne w IDE
  bez błędów TypeScript

---

## Faza 2: Integration Tests — Query + Action

### Przegląd

Pokryj 5 ryzyk testami automatycznymi (integration + hermetic). Wzorce z
`queries.test.ts:9-59` i `actions.test.ts:1-157`.

### Wymagane zmiany:

#### 1. Testy `deleteSessionById` — rozszerzenie queries.test.ts

**Plik**: `src/modules/session/queries.test.ts`

**Cel**: Dodać nowy `describe.skipIf(!runIntegration)` blok dla
`deleteSessionById` pokrywający 3 ryzyka.

**Kontrakt**: Nowy blok w istniejącym pliku, reusing fixture setup pattern
(`beforeAll` / `afterAll` z odwrotną kolejnością FK). Fixture: 2 użytkownicy
(owner + intruder) + sesja ownera + 1 session_event. Testy:

- **R-DEL-01 IDOR**: `deleteSessionById(sessionId, intruderUserId)` → `0`;
  `getSessionById(sessionId, ownerId)` → nadal istnieje
- **R-DEL-02 Cascade**: `deleteSessionById(sessionId, ownerId)` → `1`;
  `getSessionEvents(sessionId, ownerId)` → `[]`
- **R-DEL-03 Not found**: `deleteSessionById('non-existent-uuid', ownerId)` →
  `0` (no throw)

Fixture cleanup w `afterAll`: delete sessionEvents → sessionResults → scenarios
→ users (odwrotna kolejność FK jak w istniejących testach).

---

#### 2. Testy `deleteSessionAction` — rozszerzenie actions.test.ts

**Plik**: `src/modules/session/actions.test.ts`

**Cel**: Dodać testy dla `deleteSessionAction` pokrywające R-DEL-05 (hermetic) i
R-DEL-04 (integration).

**Kontrakt**:

_R-DEL-05 — brak auth (hermetic, `vi.spyOn` lub `vi.mock`)_:

```typescript
vi.mocked(auth).mockResolvedValueOnce(null);
const result = await deleteSessionAction('any-id');
expect(result).toEqual({ error: 'Unauthorized' });
```

_R-DEL-04 — in_progress blokada (integration, real DB)_: Fixture: sesja z
`outcome = 'in_progress'` (nie `completed`).
`deleteSessionAction(inProgressSessionId)` →
`{ error: 'Cannot delete an active session' }`. Sesja nadal istnieje po
wywołaniu.

---

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Integration testy przechodzą (z `DATABASE_URL_TEST`):
  `npm run test -- queries.test.ts actions.test.ts`
- Typecheck: `npm run typecheck`

#### Weryfikacja ręczna:

- Wyniki testu pokazują 5 nowych passing testów (R-DEL-01, R-DEL-02, R-DEL-03,
  R-DEL-04, R-DEL-05)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne
potwierdzenie od człowieka, że testy ręczne zakończyły się sukcesem, zanim
przejdziesz do następnej fazy.

---

## Faza 3: UI — Modal + Hook + DeleteSessionButton

### Przegląd

Zbuduj `useModal` hook, `ConfirmModal` komponent (native `<dialog>`) i
`DeleteSessionButton` komponent. Podłącz button do `HistoryCard`.

### Wymagane zmiany:

#### 1. `useModal` hook

**Plik**: `src/shared/hooks/useModal.ts`

**Cel**: Lokalny hook do zarządzania stanem otwarcia modala — żadnych zależności
poza React.

**Kontrakt**:

```typescript
export function useModal(): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};
```

Implementacja przez `useState<boolean>(false)`.

---

#### 2. `ConfirmModal` komponent

**Plik**: `src/shared/components/ConfirmModal/ConfirmModal.tsx`  
**Plik CSS**: `src/shared/components/ConfirmModal/ConfirmModal.module.css`

**Cel**: Reużywalny modal potwierdzenia z tytułem, opisem i dwoma przyciskami
(Potwierdź / Anuluj). Bazuje na natywnym `<dialog>` HTML dla accessibility bez
JS portals.

**Kontrakt**:

```typescript
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string; // default: "Potwierdź"
  cancelLabel?: string; // default: "Anuluj"
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean; // disables buttons during action
}
```

Renderowany warunkowo: `{isOpen && <dialog open ...>}`. Używa `<button>` z
`aria-label`. Stylizacja przez CSS Module z tokenami z `globals.css`
(`--color-*`, `--radius-*`, `--spacing-*`). Ikona Trash2 z `lucide-react` (per
lessons.md: nigdy glify Unicode).

---

#### 3. `DeleteSessionButton` komponent

**Plik**:
`src/modules/session/components/DeleteSessionButton/DeleteSessionButton.tsx`  
**Plik CSS**:
`src/modules/session/components/DeleteSessionButton/DeleteSessionButton.module.css`

**Cel**: Client component który orkiestruje useModal + deleteSessionAction +
ConfirmModal dla pojedynczej sesji.

**Kontrakt**:

```typescript
interface DeleteSessionButtonProps {
  sessionId: string;
}
```

`"use client"` — używa `useModal()`, `useTransition()` (do `isPending`),
importuje `deleteSessionAction`. Po wywołaniu akcji bez błędu: `close()`
(revalidatePath odświeży listę). Przy błędzie: zachowaj modal otwarty i pokaż
komunikat błędu. Przycisk delete: `<button aria-label="Usuń sesję">` + ikona
Trash2 z `lucide-react`.

---

#### 4. Aktualizacja `HistoryCard`

**Plik**: `src/modules/session/components/HistoryCard/HistoryCard.tsx`

**Cel**: Dodać `DeleteSessionButton` do karty sesji. Wymaga dodania
`"use client"` do `HistoryCard`.

**Kontrakt**: Dodaj `"use client"` na początku pliku. Wyrenderuj
`<DeleteSessionButton sessionId={id} />` wewnątrz karty — pozycja: obok linku do
szczegółów. Bez zmian w interfejsie `HistoryCardProps`.

---

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Typecheck: `npm run typecheck`
- Linting: `npm run lint`

#### Weryfikacja ręczna:

- Karta sesji w historii ma przycisk z ikoną kosza
- Kliknięcie przycisku otwiera modal z tytułem i przyciskami Potwierdź/Anuluj
- Kliknięcie "Anuluj" zamyka modal bez usuwania sesji
- Kliknięcie "Potwierdź" usuwa sesję — karta znika z listy po revalidatePath
- Brak console errors w przeglądarce
- Motyw ciemny/jasny działa poprawnie (tokeny CSS)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne
potwierdzenie od człowieka, że testy ręczne zakończyły się sukcesem, zanim
przejdziesz do następnej fazy.

---

## Faza 4: E2E Tests — Delete flow

### Przegląd

Nowy spec Playwright pokrywający R-DEL-06 (dialog confirm flow) i R-DEL-07
(historia po usunięciu). Używa uwierzytelnionego użytkownika testowego przez
`storageState` (wzorzec z `session-flow.spec.ts`).

### Wymagane zmiany:

#### 1. Nowy spec E2E

**Plik**: `src/__tests__/e2e/session-delete.spec.ts`

**Cel**: Zweryfikować pełny flow usuwania sesji w przeglądarce: dialog pojawia
się → anulowanie zachowuje sesję → potwierdzenie usuwa sesję z historii.

**Kontrakt**: Plik używa `storageState` z `playwright/.auth/user.json`
(dziedziczony przez chromium project). Dwa testy:

**Test 1 — Cancel preserves session (R-DEL-06 anulowanie)**:

1. Utwórz sesję (goto `/dashboard`, kliknij scenariusz, zleć test, zakończ
   sesję)
2. Przejdź do `/dashboard/history`
3. Zlokalizuj kartę sesji (przez
   `page.getByRole('listitem').filter({ hasText: scenarioName }).first()`)
4. Kliknij przycisk delete:
   `card.getByRole('button', { name: 'Usuń sesję' }).click()`
5. Asercja: `page.getByRole('dialog')` → `toBeVisible()`
6. Kliknij "Anuluj": `page.getByRole('button', { name: 'Anuluj' }).click()`
7. Asercja: dialog zniknął, karta sesji nadal widoczna

**Test 2 — Confirm deletes session (R-DEL-07 usunięcie)**:

1. Utwórz sesję (identycznie jak w Test 1 — każdy test niezależny)
2. Przejdź do `/dashboard/history`
3. Zlokalizuj kartę sesji
4. Kliknij delete button → kliknij "Potwierdź"
5. Asercja: `await expect(card).not.toBeVisible()` po usunięciu

**Cleanup**: Każdy test tworzy unikalną sesję. Sesje z Testu 1 pozostają
(anulowano delete). Sesje z Testu 2 są usunięte przez sam test. Oba testy są
niezależne i self-cleaning.

**Locatory** (per lessons.md: `getByRole` / `getByLabel`, nigdy CSS):

- `getByRole('button', { name: 'Usuń sesję' })` — aria-label z
  DeleteSessionButton
- `getByRole('dialog')` — natywny `<dialog>` element
- `getByRole('button', { name: /Potwierdź/ })` — przycisk w ConfirmModal
- `getByRole('button', { name: 'Anuluj' })` — przycisk w ConfirmModal

---

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- E2E testy przechodzą: `npm run test:e2e -- session-delete`
- Typecheck: `npm run typecheck`

#### Weryfikacja ręczna:

- Test output pokazuje 2 passing testy (cancel + confirm)
- Screenshoty/trace bez błędów

---

## Strategia testowania

### Testy integracyjne (Vitest + real DB):

- `queries.test.ts` — R-DEL-01 IDOR (owner vs intruder), R-DEL-02 cascade
  (session_events gone), R-DEL-03 not found
- `actions.test.ts` — R-DEL-05 unauthorized (hermetic), R-DEL-04 in_progress
  blocked (integration)

### Testy E2E (Playwright):

- `session-delete.spec.ts` — R-DEL-06 cancel preserves session, R-DEL-07 confirm
  deletes from history

### Co NIE jest testowane w tej zmianie:

- R-DEL-08 (concurrent delete) — pominięte jako low priority
- Testy komponentowe `DeleteSessionButton` / `ConfirmModal` — pokryte przez E2E;
  nie ma wartości dodanej w jsdom dla tego komponentu

## Referencje

- Badania: `context/changes/delete-session/research.md`
- Wzorzec IDOR: `src/modules/session/queries.test.ts:9-59`
- Wzorzec action test: `src/modules/session/actions.test.ts:1-157`
- Wzorzec E2E: `src/__tests__/e2e/session-flow.spec.ts`
- Template action: `context/changes/account-deletion/plan.md:50-54`
- Wzorzec WHERE ownership:
  `context/changes/testing-data-isolation-session-persistence/plan.md:22-29`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku.

### Faza 1: Backend — Query + Server Action

#### Automatyczne

- [ ] 1.1 Typecheck przechodzi: `npm run typecheck`
- [ ] 1.2 Linting przechodzi: `npm run lint`

#### Ręczne

- [ ] 1.3 `deleteSessionById` i `deleteSessionAction` wyeksportowane i widoczne
      w IDE bez TS errors

### Faza 2: Integration Tests — Query + Action

#### Automatyczne

- [ ] 2.1 Integration testy queries przechodzą:
      `npm run test -- queries.test.ts`
- [ ] 2.2 Integration testy actions przechodzą:
      `npm run test -- actions.test.ts`
- [ ] 2.3 Typecheck przechodzi: `npm run typecheck`

#### Ręczne

- [ ] 2.4 Wyniki testu pokazują 5 nowych passing testów (R-DEL-01, R-DEL-02,
      R-DEL-03, R-DEL-04, R-DEL-05)

### Faza 3: UI — Modal + Hook + DeleteSessionButton

#### Automatyczne

- [ ] 3.1 Typecheck przechodzi: `npm run typecheck`
- [ ] 3.2 Linting przechodzi: `npm run lint`

#### Ręczne

- [ ] 3.3 Karta sesji w historii ma przycisk z ikoną kosza
- [ ] 3.4 Kliknięcie przycisku otwiera modal z potwierdzeniem
- [ ] 3.5 Anulowanie zamyka modal bez usuwania sesji
- [ ] 3.6 Potwierdzenie usuwa sesję — karta znika z listy
- [ ] 3.7 Brak console errors, motyw dark/light działa

### Faza 4: E2E Tests — Delete flow

#### Automatyczne

- [ ] 4.1 E2E testy przechodzą: `npm run test:e2e -- session-delete`
- [ ] 4.2 Typecheck przechodzi: `npm run typecheck`

#### Ręczne

- [ ] 4.3 Test output pokazuje 2 passing testy (cancel + confirm)
