# Izolacja Danych i Persystencja Sesji — Plan Implementacji

## Przegląd

Wdrożenie Fazy 2 z `test-plan.md §3`: naprawa dwóch niebezpiecznych funkcji zapytań ujawniających dane między kontami (IDOR), napisanie testu integracyjnego potwierdzającego izolację na poziomie warstwy zapytań, oraz napisanie testu hermetycznego dokumentującego gałąź częściowej awarii w `endSessionAction` — z minimalnym dodatkiem logowania, aby ciche błędy były widoczne.

## Stan Obecny

- `getSessionById` i `getSessionEvents` filtrują wyłącznie po `sessionId` — brak ograniczenia `userId`. Każdy wywołujący może odczytać dane dowolnego użytkownika.
- Zabezpieczenia na poziomie aplikacji istnieją (page.tsx:24, actions.ts:118), jednak nie chronią samych funkcji zapytań; każdy przyszły wywołujący pomijający zabezpieczenie ponownie wprowadza IDOR.
- `endSessionAction` wykonuje dwa niezależne zapisy do bazy bez transakcji. Blok catch w liniach 203-205 połyka wszystkie błędy bazy danych zwracając `{ error: "Internal error" }` bez logowania. Cichy częściowy zapis (Zapis 1 udany, Zapis 2 nieudany) jest niewykrywalny na produkcji.
- Infrastruktura testowa (Vitest, lokalne Supabase, `.env.test`, `vitest.setup.ts`) jest w pełni gotowa z Fazy 1. Nie potrzeba żadnej dodatkowej konfiguracji środowiska.

## Pożądany Stan Końcowy

- `getSessionById(sessionId, userId)` i `getSessionEvents(sessionId, userId)` zwracają `null` / `[]` dla każdego żądania między kontami na poziomie bazy danych — nawet jeśli wywołujący pomija zabezpieczenie na poziomie aplikacji.
- Test integracyjny (prawdziwa baza) dowodzi: błędny userId → `null` / `[]`; poprawny userId → wiersz / zdarzenia.
- `endSessionAction` emituje `console.error` przy każdym błędzie bazy przed zwróceniem ogólnej odpowiedzi błędu.
- Test hermetyczny (zaślepiona baza) dowodzi: gdy Zapis 2 się nie powiedzie, akcja zwraca `{ error: 'Internal error' }` i loguje błąd.
- Instrukcja §6 zaktualizowana o dwuwarstwowy wzorzec (integracja dla reguł na poziomie zapytań, hermetyczny dla gałęzi częściowych awarii).

### Kluczowe ustalenia

- Potwierdzona podatność na poziomie zapytań: `queries.ts:17-24` (getSessionById), `queries.ts:45-50` (getSessionEvents)
- Bezpieczny wzorzec do powielenia: `queries.ts:79-85` (getSessionDetails używa `and(eq(sessionResults.id, sessionId), eq(sessionResults.userId, userId))`)
- `sessionEvents` nie ma kolumny `userId` — filtrowanie po userId wymaga JOIN do `sessionResults` (ten sam JOIN, który `getSessionDetails` już wykonuje w liniach 89-99)
- Potwierdzony połknięty catch: `actions.ts:203-205` — zero logowania przed return
- Brak `.transaction()` nigdzie w bazie kodu — częściowy zapis jest realnym trybem awarii
- Wywołanie `getSessionById` potwierdzone w `page.tsx:23`; `getSessionEvents` wywoływane obok w tej samej stronie

## Czego NIE Robimy

- Nie owijamy zapisów `endSessionAction` w transakcję bazy danych (osobny zakres; brak wzorca transakcji w bazie kodu)
- Nie usuwamy zabezpieczenia userId na poziomie aplikacji w `page.tsx:24` — zachowujemy jako ochronę wielowarstwową
- Nie modyfikujemy `getSessionDetails` — już bezpieczne (queries.ts:79-85)
- Nie piszemy testów e2e (Lekcja 4)
- Nie konfigurujemy hooków CI ani hooków cyklu życia (Lekcja 3)
- Nie uruchamiamy `/10x-test-plan` w celu zmiany strategii ryzyka (Lekcja 1)

