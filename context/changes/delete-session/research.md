---
date: 2026-06-16T00:00:00+00:00
researcher: Kacper Nadstoga
git_commit: 2cdd98059a81627cea7de8825547d987b6d4ac1b
branch: delete-session
repository: osce-traiger
topic: 'Usuwanie sesji z historii — obszary zmian i ryzyka do pokrycia testami'
tags: [research, codebase, session, delete, crud, testing, idor]
status: complete
last_updated: 2026-06-16
last_updated_by: Kacper Nadstoga
---

# Research: Usuwanie sesji z historii — obszary zmian i ryzyka

**Date**: 2026-06-16 **Researcher**: Kacper Nadstoga **Git Commit**:
2cdd98059a81627cea7de8825547d987b6d4ac1b **Branch**: delete-session
**Repository**: osce-traiger

## Research Question

Potrzebujemy jako użytkownik możliwości usuwania sesji z historii użytkownika,
by mieć pełnego CRUDa w tej aplikacji. Jakie obszary musimy pokryć zmianami oraz
jakie ryzyka nowe mogą się pojawić które powinny być pokryte testami
automatycznymi?

## Summary

Aplikacja ma kompletny CRUD poza **Delete** dla domeny sesji (`session_result`).
W bazie istnieje już CASCADE DELETE (`session_result → session_event`), więc
usunięcie wiersza `session_result` automatycznie usuwa wszystkie powiązane
eventy — żadna dodatkowa migracja nie jest potrzebna.

Konieczne zmiany dotyczą wyłącznie warstwy aplikacyjnej: nowa funkcja query z
ownership check, nowy server action z `revalidatePath`, nowy komponent UI z
przyciskiem + potwierdzeniem.

Kluczowe ryzyka to IDOR (brak weryfikacji `userId` przy delete), niewidoczne
sesje in_progress (historia je filtruje, ale delete musi je obsługiwać), oraz
akcydentalne usunięcie bez potwierdzenia po stronie UI.

---

## Detailed Findings

### 1. Model danych — co istnieje, czego brakuje

**Tabela domenowa**: `session_result` (`src/shared/lib/schema.ts:101-118`)

| Kolumna        | Typ           | Uwagi                                       |
| -------------- | ------------- | ------------------------------------------- |
| `id`           | text PK       | UUID                                        |
| `user_id`      | text NOT NULL | FK → `user.id` ON DELETE CASCADE            |
| `scenario_id`  | text NOT NULL | FK → `scenario.id` ON DELETE **RESTRICT**   |
| `outcome`      | text          | `'in_progress' \| 'positive' \| 'negative'` |
| `is_failed`    | boolean       |                                             |
| `started_at`   | timestamp     | DEFAULT now()                               |
| `completed_at` | timestamp     | nullable — null gdy `in_progress`           |

**Tabela zdarzeń**: `session_event` (`src/shared/lib/schema.ts:120-134`)

- FK `session_id → session_result.id` z ON DELETE **CASCADE**
- Usunięcie `session_result` automatycznie usuwa wszystkie jej `session_event`

**BRAK** funkcji `deleteSession*` w:

- `src/modules/session/queries.ts` (5 funkcji read-only)
- `src/modules/session/actions.ts` (3 server actions: start, selectTest, end)

**Wniosek**: żadna migracja DB nie jest potrzebna — kaskada już istnieje.

---

### 2. Warstwa UI — co trzeba zmienić

**Historia sesji** (`src/app/dashboard/history/page.tsx:1-32`):

- Pobiera dane przez `getUserSessions(session.user.id)` (RSC → query module —
  zgodnie z lessons.md)
- Przekazuje listę do `HistoryFilter` → `HistoryCard`

**`HistoryFilter`**
(`src/modules/session/components/HistoryFilter/HistoryFilter.tsx:1-66`):

- Client component, zarządza filtrami "Wszystkie / Pozytywne / Negatywne"
- Renderuje listę `HistoryCard`
- Nie ma prop-a dla delete akcji

**`HistoryCard`**
(`src/modules/session/components/HistoryCard/HistoryCard.tsx:5-52`):

```typescript
interface HistoryCardProps {
  id: string;
  scenarioTitle: string;
  outcome: 'positive' | 'negative';
  startedAt: Date;
  completedAt: Date;
}
```

- Nie ma przycisku delete ani żadnej akcji mutacji

**Wymagane zmiany UI**:

1. Nowy komponent `DeleteSessionButton/` (per lessons.md: każdy komponent w
   własnym podfolderze z `.tsx` + `.module.css`)
2. Przekazanie `deleteSessionAction` do `HistoryFilter` → `HistoryCard` lub
   umieszczenie go w dedykowanym komponencie
3. Dialog/confirm przed usunięciem (UX — zapobieganie przypadkowemu kliknięciu)

---

### 3. Warstwa query — co trzeba dodać

**Plik**: `src/modules/session/queries.ts` (oznaczony `server-only`)

