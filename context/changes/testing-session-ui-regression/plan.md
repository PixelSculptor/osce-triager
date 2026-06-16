# Regresja UI sesji — baseline: Plan implementacji

## Przegląd

Wdrożenie testów regresji UI sesji dla Ryzyka #4 z
`context/foundation/test-plan.md`: DnD reorder na krawędziach listy
(pierwszy/ostatni element) oraz wyświetlanie badge walidatora po kliknięciu
"Zleć". Cel: wykryć cichą regresję w logice `handleDragEnd` lub wiązaniu DnD,
zanim dotrze na produkcję.

## Analiza stanu obecnego

- **Brak `@testing-library/react`** — `package.json` nie zawiera tej paczki; §4
  test-plan.md to potwierdza
- **Vitest uruchamia się w `environment: 'node'`** — wymagana zmiana per-plik
  dla testów komponentowych; globalna zmiana złamałaby istniejące testy
  integracyjne DB
- **Logika reorder jest prywatna w `SessionView.tsx`** — jest wbudowana w
  `handleDragEnd` (linie 183–209); nie jest eksportowana; niemożliwe
  bezpośrednie testowanie jednostkowe bez ekstrakcji
- **Znany edge case**: linia 203:
  `if (!over || source !== 'ordered' || active.id === over.id) return;` —
  reorder jest cicho ignorowany gdy `over === null`; to jest udokumentowany
  poprzedni błąd (wywiad Q2)
- **Drag z lewej kolumny (source === 'available')**: linia 191–199 — zawsze
  wywołuje `handleSelectTest` niezależnie od `over`; NOT jest edge case Ryzyka
  #4
- **CSS Modules** są obsługiwane przez Vitest nativo (zwracają pusty obiekt)
- **`server-only` mock** już istnieje: `__mocks__/server-only.ts` + alias w
  `vitest.config.ts`

## Pożądany stan końcowy

Po zakończeniu planu:

- `applyReorder` jest eksportowaną czystą funkcją; testy jednostkowe pokrywają
  first→last, last→first i unknown-id guard
- `SessionView.test.tsx` z jsdom weryfikuje, że klik "Zleć" powoduje pojawienie
  się badge "Poprawne" w liście zleconych badań
- `npm run test` przechodzi bez `DATABASE_URL_TEST`
- §6.5 w `context/foundation/test-plan.md` ma uzupełniony wzorzec podręcznika
- Bramka CI `component interaction` (§5 test-plan.md) jest aktywna

### Kluczowe odkrycia:

- `src/modules/session/components/SessionView.tsx:183–209` — `handleDragEnd`;
  logika reorder to trzy linie w bloku `if (source === 'ordered')`; trivialnie
  ekstrakcja do czystej funkcji
- `src/modules/session/components/SessionView.tsx:114–117` — `PointerSensor` z
  `activationConstraint: { distance: 8 }` — symulacja pointer w jsdom ненадійна;
  ekstrakcja czystej funkcji eliminuje tę przeszkodę dla Ryzyka #4
- `src/modules/session/components/DraggableTestCard.tsx` — `onSelect` prop
  przechodzi przez do `TestCard` → `Button` z `name="Zleć"`; klik testuje
  ścieżkę `handleSelectTest`
- `vitest.config.ts` — `setupFiles: ['./vitest.setup.ts']`; globalny setup nie
  importuje jeszcze `@testing-library/jest-dom`
- `interface OrderedTest` (linia 39–44 SessionView.tsx) — prywatna; musi być
  wyeksportowana razem z `applyReorder`

## Czego NIE robimy

- Nie symulujemy pointer drag w jsdom — `PointerSensor` z `distance: 8` jest
  nieprzewidywalny poza przeglądarką; walidacja DnD collision detection to
  zakres E2E
- Nie zmieniamy globalnie `environment: 'node'` w `vitest.config.ts` — złamałoby
  istniejące testy integracyjne DB
- Nie testujemy scenariusza `source === 'available'` (drag z lewej kolumny) jako
  edge case — kod nie sprawdza `over` dla tego przepływu, więc nie ma czego
  chronić
- Nie refaktoryzujemy `SessionView` poza ekstrakcją `applyReorder` i
  `OrderedTest`
- Nie dodajemy testów E2E dla DnD — istnieje już `session-flow.spec.ts`; Faza 4
  jest ukończona

## Podejście do implementacji

Dwuwarstwowe pokrycie Ryzyka #4:

1. **Warstwa czysta (node)** — `applyReorder(tests, activeId, overId)` jako
   eksportowana funkcja z `SessionView.tsx`; testy jednostkowe bez DOM