## Podejście

Trzy fazy z jednym rezultatem każda. Faza 1 to czysta zmiana kodu — wymagana przed napisaniem testu IDOR, ponieważ pisanie testu dla błędnego zachowania stworzyłoby test lustrzany. Faza 2 dodaje test integracyjny po poprawieniu kodu. Faza 3 jest niezależna: dodanie logowania i test hermetyczny dla Ryzyka #3.

## Krytyczne Szczegóły Implementacji

- **Wzorzec JOIN dla `getSessionEvents`**: `sessionEvents` nie ma kolumny `userId`. Naprawa musi wykonywać JOIN do `sessionResults` przez `eq(sessionEvents.sessionId, sessionResults.id)` i dodać `eq(sessionResults.userId, userId)` do WHERE. Identyczny JOIN pojawia się już w pobieraniu zdarzeń w `getSessionDetails` (queries.ts:89-99). Użyj go jako dosłownego wzorca.
- **Odkrywanie wywołań**: Przed zgłoszeniem Fazy 1, przeszukaj `src/` w poszukiwaniu wszystkich użyć `getSessionById` i `getSessionEvents`. Znane wywołanie to `page.tsx:23` dla `getSessionById`; wywołania `getSessionEvents` muszą być zweryfikowane przed zmianą sygnatury.
- **Głębokość mocka hermetycznego**: `endSessionAction` wykonuje 5+ wywołań bazy przed nieudanym insertem. `vi.mock('@/shared/lib/db')` musi zwracać poprawne dane fixture dla wszystkich poprzednich wywołań (selecty, update zwracający claimed row) i rzucać błąd wyłącznie na `insert`. Płytki mock rzucający błąd na każdym wywołaniu nie przejdzie przez pierwszego selecta.

---

## Faza 1: Naprawa bezpieczeństwa na poziomie zapytań

### Przegląd

Dodanie `userId: string` do `getSessionById` i `getSessionEvents`, zaostrzenie ich klauzul WHERE i aktualizacja wszystkich wywołań. Brak testów w tej fazie — celem jest poprawność kodu, aby Faza 2 mogła napisać sensowny test integracyjny.

### Wymagane Zmiany

#### 1. `getSessionById` — dodanie filtru userId

**Plik**: `src/modules/session/queries.ts`

**Cel**: Zamknięcie IDOR u źródła. Gdy zapytanie filtruje po userId, nieautoryzowany `sessionId` zwraca `null` niezależnie od warstwy wywołującej funkcję.

**Kontrakt**: Sygnatura staje się `getSessionById(sessionId: string, userId: string)`. Klauzula WHERE staje się `and(eq(sessionResults.id, sessionId), eq(sessionResults.userId, userId))` — wzorzec z queries.ts:79-85. Import `and` jest już obecny (queries.ts:3).

#### 2. `getSessionEvents` — dodanie filtru userId przez JOIN do sessionResults

**Plik**: `src/modules/session/queries.ts`

**Cel**: Zamknięcie równoległego IDOR w zapytaniu o zdarzenia. `sessionEvents` nie ma kolumny `userId`, więc filtr musi sięgać przez JOIN.

**Kontrakt**: Sygnatura staje się `getSessionEvents(sessionId: string, userId: string)`. Dodaj `sessionResults` do istniejącego bloku importów. JOIN: `.innerJoin(sessionResults, eq(sessionEvents.sessionId, sessionResults.id))`. WHERE: `and(eq(sessionEvents.sessionId, sessionId), eq(sessionResults.userId, userId))`. Jest to strukturalnie identyczne z tym, co `getSessionDetails` już robi w queries.ts:89-99.

#### 3. Aktualizacja wszystkich wywołań

**Plik**: `src/app/dashboard/session/[sessionId]/page.tsx` (znane) + inne znalezione przez grep

**Cel**: Przekazanie `session.user.id` (dostępne z wywołania `auth()` w page.tsx:20) jako drugiego argumentu do obu naprawionych funkcji. Istniejące zabezpieczenie na poziomie aplikacji w page.tsx:24 pozostaje bez zmian — staje się ochroną wielowarstwową.