Nowa funkcja do dodania:

```typescript
export async function deleteSessionById(
  sessionId: string,
  userId: string,
): Promise<number>;
```

Wzorzec bezpiecznego WHERE (z
`testing-data-isolation-session-persistence/plan.md:22-29`):

```typescript
and(eq(sessionResults.id, sessionId), eq(sessionResults.userId, userId));
```

Zwraca liczbę usuniętych wierszy (0 = brak sesji / brak ownership). Cascade DB
automatycznie usuwa powiązane `session_event`.

**Nie ma potrzeby** ręcznego DELETE na `session_event` — CASCADE to obsługuje.

---

### 4. Warstwa server action — co trzeba dodać

**Plik**: `src/modules/session/actions.ts` (oznaczony `"use server"`)

Wzorzec z `account-deletion/plan.md:50-54` i istniejących actions:

```typescript
export async function deleteSessionAction(
  sessionId: string,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized' };

  const deleted = await deleteSessionById(sessionId, session.user.id);
  if (deleted === 0) return { error: 'Not found' };

  revalidatePath('/dashboard/history');
  return {};
}
```

Krytyczne: `userId` pochodzi wyłącznie z `auth()` (server-side) — nigdy z
parametru klienta.

---

### 5. Obszary bez wymaganej zmiany

- **Migracje DB**: brak — CASCADE już istnieje w
  `0001_secret_nicolaos.sql:41-42`
- **Middleware**: brak — ścieżka `/dashboard/history` jest już chroniona
- **Auth config**: brak zmian
- **`getUserSessions`**: filtruje `outcome != 'in_progress'` — in_progress nie
  pojawia się w historii

---

## Ryzyka do pokrycia testami automatycznymi

### R-DEL-01 — IDOR: usunięcie cudzej sesji (KRYTYCZNE)

**Opis**: User B wywołuje `deleteSessionById("session-user-a", "user-b-id")` —
powinno usunąć 0 wierszy.

**Wzorzec testu** (z `queries.test.ts:39-58`):

- Typ: Integration (real DB)
- Fixture: 2 użytkownicy + sesja użytkownika A
- Asercja: `deleteSessionById(sessionIdA, userIdB)` → `0` (0 wierszy usuniętych)
- Asercja: `getSessionById(sessionIdA, userIdA)` → nadal istnieje

**Dlaczego krytyczne**: To samo ryzyko, które
`testing-data-isolation-session-persistence` naprawiło dla
`getSessionById`/`getSessionEvents`.

---

### R-DEL-02 — Cascade: usunięcie sesji kasuje jej eventy

**Opis**: Po usunięciu `session_result`, powiązane `session_event` muszą
zniknąć.

**Wzorzec testu**:

- Typ: Integration (real DB)
- Fixture: sesja + minimum 1 session_event
- Akcja: `deleteSessionById(sessionId, userId)` → 1
- Asercja: `getSessionEvents(sessionId, userId)` → `[]`

**Dlaczego ważne**: Weryfikuje że CASCADE FK działa w praktyce (nie tylko w
schemacie).

---

### R-DEL-03 — Nieistniejąca sesja — brak błędu

**Opis**: `deleteSessionById("non-existent-uuid", userId)` nie może rzucić
wyjątku.

**Wzorzec testu**:

- Typ: Integration (real DB)
- Asercja: zwraca `0` (nie rzuca błędu)

---

### R-DEL-04 — Sesja `in_progress` — semantyka

**Opis**: Historia filtruje `outcome != 'in_progress'`, więc sesje w toku nie
pojawiają się w UI. Pytanie: czy `deleteSessionAction` ma je obsługiwać?

**Decyzja do podjęcia w planie**: zablokować delete in_progress (bezpieczniej),
czy pozwolić (prostsze).

**Wzorzec testu**:

- Typ: Integration
- Fixture: sesja z `outcome = 'in_progress'`
- Asercja: zależna od decyzji projektowej

---

### R-DEL-05 — Akcja serwera: brak autoryzacji → Unauthorized

**Opis**: `deleteSessionAction` wywołana bez aktywnej sesji NextAuth zwraca
`{ error: 'Unauthorized' }`.

**Wzorzec testu**:

- Typ: Integration (hermetic z
  `vi.mock('@/modules/auth/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))`)
- Asercja: `deleteSessionAction("any-id")` → `{ error: 'Unauthorized' }`

---

### R-DEL-06 — UI: potwierdzenie przed usunięciem

**Opis**: Kliknięcie "Usuń" bez potwierdzenia nie powinno natychmiastowo usuwać
sesji.

**Wzorzec testu** (E2E Playwright):

- `getByRole('button', { name: /Usuń/ }).click()`
- Asercja: pojawia się dialog/modal z potwierdzeniem
- Kliknięcie "Anuluj" → sesja nadal widoczna w historii
- Kliknięcie "Potwierdź" → sesja znika z historii (`toBeVisible` przestaje być
  true)