2. **Warstwa komponentowa (jsdom)** — `SessionView.test.tsx` z per-file
   `@vitest-environment jsdom`; testuje wyłącznie ścieżkę klik-button → badge
   feedback (nie pointer drag)

Razem: reorder logic jest chroniony przez warstwę czystą; integracja Server
Action + stan UI jest chroniona przez warstwę komponentową.

## Krytyczne szczegóły implementacji

`handleSelectTest` jest `async` — po kliknięciu "Zleć" stan aktualizuje się
asynchronicznie. Użyj `screen.findByLabelText` (async query) zamiast
`screen.getByLabelText`, aby poczekać na pojawienie się `SortableTestCard`. Użyj
`vi.useFakeTimers()` w `beforeEach` aby zatrzymać `setInterval` timera sesji —
bez tego `act()` wygeneruje ostrzeżenia o niezarapowanych aktualizacjach stanu.

---

## Faza 1: Instalacja zależności + rozszerzenie vitest.setup.ts

### Przegląd

Zainstaluj `@testing-library/react`, `@testing-library/user-event`,
`@testing-library/jest-dom` i `jsdom` jako devDependencies. Rozszerz
`vitest.setup.ts` o import matchers.

### Wymagane zmiany:

#### 1. Instalacja paczek (devDependencies)

**Cel**: Zainstaluj cztery paczki jednym poleceniem `npm install`.

**Kontrakt**: Dodane wpisy w `package.json` `devDependencies`:

- `@testing-library/react` — wersja `^16` (React 19 compat; v15 nie obsługuje
  React 19)
- `@testing-library/user-event` — wersja `^14`
- `@testing-library/jest-dom` — wersja `^6`
- `jsdom` — wersja `^26` (wymagane przez vitest `environment: 'jsdom'` per-plik)

#### 2. Rozszerzenie `vitest.setup.ts`

**Plik**: `vitest.setup.ts`

**Cel**: Zarejestruj matchers `@testing-library/jest-dom` globalnie dla Vitest,
tak aby `expect(...).toBeInTheDocument()` działało bez importu per-plik.

**Kontrakt**: Dodaj `import '@testing-library/jest-dom/vitest'` na początku
pliku; istniejące linie dotenv pozostają bez zmian.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm install` kończy się bez błędów dependency conflict
- `npm run typecheck` przechodzi (nowe typy są pobrane)
- `npm run test` przechodzi (istniejące testy nie regresują)

#### Weryfikacja ręczna:

- `package.json` zawiera cztery nowe devDependencies z poprawnymi wersjami
- `vitest.setup.ts` ma import `@testing-library/jest-dom/vitest` jako pierwszą
  linię

---

## Faza 2: Ekstrakcja `applyReorder` + testy jednostkowe

### Przegląd

Wyodrębnij logikę reorder z `handleDragEnd` do eksportowanej czystej funkcji
`applyReorder`. Napisz testy jednostkowe dla edge cases first→last i last→first.
Testy działają w `node` environment — brak DOM.

### Wymagane zmiany:

#### 1. Eksport `OrderedTest` i `applyReorder` z `SessionView.tsx`

**Plik**: `src/modules/session/components/SessionView.tsx`

**Cel**: Udostępnij `OrderedTest` i `applyReorder` jako eksportowane symbole,
aby testy jednostkowe mogły je importować bezpośrednio.

**Kontrakt**:

- Zmień `interface OrderedTest` na `export interface OrderedTest`
- Dodaj eksportowaną funkcję `applyReorder` PRZED definicją komponentu
  `SessionView`:

```ts
export function applyReorder(
  tests: OrderedTest[],
  activeId: string,
  overId: string,
): OrderedTest[] {
  const oldIndex = tests.findIndex((t) => t.testId === activeId);
  const newIndex = tests.findIndex((t) => t.testId === overId);
  if (oldIndex === -1 || newIndex === -1) return tests;
  return arrayMove(tests, oldIndex, newIndex);
}
```

- W `handleDragEnd` zastąp blok `setOrderedTests(...)` wywołaniem
  `applyReorder`:

```ts
if (!over || source !== 'ordered' || active.id === over.id) return;
setOrderedTests((prev) =>
  applyReorder(prev, active.id as string, over.id as string),
);
```

Fragment kodu jest podany, bo sygnatura `applyReorder` jest punktem
kontrakt-zależnym od testów w Fazie 2.

#### 2. Plik testowy `SessionView.reorder.test.ts`

**Plik**: `src/modules/session/components/SessionView.reorder.test.ts`

**Cel**: Weryfikuj, że `applyReorder` poprawnie przemieszcza elementy z pozycji
krawędziowych; brak środowiska jsdom — testy działają w domyślnym `node` env.

**Kontrakt**: Plik bez nagłówka `@vitest-environment`. Import: `applyReorder` i
`OrderedTest` z `./SessionView`. Pięć przypadków testowych (patrz niżej);
wyrocznia każdego testu pochodzi z wymagania biznesowego ("badanie przeniesione
z pozycji X na Y"), nie z inspekcji implementacji.

Przypadki testowe (tytuły zdaniowe jak §6.1):

- `'moves first test to last position'` — `applyReorder([A, B, C], 'a', 'c')` →
  `[B, C, A]`
- `'moves last test to first position'` — `applyReorder([A, B, C], 'c', 'a')` →
  `[C, A, B]`
- `'moves middle test one position forward'` —
  `applyReorder([A, B, C], 'b', 'c')` → `[A, C, B]`
- `'returns unchanged list when activeId not in tests'` — wynik === input
  (referencja)
- `'returns unchanged list when overId not in tests'` — wynik === input
  (referencja)

Fixture: `makeTest(id: string): OrderedTest` — helper zwracający minimalny
obiekt z `testId: id`, fiksed `validatorResult: 'correct'` i
`category: 'critical'`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run typecheck` przechodzi
- `npm run test` — pięć nowych testów przechodzi, istniejące nie regresują