**Kontrakt**: Wszystkie istniejące wywołania `getSessionById(sessionId)` stają się `getSessionById(sessionId, session.user.id)`. Wszystkie istniejące wywołania `getSessionEvents(sessionId)` stają się `getSessionEvents(sessionId, session.user.id)`. TypeScript ujawni pominiete wywołania jako błędy typów.

### Kryteria Sukcesu

#### Weryfikacja automatyczna

- TypeScript kompiluje się bez błędów: `npx tsc --noEmit`
- Istniejący zestaw testów vitest przechodzi (brak regresji): `npx vitest run`
- Lint przechodzi: `npx eslint src/`

#### Weryfikacja ręczna

- Strona szczegółów sesji ładuje się poprawnie dla właściciela sesji
- Przejście na adres URL sesji innego użytkownika zwraca 404 (zabezpieczenie na poziomie aplikacji nadal działa)

**Uwaga**: Po przejściu wszystkich automatycznych weryfikacji, zatrzymaj się dla ręcznego potwierdzenia przed przejściem do Fazy 2.

---

## Faza 2: Test integracyjny IDOR (Ryzyko #2)

### Przegląd

Napisanie testu integracyjnego na prawdziwej bazie danych dowodzącego, że `getSessionById` i `getSessionEvents` zwracają null / pustą tablicę dla żądania między kontami. Dwa fixtures użytkowników, jedna sesja należąca do użytkownika A, wszystkie asercje wykonywane z id użytkownika B.

### Wymagane Zmiany

#### 4. Testy integracyjne dla getSessionById i getSessionEvents

**Plik**: `src/modules/session/queries.test.ts` (nowy plik)

**Cel**: Udowodnienie poprawności naprawy na poziomie zapytań na prawdziwej bazie danych — nie mocku, który skłamałby o zachowaniu ograniczeń. Dwóch użytkowników w bazie, jedna sesja należąca do użytkownika A; każda próba odczytania jej jako użytkownik B musi zwracać nic.

**Kontrakt**:
- Zabezpieczenie na poziomie pliku: `const runIntegration = !!process.env.DATABASE_URL_TEST`
- Brak mocka auth — te funkcje zapytań nie wywołują `auth()`
- `beforeAll`: wstawianie w kolejności FK: `users` (id `idor-user-a`, `idor-user-b`) → `scenarios` (id `idor-scenario`) → `sessionResults` (id `idor-session`, userId `idor-user-a`)
- `afterAll`: usuwanie w odwrotnej kolejności FK
- Zestaw: `describe.skipIf(!runIntegration)('getSessionById / getSessionEvents — izolacja IDOR', ...)`

