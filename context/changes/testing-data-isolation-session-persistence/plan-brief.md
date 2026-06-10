# Izolacja Danych i Persystencja Sesji — Krótki Plan

> Pełny plan: `context/changes/testing-data-isolation-session-persistence/plan.md`
> Badania: `context/changes/testing-data-isolation-session-persistence/research.md`

## Co i dlaczego

Dwa potwierdzone ryzyka z `test-plan.md §2` otrzymują pokrycie testami w tej fazie. Ryzyko #2: `getSessionById` i `getSessionEvents` ujawniają dane dowolnego użytkownika każdemu wywołującemu — jedyną ochroną są dziś zabezpieczenia na poziomie aplikacji, a nie ograniczenia na poziomie zapytań. Ryzyko #3: `endSessionAction` może wykonać częściowy zapis (Zapis 1 udany, Zapis 2 nieudany), a blok catch połyka błąd bez logowania. Oba ryzyka wymagają zmiany kodu przed napisaniem testów.

## Punkt Wyjścia

Infrastruktura testowa jest już gotowa z Fazy 1 (Vitest, lokalne Supabase, `.env.test`, `vitest.setup.ts`). `getSessionDetails` (queries.ts:67-109) już demonstruje poprawny wzorzec z zakresem userId — ten plan stosuje go do dwóch siostrzanych funkcji, które go pominęły. `endSessionAction` nie ma logowania ani transakcji; produkcyjna naprawa w tym planie jest minimalna (wyłącznie logowanie).

## Pożądany Stan Końcowy

`getSessionById` i `getSessionEvents` zwracają `null` / `[]` dla każdego żądania między kontami na poziomie bazy — nie jest możliwe ominięcie przez wywołującego. Test integracyjny dowodzi tego na prawdziwej bazie. `endSessionAction` emituje `console.error` przed zwróceniem `{ error: "Internal error" }`, a test hermetyczny dokumentuje obserwowalny kontrakt dla gałęzi częściowej awarii.

## Kluczowe Podjęte Decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Zakres getSessionEvents | Naprawa w Fazie 2 | Pozostawienie jednej niebezpiecznej funkcji zdarzeń po naprawieniu funkcji sesji utrzymuje powierzchnię IDOR w połowie otwartą | Plan |
| Strategia userId dla getSessionEvents | JOIN do sessionResults | sessionEvents nie ma kolumny userId; JOIN to jedyna opcja na poziomie zapytań, a getSessionDetails już używa identycznego JOIN | Badania / Plan |
| Produkcyjna naprawa Ryzyka #3 | Tylko console.error | Dodaje obserwowalność bez restrukturyzacji funkcji ani wprowadzania wzorca transakcji bez precedensu w bazie kodu | Plan |
| Struktura faz | 3 fazy | Naprawa kodu → test integracyjny → test hermetyczny; każda faza ma jeden rezultat i wyraźny punkt kontrolny | Plan |

## Zakres

**W zakresie:**
- Dodanie parametru `userId` i filtru WHERE do `getSessionById` i `getSessionEvents`
- Aktualizacja wywołań w `page.tsx` (i innych znalezionych przez grep)
- Nowy `queries.test.ts` z 4 asercjami integracyjnymi (2 kontrole pozytywne, 2 blokady IDOR)
- `console.error` w bloku catch `endSessionAction`
- Test hermetyczny dla gałęzi błędu Zapisu-2 w `actions.test.ts`
- Aktualizacja §6 instrukcji dokumentująca dwuwarstwowy wzorzec

**Poza zakresem:**
- Transakcja bazodanowa dla `endSessionAction` (brak wzorca transakcji; osobny zakres)
- Usunięcie zabezpieczenia userId na poziomie aplikacji w `page.tsx:24` (zachowaj jako ochronę wielowarstwową)
- Zmiany w `getSessionDetails` (już bezpieczne)
- Hooki CI/CD, testy e2e, MCP, hooki cyklu życia

## Architektura / Podejście

Najpierw naprawa na poziomie zapytań (Faza 1), następnie test integracyjny (Faza 2), następnie test hermetyczny (Faza 3). Fazy 2 i 3 są niezależne po zakończeniu Fazy 1. Testy integracyjne używają zabezpieczenia `describe.skipIf(!runIntegration)` i działają na prawdziwym lokalnym Supabase. Test hermetyczny używa `vi.mock('@/shared/lib/db')` z łańcuchami `mockResolvedValueOnce` do modelowania sekwencji Zapis-1-udany / Zapis-2-nieudany — działa we wszystkich środowiskach.

## Fazy w Skrócie

| Faza | Dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Naprawa na poziomie zapytań | `getSessionById(sessionId, userId)` i `getSessionEvents(sessionId, userId)` z WHERE userId | Pominięte wywołania powodują błędy TypeScript — najpierw grep |
| 2. Test integracyjny IDOR | 4 asercje w `queries.test.ts` na prawdziwej bazie; błędny userId → null/[] | Lokalne Supabase musi być uruchomione; test potwierdza faktyczną skuteczność naprawy |
| 3. Test hermetyczny + logowanie | `console.error` w catch + test hermetyczny w `actions.test.ts` | Głębokość mocka — 5+ wywołań bazy w funkcji; mock musi zwracać poprawne dane dla pierwszych 4 i rzucać błąd wyłącznie na insert |

**Wymagania wstępne:** Lokalne Supabase uruchomione dla Fazy 2 (`npx supabase status`). Nie potrzeba nowej konfiguracji środowiska — `.env.test` już skonfigurowane.

**Szacowany nakład pracy:** ~2 skupione sesje w 3 fazach.

## Otwarte Ryzyka i Założenia

- Wywołania `getSessionEvents`: badania potwierdzają, że funkcja jest wywoływana ze strony szczegółów sesji obok `getSessionById`, ale dokładne numery linii `getSessionEvents` w `page.tsx` nie zostały potwierdzone. Najpierw grep przed zmianą sygnatury.
- Złożoność mocka hermetycznego: `endSessionAction` wykonuje 5+ sekwencyjnych wywołań bazy. Kolejność łańcucha `mockResolvedValueOnce` musi dokładnie odpowiadać sekwencji wywołań funkcji. Jeśli funkcja zostanie zrefaktoryzowana między Fazą 1 a Fazą 3, mock może wymagać korekty.

## Kryteria Sukcesu (Podsumowanie)

- Wywołania `getSessionById` / `getSessionEvents` między kontami zwracają `null` / `[]` — potwierdzone testem integracyjnym na prawdziwej bazie
- Gałąź błędu Zapisu-2 w `endSessionAction` zwraca `{ error: 'Internal error' }` i loguje błąd — potwierdzone testem hermetycznym działającym bez bazy