#### Weryfikacja ręczna:

- Celowe złamanie: zmień `arrayMove(tests, oldIndex, newIndex)` na
  `arrayMove(tests, newIndex, oldIndex)` → test
  `'moves first test to last position'` musi się wysypać; przywróć i sprawdź, że
  znów przechodzi

---

## Faza 3: Test komponentowy badge feedback (jsdom)

### Przegląd

Napisz test komponentowy `SessionView.test.tsx` w środowisku jsdom. Test kliknie
przycisk "Zleć" na `DraggableTestCard`, zamockuje `selectTestAction` tak by
zwróciła `{ validatorResult: 'correct', category: 'critical' }`, i zweryfikuje,
że badge "Poprawne" pojawia się w `SortableTestCard` w liście zleconych badań.

### Wymagane zmiany:

#### 1. Plik testowy `SessionView.test.tsx`

**Plik**: `src/modules/session/components/SessionView.test.tsx`

**Cel**: Pokryj integrację Server Action → aktualizacja stanu UI → badge
feedback w `SessionView`.

**Kontrakt**: Plik zaczyna się od:

```
// @vitest-environment jsdom
```

Następnie importy: `render`, `screen`, `within` z `@testing-library/react`;
`userEvent` z `@testing-library/user-event`; `vi`, `beforeEach`, `afterEach` z
`vitest`.

**Mocki** na poziomie pliku (przed describe):

```ts
vi.mock('@/modules/session/actions', () => ({
  selectTestAction: vi.fn(),
  endSessionAction: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    <a href={href} className={className}>{children}</a>,
}))
```

**Fixture props** (`baseProps`):

- `sessionId: 'test-session-id'`
- `timeLimitSeconds: 3600`
- `startedAt: new Date().toISOString()` — wywołane w bloku describe, nie na
  poziomie modułu
- `tests: [{ id: 'test-eko', name: 'EKG 12-odprowadzeniowe' }, { id: 'test-rtg', name: 'RTG klatki' }]`
- `classifications: { 'test-eko': 'critical', 'test-rtg': 'optional' }`
- `initialEvents: []`
- `sessionOutcome: 'in_progress' as const`

**beforeEach / afterEach**:

```ts
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
```

**Przypadek testowy**
(`'shows Poprawne badge after clicking Zleć on a correct test'`):

1. `vi.mocked(selectTestAction).mockResolvedValue({ validatorResult: 'correct', category: 'critical' })`
2. `render(<SessionView {...baseProps} />)`
3. Scope do karty:
   `screen.getByLabelText('Przeciągnij: EKG 12-odprowadzeniowe')`
4. Kliknij button "Zleć" w obrębie tej karty:
   `within(card).getByRole('button', { name: 'Zleć' })`
5. `await userEvent.setup().click(button)`
6. Asercja async:
   `const orderedCard = await screen.findByLabelText('Zmień kolejność: EKG 12-odprowadzeniowe')`
   — `findBy*` czeka na pojawienie się elementu
7. `expect(within(orderedCard).getByText('Poprawne')).toBeInTheDocument()`