Cztery asercje (wyrocznia: Ryzyko #2 w test-plan.md §2):
1. `getSessionById('idor-session', 'idor-user-a')` → niepusty wiersz (kontrola pozytywna)
2. `getSessionById('idor-session', 'idor-user-b')` → `null` (IDOR zablokowany)
3. `getSessionEvents('idor-session', 'idor-user-a')` → tablica (kontrola pozytywna — pusta jest w porządku)
4. `getSessionEvents('idor-session', 'idor-user-b')` → `[]` (IDOR zablokowany)

### Kryteria Sukcesu

#### Weryfikacja automatyczna

- Testy integracyjne przechodzą przy uruchomionym lokalnym Supabase: `npx vitest run src/modules/session/queries.test.ts`
- Bez ustawionej `DATABASE_URL_TEST`: zestaw jest pomijany (nie oznaczany jako nieudany)
- Pełny zestaw testów nadal przechodzi: `npx vitest run`

#### Weryfikacja ręczna

- Sprawdź, czy lokalne Supabase jest uruchomione przed testem: `npx supabase status`
- Potwierdź, że wynik testu pokazuje 4 przechodzące asercje, a nie 4 pominięte

**Uwaga**: Po przejściu wszystkich weryfikacji, zatrzymaj się dla ręcznego potwierdzenia przed przejściem do Fazy 3.

---

## Faza 3: Test hermetyczny Ryzyka #3 + logowanie

### Przegląd

Dwie zmiany, obie dotyczące `endSessionAction`: (1) dodanie `console.error` do bloku catch, aby błędy bazy danych nie były już ciche; (2) napisanie testu hermetycznego, który zaślepia bazę danych, aby wymusić błąd Zapisu 2, i potwierdza obserwowalny kontrakt.

### Wymagane Zmiany

#### 5. Dodanie logowania do bloku catch

**Plik**: `src/modules/session/actions.ts`

**Cel**: Uczynienie błędów bazy danych wykrywalnymi w logach. Obecnie catch w liniach 203-205 zwraca odpowiedź błędu bez żadnego śladu — niemożliwe do zdiagnozowania na produkcji.

**Kontrakt**: Na początku bloku catch (przed `return { error: "Internal error" }`), dodaj `console.error('[endSessionAction] DB error:', error)`. Nie potrzeba importów. Brak zmiany zachowania dla wywołujących.

#### 6. Test hermetyczny dla gałęzi częściowej awarii Zapisu 2

**Plik**: `src/modules/session/actions.test.ts` (rozszerzenie istniejącego pliku)

**Cel**: Udokumentowanie obserwowalnego kontraktu dla gałęzi awarii: wywołujący otrzymuje `{ error: 'Internal error' }` i błąd jest logowany. Tej gałęzi nie można niezawodnie wywołać na prawdziwym lokalnym Supabase, więc zaślepka hermetyczna jest właściwym narzędziem.

**Kontrakt**:
- Dodaj drugi blok `describe` (nie opakowany w `skipIf`) — testy hermetyczne działają we wszystkich środowiskach
- `vi.mock('@/shared/lib/db')` wewnątrz bloku describe — mock musi zwracać poprawne dane fixture dla wszystkich poprzednich wywołań bazy (trzy łańcuchy `select()` i `update().returning()`) i rzucać `new Error('DB timeout')` wyłącznie z wywołania `insert().values()`
- `vi.spyOn(console, 'error').mockImplementation(() => {})` do przechwycenia wywołania logu
- Asercja: `await endSessionAction('test-session-id')` równa się `{ error: 'Internal error' }`
- Asercja: `console.error` był wywołany z ciągiem pasującym do `'[endSessionAction] DB error:'` i rzuconym błędem
- Przywrócenie spies w `afterEach`

**Uwaga o głębokości mocka**: `endSessionAction` wywołuje `db.select()` trzy razy przed nieudanym `db.insert()`. Mock musi rozróżnić je (np. kolejnością wywołań przez łańcuchy `mockResolvedValueOnce`) lub przez oddzielne instancje vi.fn() na typ operacji. Update musi zwracać `[{ ...claimedRow, outcome: 'positive', isFailed: false, completedAt: new Date() }]` z `.returning()`, aby dotrzeć do gałęzi z insertem.

#### 7. Aktualizacja instrukcji

**Plik**: `context/foundation/test-plan.md`

**Cel**: Zapisanie dwuwarstwowego wzorca testów w §6 (Instrukcja), aby przyszłe fazy mogły go stosować bez ponownego wyprowadzania podejścia.

**Kontrakt**: Dołącz nową podsekcję do §6 dokumentującą:
- Kiedy używać testów integracyjnych: reguły zależące od prawdziwego stanu bazy, ograniczeń FK, unikalnych ograniczeń — zapytania, o których mock by skłamał
- Kiedy używać testów hermetycznych: gałęzie częściowych awarii, gdzie prawdziwa infrastruktura nie może niezawodnie wywołać jednego kroku kończącego się niepowodzeniem przy udanym innym
- Wzorzec `describe.skipIf(!runIntegration)` z zabezpieczeniem `DATABASE_URL_TEST`
- Wzorzec `vi.mock('@/shared/lib/db')` z łańcuchami `mockResolvedValueOnce` do kolejności zachowania wywołań
- Źródło wyroczni dla każdej warstwy: schemat bazy / ryzyka test-plan §2 dla integracyjnych; tryby awarii test-plan §2 dla hermetycznych

### Kryteria Sukcesu

#### Weryfikacja automatyczna

- Wszystkie testy przechodzą, w tym nowy test hermetyczny: `npx vitest run`
- Test hermetyczny przechodzi bez połączenia z bazą (uruchom bez ustawionej `DATABASE_URL_TEST`)
- TypeScript kompiluje się: `npx tsc --noEmit`

#### Weryfikacja ręczna

- Sprawdź mock hermetyczny: potwierdź, że łańcuch `mockResolvedValueOnce` realistycznie modeluje sekwencję Zapis-1-udany / Zapis-2-nieudany (pierwsze trzy selecty zwracają poprawne dane, update zwraca claimed row, insert rzuca błąd)
- Potwierdź, że wpis w §6 instrukcji jest dokładny i spójny z wzorcami używanymi w `actions.test.ts`

---

## Strategia Testowania

### Testy integracyjne (Faza 2)

- Prawdziwa lokalna baza Supabase (`127.0.0.1:54322`)
- Fixture z dwoma użytkownikami, aby odizolować asercje między kontami od asercji tego samego konta
- Teardown `beforeAll` / `afterAll` — brak rollbacku transakcji (niedostępny w bazie kodu)
- Zabezpieczenie: `describe.skipIf(!runIntegration)` — testy integracyjne nie są bramą CI; uruchamiane lokalnie gdy baza jest dostępna

### Testy hermetyczne (Faza 3)

- Zaślepiony klient bazy przez `vi.mock('@/shared/lib/db')`
- Działa we wszystkich środowiskach, nie wymaga infrastruktury
- Testuje gałąź awarii, której prawdziwa infrastruktura nie może wywołać w przewidywalny sposób

### Testowanie mutacyjne (po fazie, opcjonalne)

Po przejściu Fazy 2: `npx stryker run --mutate "src/modules/session/queries.ts"`. Priorytetem są ocalałe mutanty w klauzuli WHERE — każdy mutant usuwający warunek `eq(sessionResults.userId, userId)`, który nie zostaje zabity, jest luką w teście IDOR.

## Referencje

- Badania: `context/changes/testing-data-isolation-session-persistence/research.md`
- Istniejący wzorzec testów: `src/modules/session/actions.test.ts`
- Bezpieczne zapytanie referencyjne: `src/modules/session/queries.ts:67-109` (`getSessionDetails`)
- Definicje ryzyk: `context/foundation/test-plan.md §2`

---

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Naprawa bezpieczeństwa na poziomie zapytań

#### Automatyczne

- [x] 1.1 TypeScript kompiluje się bez błędów: `npx tsc --noEmit`
- [x] 1.2 Istniejący zestaw testów vitest przechodzi: `npx vitest run`
- [x] 1.3 Lint przechodzi: `npx eslint src/`

#### Ręczne

- [x] 1.4 Strona szczegółów sesji ładuje się poprawnie dla właściciela sesji
- [x] 1.5 URL sesji innego użytkownika zwraca 404

### Faza 2: Test integracyjny IDOR

#### Automatyczne

- [ ] 2.1 Testy integracyjne przechodzą przy uruchomionym lokalnym Supabase: `npx vitest run src/modules/session/queries.test.ts`
- [ ] 2.2 Zestaw jest pomijany (nie nieudany) gdy `DATABASE_URL_TEST` nie jest ustawiona
- [ ] 2.3 Pełny zestaw testów przechodzi: `npx vitest run`

#### Ręczne

- [ ] 2.4 Wynik testu pokazuje 4 przechodzące asercje (kontrole pozytywne i negatywne dla obu funkcji)

### Faza 3: Test hermetyczny Ryzyka #3 + logowanie

#### Automatyczne

- [ ] 3.1 Wszystkie testy przechodzą, w tym nowy test hermetyczny: `npx vitest run`
- [ ] 3.2 Test hermetyczny przechodzi bez ustawionej `DATABASE_URL_TEST`
- [ ] 3.3 TypeScript kompiluje się: `npx tsc --noEmit`

#### Ręczne

- [ ] 3.4 Mock hermetyczny poprawnie modeluje sekwencję Zapis-1-udany / Zapis-2-nieudany
- [ ] 3.5 Wpis w §6 instrukcji jest dokładny i spójny z faktycznie użytymi wzorcami testów