**Wzorzec locatora** (z lessons.md: `getByRole` / `getByLabel`, nigdy
CSS/XPath):

```typescript
await page.getByRole('button', { name: /Usuń/ }).click();
await expect(page.getByRole('dialog')).toBeVisible();
await page.getByRole('button', { name: /Potwierdź/ }).click();
```

---

### R-DEL-07 — Historia po usunięciu: rewalidacja RSC

**Opis**: Po usunięciu sesja musi zniknąć z listy historii.
`revalidatePath('/dashboard/history')` musi działać.

**Wzorzec testu** (E2E Playwright):

- Fixture: sesja widoczna w historii (zakończona przez `session-flow.spec.ts`
  lub seed)
- Akcja: delete + potwierdź
- Asercja: `listitem` z tytułem scenariusza + datą znika z widoku

**Uwaga**: Wymaga unikalnego identyfikatora sesji w asercji — użyć znacznika
czasu lub `data-testid` dla konkretnego wpisu.

---

### R-DEL-08 — Równoczesne usunięcia: idempotentność

**Opis**: Dwa równoległe wywołania `deleteSessionById` na tej samej sesji —
jedno musi zwrócić 1, drugie 0. Brak `.transaction()` w codebase (z
`testing-data-isolation-session-persistence/research.md`).

**Wzorzec testu**:

- Typ: Integration
- Asercja:
  `Promise.all([deleteSessionById(id, uid), deleteSessionById(id, uid)])` → suma
  = 1

---

## Code References

- `src/shared/lib/schema.ts:101-118` — schemat tabeli `session_result`
- `src/shared/lib/schema.ts:120-134` — schemat tabeli `session_event` z CASCADE
- `drizzle/migrations/0001_secret_nicolaos.sql:41-44` — FK definicje z
  CASCADE/RESTRICT
- `src/modules/session/queries.ts:1-135` — query module (server-only, brak
  deleteSession)
- `src/modules/session/actions.ts:1-208` — server actions (brak
  deleteSessionAction)
- `src/app/dashboard/history/page.tsx:1-32` — historia sesji RSC
- `src/modules/session/components/HistoryCard/HistoryCard.tsx:5-52` — karta
  sesji (brak delete UI)
- `src/modules/session/components/HistoryFilter/HistoryFilter.tsx:1-66` — lista
  z filtrami
- `src/modules/session/queries.test.ts:9-59` — wzorzec testu IDOR (2 usery,
  asercja cross-account)
- `src/modules/session/actions.test.ts:1-157` — wzorzec hermetic mock dla server
  actions

## Architecture Insights

1. **Wzorzec ownership w WHERE**: zawsze
   `and(eq(table.id, id), eq(table.userId, userId))` — ze względu na poprzedni
   IDOR incident w `testing-data-isolation-session-persistence`

2. **Server actions = single responsibility**: `auth()` → ownership check → DB
   operation → `revalidatePath` → return

3. **Brak transakcji**: `db.transaction()` nie jest używane nigdzie — przy
   delete to nie problem (single-row DELETE jest atomowy), ale warto odnotować

4. **Kaskada w DB działa za nas**: `session_event` usuwane automatycznie — query
   layer nie musi tego robić ręcznie

5. **Historia nie pokazuje in_progress**: `getUserSessions` filtruje
   `outcome != 'in_progress'` — delete przez UI zawsze dotyczy sesji
   zakończonych

## Historical Context (from prior changes)

- `context/changes/testing-data-isolation-session-persistence/plan.md:22-29` —
  bezpieczny wzorzec WHERE z `userId`, naprawia IDOR; MUST replicate dla
  deleteSessionById
- `context/changes/account-deletion/plan.md:50-54` — wzorzec server action z
  walidacją + revalidatePath; użyć jako template
- `context/changes/first-playable-session/plan.md:68-73` — idempotency guard
  (atomowy WHERE z RETURNING); analogiczny dla concurrent delete
- `context/changes/session-history-save/plan.md:19-25` — RSC + query module
  pattern; historia page nie zmienia swojego wzorca

## Related Research

- `context/changes/testing-data-isolation-session-persistence/research.md` —
  pełna analiza IDOR dla queries sesji
- `context/changes/account-deletion/plan.md` — wzorzec usuwania danych
  użytkownika z kaskadą

## Open Questions

1. **Czy pozwolić na delete sesji `in_progress`?** W historii nie są widoczne,
   ale technicznie mogą zostać usunięte. Rekomendacja: zezwolić (upraszcza
   logikę, historia je i tak filtruje).

2. **Lokalizacja przycisku delete**: w `HistoryCard` bezpośrednio (prostsza
   hierarchia) czy jako osobny `DeleteSessionButton` wrapper (zgodny z
   lessons.md o komponentach w subfolder)?

3. **Feedback po usunięciu**: toast/notification po pomyślnym delete? Nie
   istnieje jeszcze w aplikacji — decyzja projektowa.