Uwaga: `startedAt` oblicz **wewnątrz** `beforeEach` lub `describe` callback, nie
na poziomie modułu — wartość `Date.now()` z poziomu modułu byłaby stałą z czasu
parsowania.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run typecheck` przechodzi
- `npm run test` — nowy test przechodzi
- `npm run test` bez `DATABASE_URL_TEST` — wszystkie testy przechodzą (test
  komponentowy nie wymaga DB)

#### Weryfikacja ręczna:

- Celowe złamanie: w mocku zmień `validatorResult: 'correct'` na
  `validatorResult: 'unnecessary'` → test powinien się wysypać (badge "Poprawne"
  nie pojawia się); przywróć `'correct'` → test znów przechodzi
- Sprawdź, że `vi.useFakeTimers()` skutecznie tłumi ostrzeżenia `act()` o
  `setInterval`

---

## Faza 4: Aktualizacja §6.5 i weryfikacja bramki CI

### Przegląd

Uzupełnij sekcję `### 6.5` w `context/foundation/test-plan.md` wzorcem
podręcznika. Potwierdź, że bramka `component interaction` w §5 jest aktywna po
przejściu testów.

### Wymagane zmiany:

#### 1. Uzupełnij `### 6.5` w `context/foundation/test-plan.md`

**Plik**: `context/foundation/test-plan.md`

**Cel**: Daj przyszłym współpracownikom gotowy wzorzec do dodawania testów
interakcji z komponentem sesji; zastąp placeholder `DO UZUPEŁNIENIA`.

**Kontrakt**: Zastąp placeholder od linii
`### 6.5 Dodawanie testu interakcji z komponentem (UI sesji / DnD)` do następnej
sekcji `### 6.6` nowym zawartością: plik testowy, środowisko, wzorzec mocków,
fixture props, wzorzec klik-button, wzorzec `findByLabelText` + `within`,
wzorzec `applyReorder` (kiedy testować logikę reorder), anti-wzorce. Szablon
treści poniżej.

### Wzorzec do wklejenia w §6.5:

````markdown
### 6.5 Dodawanie testu interakcji z komponentem (UI sesji / DnD)

**Lokalizacja**

- Testy: `src/modules/session/components/SessionView.test.tsx`
- Testy logiki reorder:
  `src/modules/session/components/SessionView.reorder.test.ts`

**Środowisko**: `// @vitest-environment jsdom` jako pierwsza linia pliku
`.test.tsx`. Nie zmieniaj globalnego `environment` w `vitest.config.ts` —
złamałoby testy integracyjne DB.

**Mocki wymagane dla SessionView**

```ts
vi.mock('@/modules/session/actions', () => ({
  selectTestAction: vi.fn(),
  endSessionAction: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    <a href={href} className={className}>{children}</a>,
}))
```
````

**Zarządzanie timerem** — `SessionView` ma `setInterval` na timerze sesji; bez
fake timerów `act()` generuje ostrzeżenia:

```ts
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
```

**Wzorzec kliknięcia przycisku "Zleć"**

`DraggableTestCard` ma `aria-label="Przeciągnij: {name}"` na wrapperze. Scope
button przez `within()`:

```ts
const card = screen.getByLabelText('Przeciągnij: EKG 12-odprowadzeniowe');
await userEvent
  .setup()
  .click(within(card).getByRole('button', { name: 'Zleć' }));
```

**Wzorzec asercji badge walidatora**

`SortableTestCard` ma `aria-label="Zmień kolejność: {name}"`. Użyj
`findByLabelText` (async), aby poczekać na pojawienie się karty po
asynchronicznym `selectTestAction`:

```ts
const orderedCard = await screen.findByLabelText(
  'Zmień kolejność: EKG 12-odprowadzeniowe',
);
expect(within(orderedCard).getByText('Poprawne')).toBeInTheDocument();
```

Mapowanie `validatorResult` → tekst badge: `correct → "Poprawne"`,
`suboptimal → "Akceptowalne"`, `unnecessary → "Zbędne"`,
`critical_miss → "Krytyczny brak"`.

**Wzorzec testu logiki reorder (bez DOM)**

Testuj `applyReorder` bezpośrednio — nie symuluj pointer drag w jsdom:

```ts
// SessionView.reorder.test.ts (node env, brak @vitest-environment)
import { applyReorder, OrderedTest } from './SessionView';

const makeTest = (id: string): OrderedTest => ({
  testId: id,
  name: `Test ${id}`,
  validatorResult: 'correct',
  category: 'critical',
});
it('moves first test to last position', () => {
  const [A, B, C] = ['a', 'b', 'c'].map(makeTest);
  expect(applyReorder([A, B, C], 'a', 'c')).toEqual([B, C, A]);
});
```

**Polecenie uruchamiania**: `npm run test`

**Anti-wzorce do uniknięcia**

- `waitForTimeout` — użyj `findBy*` lub `waitFor`, nigdy `setTimeout`
- Symulacja pointer drag w jsdom — użyj `applyReorder` unit testu dla logiki
  reorder; dla pełnej walidacji DnD w przeglądarce — Playwright
- Asercja przez `validatorResult` prop na komponencie zamiast przez widoczny
  tekst badge — testowałoby implementację, nie zachowanie użytkownika

```

#### 2. Aktualizacja §3 w `context/foundation/test-plan.md`

**Plik**: `context/foundation/test-plan.md`

**Cel**: Oznacz Fazę 5 jako `complete` po przejściu wszystkich testów.

**Kontrakt**: W tabeli §3 zmień status Fazy 5 z `researched` / `planned` / `implementing`
na `complete`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run test` — wszystkie testy (istniejące + nowe) przechodzą bez `DATABASE_URL_TEST`
- `npm run typecheck` przechodzi
- `npm run lint` przechodzi

#### Weryfikacja ręczna:

- `context/foundation/test-plan.md` §6.5 nie zawiera już `DO UZUPEŁNIENIA`
- §3 Faza 5 ma status `complete`
- §5 bramka `component interaction` aktywna zgodnie z opisem `wymagane po §3 Fazie 5`

---

## Strategia testowania

### Testy jednostkowe (`SessionView.reorder.test.ts`):

- `applyReorder` — 5 przypadków pokrywających first→last, last→first, mid→last,
  unknown activeId, unknown overId

### Testy komponentowe (`SessionView.test.tsx`):

- Badge feedback — klik "Zleć" → `selectTestAction` zwraca `correct` → badge "Poprawne"

### Kroki testowania ręcznego:

1. Uruchom `npm run test` — wszystkie testy zielone
2. Celowe złamanie reorder: zamień `arrayMove(tests, oldIndex, newIndex)` na odwrócone →
   test `'moves first test to last position'` czerwony; przywróć
3. Celowe złamanie badge: zmień mock `validatorResult: 'correct'` na `'unnecessary'` →
   test badge czerwony; przywróć

## Referencje

- Badania: `context/changes/testing-session-ui-regression/research.md`
- Plan testów: `context/foundation/test-plan.md` §3 Faza 5, §4 Stack, §6.5
- Wzorzec hermetyczny (Faza 2): `context/foundation/test-plan.md` §6.2
- Wzorzec E2E (Faza 4): `context/foundation/test-plan.md` §6.4
- Istniejące testy: `src/modules/session/actions.test.ts`, `src/modules/session/queries.test.ts`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po zakończeniu kroku.

### Faza 1: Instalacja zależności + vitest.setup.ts

#### Automatyczne

- [x] 1.1 `npm install` kończy się bez błędów dependency conflict
- [x] 1.2 `npm run typecheck` przechodzi po instalacji
- [x] 1.3 `npm run test` przechodzi — istniejące testy nie regresują

#### Ręczne

- [x] 1.4 `package.json` zawiera cztery nowe devDependencies z poprawnymi wersjami
- [x] 1.5 `vitest.setup.ts` ma `import '@testing-library/jest-dom/vitest'` jako pierwszą linię

### Faza 2: Ekstrakcja `applyReorder` + testy jednostkowe

#### Automatyczne

- [ ] 2.1 `npm run typecheck` przechodzi
- [ ] 2.2 `npm run test` — pięć nowych testów przechodzi

#### Ręczne

- [ ] 2.3 Celowe złamanie: odwrócenie `arrayMove` → test `'moves first test to last position'` czerwony; przywrócenie → zielony

### Faza 3: Test komponentowy badge feedback (jsdom)

#### Automatyczne

- [ ] 3.1 `npm run typecheck` przechodzi
- [ ] 3.2 `npm run test` — nowy test przechodzi bez `DATABASE_URL_TEST`

#### Ręczne

- [ ] 3.3 Celowe złamanie: mock `'correct'` → `'unnecessary'` → test badge czerwony; przywrócenie → zielony
- [ ] 3.4 Brak ostrzeżeń `act()` w wyjściu testów

### Faza 4: §6.5 cookbook + status complete

#### Automatyczne

- [ ] 4.1 `npm run typecheck` przechodzi
- [ ] 4.2 `npm run test` — pełna suita zielona
- [ ] 4.3 `npm run lint` przechodzi

#### Ręczne

- [ ] 4.4 `test-plan.md` §6.5 uzupełniony (brak `DO UZUPEŁNIENIA`)
- [ ] 4.5 `test-plan.md` §3 Faza 5 ma status `complete`
```
