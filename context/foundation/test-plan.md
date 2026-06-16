# Plan testów

> Stopniowe wdrażanie testów dla tego projektu. Strategia jest zamrożona na
> górze (§1–§5); wzorce podręcznika na dole (§6) uzupełniane są w miarę
> realizacji faz. Przeczytaj przed napisaniem jakiegokolwiek nowego testu.
>
> Odświeżanie: uruchom ponownie `/10x-test-plan --refresh` gdy nieaktualne
> (patrz §8).
>
> Ostatnia aktualizacja: 2026-06-11

## 1. Strategia

Testy kierują się trzema nienaruszalnymi zasadami dla tego projektu:

1. **Koszt × sygnał.** Najtańszy test, który daje prawdziwy sygnał dla danego
   ryzyka, wygrywa. Nie promuj do e2e, bo e2e „czuje się bezpieczniej". Nie
   nakładaj modelu wizyjnego na deterministyczny diff, który już wykrywa
   regresję.
2. **Obawy użytkownika są dowodem klasy pierwszej.** Ryzyka zakorzenione w
   „zespół boi się X, a awaria pojawiłaby się gdzieś w <obszarze>" mają taką
   samą wagę jak linie PRD lub dane hot-spotów.
3. **Ryzyka to scenariusze, nie lokalizacje kodu.** Ten plan dokumentuje _co
   mogłoby się zepsuć_ i _dlaczego uważamy, że jest to prawdopodobne_ — czerpiąc
   z dokumentów, wywiadu i _sygnału_ kodu (churn, struktura, baza testów). NIE
   twierdzi, że wie, który wiersz jest odpowiedzialny za awarię. Ta wiedza
   pochodzi z `/10x-research` podczas każdej fazy wdrażania. Jeżeli plan i
   badanie różnią się w kwestii lokalizacji awarii, badanie jest źródłem prawdy.

Zakres hot-spotów użyty do ważenia prawdopodobieństwa: `src/app`, `src/shared`,
`src/modules`, `src/hooks`.

## 2. Mapa ryzyk

Główne scenariusze awarii, przed którymi projekt musi się chronić, uszeregowane
według ryzyka = wpływ × prawdopodobieństwo. Ryzyka to scenariusze awarii w
języku użytkownika / biznesu, a nie nazwy testów. Kolumna Źródło cytuje _dowody,
które ujawniły ryzyko_ — nigdy konkretny plik jako „miejsce awarii" (to jest
zadanie badania, patrz §1 zasada #3).

| #   | Ryzyko (scenariusz awarii)                                                                                                                                                                                                           | Wpływ  | Prawdopod. | Źródło (dowód — nie kotwica)                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Student wybiera właściwe badanie ratujące życie; walidator cicho zwraca „unnecessary" zamiast „correct", bo klasyfikacje nie zostały załadowane (pusty wynik DB). Wynik sesji jest błędny bez żadnego crasha ani widocznego sygnału. | Wysoki | Średnie    | PRD Logika biznesowa (deterministyczna reguła walidatora); wywiad Q1; wywiad Q3 (returns-proper-feedback = obszar największej niepewności); hot-spot `src/modules/session` — 7 zmian/30 dni; badanie: `selectTestAction` nie zabezpiecza przed pustą mapą klasyfikacji — domyślne `?? "unnecessary"` odpala się cicho |
| 2   | Uwierzytelnione żądanie Studenta B do `/dashboard/session/[id_studenta_A]` zwraca 200 z danymi Studenta A. Cross-account IDOR.                                                                                                       | Wysoki | Niskie     | PRD Kontrola dostępu (reguła izolacji danych); wywiad Q1; roadmap S-03 (każde zapytanie musi filtrować po userId); hot-spot `src/modules/session` — 7 zmian/30 dni                                                                                                                                                    |
| 3   | `endSessionAction` odpala się, zapis do DB cicho się nie powodzi, zakończona sesja nigdy nie pojawia się w historii. Student nie widzi żadnego błędu.                                                                                | Średni | Niskie     | PRD FR-008; roadmap S-03 zależy od niezawodnego zapisu S-02; hot-spot `src/modules/session` — 7 zmian/30 dni                                                                                                                                                                                                          |
| 4   | Po zmianie w kodzie pierwszego lub ostatniego badania na liście nie można przeciągać — pozostaje tylko obejście przez kliknięcie przycisku. Brak błędu, tylko zepsute DnD.                                                           | Średni | Wysokie    | Wywiad Q2 (poprzedni incydent z tym dokładnie błędem); wywiad Q3 (DnD = obszar największej niepewności); hot-spot `src/modules/session/components` — 32 zmiany/30 dni (najgorętszy katalog)                                                                                                                           |
| 5   | Dane miękkousunięte konto przeżywają 30-dniowe okno retencji. Zadanie czyszczące nigdy nie działa lub działa z błędnym warunkiem brzegowym. Naruszenie RODO.                                                                         | Wysoki | Niskie     | Ryzyko roadmap S-05; archiwum planu `account-deletion` (soft-delete + zaplanowane czyszczenie)                                                                                                                                                                                                                        |
| 6   | Nieuwierzytelnione (lub wygasłe) żądanie dociera do `/dashboard/*` i otrzymuje treść zamiast przekierowania do `/login`. Middleware auth cicho przepuszcza.                                                                          | Wysoki | Niskie     | PRD Kontrola dostępu; roadmap F-01 (ryzyko błędnej konfiguracji AUTH_URL); roadmap F-03 (wzorzec podziału auth.config.ts na Edge); roadmap S-01 (luka w przekierowaniu middleware)                                                                                                                                    |
| 7   | Student otwiera scenariusz kliniczny, wybiera badania i dostaje feedback walidatora — cały flow przeglądarkowy nie ma żadnego pokrycia E2E. Regresja w głównej ścieżce produktu (S-02, gwiazda przewodnia) jest wykrywana ręcznie.   | Wysoki | Średnie    | PRD US-01/FR-003–007; roadmap S-02 (gwiazda przewodnia, done); hot-spot `src/modules/session/components` — 35 zmian/30 dni; odświeżenie wywiadu Q1, Q3, Q4                                                                                                                                                            |
| 8   | `auth.setup.ts` ładuje gotowy plik `playwright/.auth/user.json` zamiast wypełniać formularz logowania. Każda zmiana w login route, Auth.js credentials provider lub konfiguracji cookie jest niewidoczna dla testów.                 | Wysoki | Niskie     | Hot-spot `src/modules/auth/components` — 11 zmian/30 dni; `auth.setup.ts:8–14` ładuje zapisany stan sesji, nie wywołuje `page.fill()`                                                                                                                                                                                 |

### Wskazówki dotyczące reagowania na ryzyko

| Ryzyko | Co udowodniłoby ochronę                                                                                                                                                                                                                                                               | Musi kwestionować                                                                                                                                                                                                                                         | Kontekst do zweryfikowania przez `/10x-research`                                                                                                                                                                                                                                                                      | Prawdopodobnie najtańsza warstwa                                                                                                                                                                                     | Anty-wzorzec do uniknięcia                                                                                                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1     | Dla scenariusza X i badania Y (znana klasyfikacja) walidator zwraca dokładnie oczekiwany status — nie tylko non-null, ale poprawną wartość. Wynik sesji się zgadza. Ponadto: przy pustej mapie klasyfikacji wywołujący NIE może cicho zaakceptować „unnecessary" jako poprawny wynik. | „Walidator zwrócił non-null, więc jest poprawny" — może zwrócić błędną non-null wartość cicho. „Klasyfikacje załadowane, więc niepuste" — zapytanie DB może zwrócić pusty wynik bez błędu; `?? "unnecessary"` odpala się cicho w `validateTestSelection`. | `validateTestSelection` jest czyste (przyjmuje zwykły Record). `selectTestAction` ładuje klasyfikacje per-request z tabeli `testClassifications` kluczowanej po `scenarioId`; brak zabezpieczenia przed pustą mapą. Wyrocznia testu jednostkowego musi pochodzić z danych tabeli klasyfikacji, nie z kodu walidatora. | Jednostkowy na `validateTestSelection` z fixture Record (bez DB). Oddzielny integracyjny na `selectTestAction` względem prawdziwego schematu testowego (nie mockuj Drizzle — mockowanie ukrywa lukę pustego wyniku). | Testowanie tylko happy-path (poprawne badanie → pozytywny); pomijanie cichego domyślnego przypadku pustej mapy. Wyrocznia z lustrzaną implementacją: nigdy nie wyprowadzaj oczekiwanego `validatorResult` z `CATEGORY_TO_RESULT` w teście — użyj zwykłego angielskiego opisu klasyfikacji jako wyroczni. |
| #2     | Uwierzytelnione żądanie Studenta B z sessionId Studenta A zwraca null / 404 / przekierowanie — nigdy 200 z danymi.                                                                                                                                                                    | „Strona pokazuje dane sesji, więc muszą być odfiltrowane" — strona RSC może serwować dane, jeśli klauzula `WHERE userId` jest nieobecna w zapytaniu.                                                                                                      | Jak strona szczegółów sesji pobiera dane? Czy userId pochodzi z `session.user.id` Auth.js? Co się dzieje, gdy sessionId nie należy do wnioskującego?                                                                                                                                                                  | Test integracyjny na funkcji zapytania: `getSessionById(userId, wrongOwnerSessionId)` → null                                                                                                                         | Testowanie tylko „uwierzytelniony użytkownik widzi swoje dane"; nigdy nie testowanie odmowy dostępu między kontami.                                                                                                                                                                                      |
| #3     | Po odpaleniu `endSessionAction` funkcja `getUserSessions(userId)` zwraca zakończoną sesję z poprawnym `outcome` i `completedAt`.                                                                                                                                                      | „Akcja nie rzuciła wyjątku, więc zapis się powiódł" — połknięte wyjątki, brakujące await, cichy rollback.                                                                                                                                                 | Czy `endSessionAction` używa transakcji? Czy obsługuje błędy DB? Jaki jest kształt zwracanej wartości?                                                                                                                                                                                                                | Integracyjny: `endSessionAction` + round-trip zapytania względem prawdziwego schematu testowego                                                                                                                      | Mockowanie zapisu do DB — ukrywa faktyczną gwarancję trwałości danych.                                                                                                                                                                                                                                   |
| #4     | Po zmianie kodu SessionView lub konfiguracji `@dnd-kit` przeciągnięcie **pierwszego** badania na inną pozycję poprawnie zmienia kolejność w stanie UI.                                                                                                                                | „Handler odpala się, więc drag działa" — `over` będące null na krawędziach listy to udokumentowany poprzedni błąd.                                                                                                                                        | Jaka jest logika rozgałęzień `handleDragEnd`? Jakie ograniczenie aktywacji jest ustawione? Co się dzieje gdy `over` jest null dla source=available?                                                                                                                                                                   | Test interakcji z komponentem: symuluj przeciągnięcie wskaźnikiem na pierwszym elemencie, asercja zmiany kolejności stanu                                                                                            | Testowanie tylko tego, że `handleSelectTest` jest wywoływalne; bez symulacji faktycznej sekwencji przeciągania z pozycjami krawędziowymi.                                                                                                                                                                |
| #5     | Dla wierszy z `deleted_at` = (teraz − 31 dni) funkcja czyszcząca je usuwa. Wiersze z `deleted_at` = (teraz − 29 dni) pozostają.                                                                                                                                                       | „Flaga soft-delete jest ustawiona, więc dane zostaną wyczyszczone" — zadanie cron może nie uruchamiać się; zapytanie może pominąć warunek brzegowy.                                                                                                       | Jaki mechanizm wyzwala czyszczenie (Workers cron vs zaplanowana funkcja)? Które tabele mają `deleted_at`? Jaka jest logika warunku brzegowego?                                                                                                                                                                        | Test jednostkowy na funkcji czyszczącej z fixture wierszami w dniach 29 i 31                                                                                                                                         | Testowanie tylko ustawiania flagi soft-delete przy usuwaniu; nigdy nie weryfikowanie granicy czyszczenia.                                                                                                                                                                                                |
| #6     | Nieuwierzytelnione żądanie do `/dashboard` i `/dashboard/session/[id]` zwraca przekierowanie do / (root), nigdy nie serwuje treści.                                                                                                                                                   | „middleware.ts istnieje, więc wszystkie chronione trasy są pokryte" — problemy z konfiguracją Edge runtime na Cloudflare Workers mogą sprawić, że middleware cicho przepuści żądania.                                                                     | Które trasy są w matcherze middleware? Jak JWT jest weryfikowane na Edge? Co oznacza podział auth.config.ts dla ścieżki weryfikacji?                                                                                                                                                                                  | Integracyjny/e2e: nieuwierzytelnione żądanie HTTP do `/dashboard` → asercja przekierowania                                                                                                                           | Testowanie tylko przepływów login/logout; bez bezpośredniego testowania, że nieuwierzytelnione żądanie do chronionej ścieżki jest blokowane.                                                                                                                                                             |
| #7     | Zalogowany student: nawiguje do scenariusza → widzi listę badań → wybiera znane badanie krytyczne (znana klasyfikacja) → UI pokazuje feedback „Prawidłowy" → kończy sesję → sesja pojawia się w historii z poprawnym outcome.                                                         | „Server action przechodzi test jednostkowy, więc flow przeglądarkowy działa" — DnD + stan klienta + wiring server action ≠ pokrycie jednostkowe.                                                                                                          | Jak `selectTestAction` jest wywoływane z przeglądarki? Jaki stan klienta zarządza listą badań? Czy timer wchodzi w interakcję z zakończeniem sesji?                                                                                                                                                                   | E2E (Playwright) — flow przekracza cookie auth + server action + stan klienta + feedback UI; integracja tego nie zasymuluje.                                                                                         | Testowanie tylko przez przycisk-klik zamiast DnD; asercja tylko tego, że akcja odpalona, bez sprawdzenia, czy feedback w UI się wyrenderował.                                                                                                                                                            |
| #8     | Wypełnienie e-mail + hasło w formularzu logowania → POST do `/api/auth/callback/credentials` → cookie sesji ustawiony → przekierowanie do `/dashboard` zakończone sukcesem.                                                                                                           | „auth.setup.ts sprawdza /dashboard, więc logowanie działa" — weryfikuje pre-zapisaną sesję, nie sam formularz.                                                                                                                                            | Który endpoint POST obsługuje formularz logowania? Jaka jest wartość `callbackUrl` po udanym logowaniu? Co się dzieje z ciasteczkiem sesji w środowisku testowym?                                                                                                                                                     | E2E (Playwright) — logowanie przekracza wypełnienie formularza + route API + ustawienie cookie; wymaga testowania na poziomie przeglądarki. W tej samej fazie co Ryzyko #7.                                          | Poleganie wyłącznie na zapisanym `storageState` w `auth.setup.ts` i nigdy niewywoływanie `page.fill()` na formularzu.                                                                                                                                                                                    |

## 3. Stopniowe wdrażanie

Każdy wiersz to oddzielna faza wdrażania, która otworzy własny folder zmiany
przez `/10x-new`. Status przesuwa się od lewej do prawej przez poniższe
wartości; orkiestrator aktualizuje Status w miarę pojawiania się artefaktów na
dysku.

| #   | Nazwa fazy                                         | Cel (jeden wiersz)                                                                                                                                   | Pokrywane ryzyka | Typy testów                  | Status      | Folder zmiany                                              |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------- | ----------- | ---------------------------------------------------------- |
| 1   | Bootstrap runnera + testy jednostkowe walidatora   | Zainstaluj vitest; udowodnij, że pierwszy test przechodzi; przetestuj jednostkowo logikę klasyfikacji walidatora z danymi fixture                    | #1               | unit, integration            | complete    | context/changes/testing-runner-bootstrap                   |
| 2   | Izolacja danych + trwałość sesji                   | Testy integracyjne zapytań z zakresem userId + round-trip zapisu sesji na prawdziwym DB                                                              | #2, #3           | integration (DB)             | complete    | context/changes/testing-data-isolation-session-persistence |
| 3   | Brama granicy auth                                 | Udowodnij, że middleware blokuje nieuwierzytelniony dostęp do wszystkich chronionych tras                                                            | #6               | integration, lightweight e2e | complete    | context/changes/testing-auth-boundary-gate                 |
| 4   | E2E głównego przepływu sesji + formularz logowania | Udowodnij, że główny flow diagnostyczny (S-02) działa end-to-end w przeglądarce; zastąp fixture saved-state testem wypełniającym formularz logowania | #7, #8           | e2e (Playwright)             | complete    | context/changes/testing-e2e-session-flow                   |
| 5   | Regresja UI sesji — baseline                       | Test interakcji z komponentem dla przeciągania DnD na pierwszym/ostatnim elemencie; wyświetlanie feedbacku walidatora w SessionView                  | #4               | component interaction        | complete    | context/changes/testing-session-ui-regression              |
| 6   | Brama retencji RODO                                | Test jednostkowy logiki czyszczenia przy granicy 30-dniowej (aktywuj po wdrożeniu S-05)                                                              | #5               | unit                         | not started | —                                                          |

## 4. Stos

Klasyczna baza testowa dla tego projektu. Wybory narzędzi poniżej to
potwierdzona hipoteza dla zainstalowanych narzędzi; `/10x-research` dla każdej
następnej fazy musi zweryfikować kompatybilność z aktualnym środowiskiem przed
zatwierdzeniem.

| Warstwa               | Narzędzie                           | Wersja                              | Uwagi                                                                                                                                                |
| --------------------- | ----------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration    | Vitest                              | ^3.2.6 (zainstalowany)              | ESM-native, TypeScript-first. Kompatybilny z Next.js 16 + Cloudflare Workers dla testów w środowisku Node.js. Patrz §6.1 dla wzorców.                |
| component interaction | @testing-library/react + jsdom      | ^16 zainstalowany — patrz §3 Faza 5 | Do testów interakcji SessionView/DnD. Pointer drag w jsdom niepewny — testuj logikę reorder przez `applyReorder` (unit), pełny DnD przez Playwright. |
| integration (DB)      | Vitest + prawdziwy schemat Supabase | zainstalowany — patrz §3 Faza 2     | Nie mockuj Drizzle ORM — mocki ukrywają gwarancję trwałości (anty-wzorzec Ryzyka #3).                                                                |
| auth middleware       | Vitest + fetch mock lub Playwright  | Playwright ^1.60.0 (zainstalowany)  | Cloudflare Workers Edge runtime może wymagać miniflare lub Playwright do dokładnego testowania middleware. Zweryfikowano w Fazie 3.                  |
| e2e                   | Playwright                          | ^1.60.0 (zainstalowany)             | Dla przepływów wymagających pełnego kształtu wdrożenia (auth + cookie + crossing handlerów). Patrz §3 Faza 3 i Faza 4.                               |

**Narzędzia ugruntowujące stos (bieżąca sesja):**

- Docs: brak — Context7 / docs MCP frameworków niedostępny w bieżącej sesji;
  sprawdzono: 2026-06-08
- Search: Exa.ai — dostępny; nie zapytano (lokalne dowody z manifestu
  wystarczające dla hipotezy Fazy 1); sprawdzono: 2026-06-08
- Runtime/browser: Playwright MCP — niedostępny w bieżącej sesji; sprawdzono:
  2026-06-08
- Provider/platform: GitHub/Cloudflare/Supabase MCP — niedostępny w bieżącej
  sesji; sprawdzono: 2026-06-08

## 5. Bramki jakości

Pełny zestaw bramek, które muszą przejść, zanim zmiana trafi na produkcję.

| Bramka                      | Gdzie      | Wymagane?              | Wykrywa                                    |
| --------------------------- | ---------- | ---------------------- | ------------------------------------------ |
| lint + typecheck            | local + CI | wymagane               | dryf składniowy / typowy                   |
| unit + integration          | local + CI | wymagane po §3 Fazie 1 | regresje logiki walidatora, błędy izolacji |
| sprawdzenie middleware auth | CI na PR   | wymagane po §3 Fazie 3 | nieuwierzytelniony dostęp do tras          |
| component interaction       | local + CI | wymagane po §3 Fazie 5 | regresje interakcji DnD                    |
| e2e dla głównych przepływów | CI na PR   | wymagane po §3 Fazie 3 | zepsute ścieżki auth + sesji end-to-end    |

## 6. Wzorce podręcznika

Jak dodawać nowe testy w tym projekcie. Każda podsekcja jest uzupełniana po
wysłaniu odpowiedniej fazy wdrażania.

### 6.1 Dodawanie testu jednostkowego (logika walidatora)

**Lokalizacje**

- Testy jednostkowe: `src/shared/lib/validator.test.ts`
- Testy integracyjne: `src/modules/session/actions.test.ts`

**Konwencja nazewnictwa**: Opisy testów w formie zdania —
`'critical test returns correct'` nie `'validates critical category'`.

**Reguła wyroczni**: Oczekiwany `validatorResult` pochodzi z semantyki
klasyfikacji w zwykłym języku („test krytyczny musi zwracać 'correct'"). Nigdy
nie wyprowadzaj oczekiwanych wartości z `CATEGORY_TO_RESULT` w teście — to jest
wyrocznia z lustrzaną implementacją.

**Polecenie uruchamiania**: `npm run test`

**Wymaganie wstępne testu integracyjnego**: Ustaw `DATABASE_URL_TEST` w
`.env.test` (patrz `.env.test.example`). Zastosuj schemat raz:
`DATABASE_URL=<test-url> npx drizzle-kit push`.

**Anty-wzorzec**: Testowanie tylko happy-path (`validateTestSelection` ze znana
klasyfikacją) bez pokrycia cichego domyślnego przypadku
(`validateTestSelection('id', {})` zwraca `"unnecessary"` bez błędu — ochrona
polega na zabezpieczeniu `actions.ts:92` w wywołującym).

### 6.2 Dwuwarstwowa strategia testowania: integracyjna vs hermetyczna

Faza 2 ustanowiła dwuwarstwowy wzorzec. Wybierz warstwę pytając: _czy mock
skłamałby w tym, co testuję?_

#### Warstwa integracyjna (prawdziwy DB)

**Kiedy używać**: ryzyko dotyczy egzekwowania na poziomie DB — ograniczeń klucza
obcego, ograniczeń unikalności, prawdziwych filtrów SQL. Mock zwróci to, co mu
powiedziano; DB egzekwuje reguły, których mock nie może zasymulować.

**Przykład**: `getSessionById(sessionId, userId)` musi zwracać `null` dla
niezgodnego userId. To reguła klauzuli WHERE. Tylko prawdziwy DB udowadnia, że
klauzula faktycznie jest w zapytaniu.

**Wzorzec**:

```ts
const runIntegration = !!process.env.DATABASE_URL_TEST;

describe.skipIf(!runIntegration)('describe name', () => {
  beforeAll(async () => {
    // Insert in FK order: users → scenarios → sessionResults → sessionEvents
    await db
      .insert(users)
      .values({ id: 'fixture-user-a', email: 'a@test.local' });
    // ...
  });

  afterAll(async () => {
    // Delete in reverse FK order
    await db
      .delete(sessionResults)
      .where(eq(sessionResults.id, 'fixture-session'));
    // ...
  });

  it('returns null for cross-account access', async () => {
    expect(
      await getSessionById('fixture-session', 'fixture-user-b'),
    ).toBeNull();
  });
});
```

**Źródło wyroczni**: Ograniczenia schematu DB + Ryzyko #2 w §2 (izolacja userId
to reguła biznesowa, nie szczegół implementacyjny).

**Bramka CI**: testy integracyjne NIE są obowiązkową bramką CI (uruchamianie
lokalnego Supabase w CI jest kosztowne). Uruchamiaj lokalnie gdy
`DATABASE_URL_TEST` jest ustawiony. Oznacz jako ad-hoc w §4.

#### Warstwa hermetyczna (zaślepiony klient DB)

**Kiedy używać**: ryzyko to gałąź częściowej awarii, której prawdziwa
infrastruktura nie może niezawodnie wyzwolić — np. „Zapis 1 się powiódł, Zapis 2
się nie powiódł". Prawdziwy DB albo nie powiedzie się przy obu, albo powiedzie
się przy obu; hermetyczna zaślepka wymusza dokładny punkt awarii.

**Przykład**: `endSessionAction` — drugi zapis do DB (wstawianie wierszy
`session_event` dla pominiętych badań krytycznych) może nie powieść się po tym,
jak pierwszy zapis (aktualizacja `session_result`) już się zacommitował. Ten
stan jest nieosiągalny na zdrowym lokalnym DB.

**Wzorzec** — użyj `vi.spyOn` na obiekcie `db` wewnątrz `beforeEach`/`afterEach`
(nie `vi.mock` na poziomie pliku, co by zepsuło testy integracyjne w tym samym
pliku):

```ts
describe('endSessionAction — Write 2 partial failure (hermetic)', () => {
  // build a thenable chain that resolves to `value` when awaited
  function makeSelectChain(value: unknown[]): any {
    /* ... */
  }

  beforeEach(() => {
    vi.spyOn(db as any, 'select')
      .mockImplementationOnce(() => makeSelectChain([sessionRow])) // Select 1
      .mockImplementationOnce(() => makeSelectChain([])) // Select 2
      .mockImplementationOnce(() => makeSelectChain([classificationRow])); // Select 3

    vi.spyOn(db as any, 'update').mockImplementation(() => ({
      set: () => chain,
      where: () => chain,
      returning: vi.fn().mockResolvedValue([claimedRow]),
    }));

    vi.spyOn(db as any, 'insert').mockImplementation(() => ({
      values: vi.fn().mockRejectedValue(new Error('DB timeout')),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { error: "Internal error" } and logs when Write 2 fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await endSessionAction('test-session-id');
    expect(result).toEqual({ error: 'Internal error' });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[endSessionAction] DB error:'),
      expect.any(Error),
    );
  });
});
```

**Reguła głębokości mocka**: `endSessionAction` wywołuje `db.select()` trzy razy
przed nieudanym insertem. Użyj `mockImplementationOnce` w kolejności wywołań —
pierwsze `mockImplementationOnce` odpowiada na Select 1, drugie na Select 2 itd.
Płaski mock rzucający wyjątek przy każdym wywołaniu nie powiedzie się już przy
Select 1 i nigdy nie dotrze do gałęzi insertu.

**Źródło wyroczni**: Tryb awarii Ryzyka #3 w §2 — „Zapis DB nie powodzi się
cicho, brak błędu pokazanego studentowi". Kontrakt: wywołujący dostaje
`{ error: 'Internal error' }` ORAZ emitowany jest `console.error` z
`[endSessionAction] DB error:`. Obie asercje muszą być obecne.

**Testy hermetyczne działają we wszystkich środowiskach** — bez zabezpieczenia
`describe.skipIf`. Nie potrzebują połączenia z bazą danych.

### 6.3 Dodawanie testu middleware / granicy auth

**Lokalizacja**: `src/__tests__/e2e/auth-boundary.spec.ts`

**Wzorzec izolacji** — blok describe dla nieuwierzytelnionych musi wyczyścić
cookies i origins, żeby test nigdy nie odziedziczył sesji z `storageState`
projektu `chromium`:

```ts
test.describe('auth boundary — unauthenticated access is blocked', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  // tests here run without any session
});
```

**Wzorzec negatywnej asercji** — po nawigacji do chronionej trasy, poczekaj na
przekierowanie middleware i sprawdź, że: (a) link logowania w nawigacji jest
widoczny oraz (b) nagłówek dashboardu jest nieobecny:

```ts
await page.goto('/dashboard');
await page.waitForURL('/'); // middleware przekierowuje do root, NIE do /login

await expect(
  page
    .getByRole('navigation', { name: 'Nawigacja główna' })
    .getByRole('link', { name: 'Zaloguj się' }),
).toBeVisible();

await expect(
  page.getByRole('heading', { name: 'Panel studenta' }),
).not.toBeVisible();
```

**Reguła lokatorów**: używaj wyłącznie `getByRole` (lub zagnieżdżonego
`getByRole`). Te testy nie wypełniają formularzy, więc `getByLabel` nie jest
potrzebny.

**Anty-wzorce do uniknięcia**:

- `waitForTimeout` — czekaj na stan URL/widoczność, nigdy na czas
- Selektory CSS lub XPath — lokatory muszą przeżyć restrukturyzację DOM
- `waitForURL('/login')` — middleware przekierowuje do `"/"`, nie do `"/login"`;
  asercja `/login` cicho przeszłaby gdy Auth.js wraca do własnego przekierowania

### 6.4 Dodawanie testu E2E głównego przepływu sesji + logowania

Wzorce udowodnione w zmianie `testing-e2e-session-flow` (Faza 4).

**Lokalizacje plików spec**

- `src/__tests__/e2e/session-flow.spec.ts` — Ryzyko #7 (pełny flow
  diagnostyczny)
- `src/__tests__/e2e/login-form.spec.ts` — Ryzyko #8 (formularz logowania)

**Wzorzec testu nieuwierzytelnionego**

Użyj `test.use({ storageState: { cookies: [], origins: [] } })` wewnątrz
`test.describe()` aby nadpisać storageState projektu chromium. Wymagane gdy test
sam weryfikuje logowanie i nie może startować z aktywną sesją.

```typescript
test.describe('...', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('...', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adres email').fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel('Hasło').fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await page.waitForURL('/dashboard');
  });
});
```

**Wzorzec zlecenia badania (przycisk "Zleć")**

Scope do `getByLabel('Przeciągnij: {name}')` — aria-label z `DraggableTestCard`
— aby uniknąć pomyłki gdy lista ma wiele kart z przyciskiem "Zleć":

```typescript
const availableCard = page.getByLabel('Przeciągnij: EKG 12-odprowadzeniowe');
await availableCard.getByRole('button', { name: 'Zleć' }).click();
```

**Wzorzec asercji badge walidatora**

Scope przez aria-label `SortableTestCard` (`'Zmień kolejność: {name}'`).
`toBeVisible()` auto-czeka na async `selectTestAction` — bez `waitFor`:

```typescript
await expect(
  page
    .getByLabel('Zmień kolejność: EKG 12-odprowadzeniowe')
    .getByText('Poprawne'),
).toBeVisible();
```

Mapowanie wartości walidatora → tekst badge: `correct → "Poprawne"`,
`suboptimal → "Akceptowalne"`, `unnecessary → "Zbędne"`.

**Wzorzec asercji historii po nazwie scenariusza**

Scope do `listitem` filtrowanego po tytule scenariusza i wyniku, a następnie
`.first()` — zapobiega naruszeniu strict mode gdy wcześniejsze uruchomienia
testu zostawiły poprzednie wpisy:

```typescript
await expect(
  page
    .getByRole('listitem')
    .filter({ hasText: 'Ostry ból w klatce piersiowej' })
    .filter({ hasText: 'Pozytywny' })
    .first(),
).toBeVisible();
```

**Ładowanie kredentiali lokalnie**

`playwright.config.ts` ładuje `.env.local` przez dotenv. Zmienne
`TEST_USER_EMAIL` i `TEST_USER_PASSWORD` trzymaj w `.env.local` (gitignorowany).
W CI te same zmienne przychodzą z GitHub Secrets. Patrz lekcja w
`context/foundation/lessons.md`.

**Polecenie uruchamiania**

```bash
npx playwright test src/__tests__/e2e/session-flow.spec.ts  # Risk #7
npx playwright test src/__tests__/e2e/login-form.spec.ts    # Risk #8
npx playwright test src/__tests__/e2e/                      # wszystkie razem
```

**Antywzorce do uniknięcia**

- `waitForTimeout` — czekaj na stan: `toBeVisible()`, `waitForURL()`, nigdy na
  czas
- Selektory CSS lub XPath — lokatory muszą przeżyć restrukturyzację DOM; używaj
  `getByRole` / `getByLabel` / `getByText`
- `waitForURL('/dashboard/session/...')` ze statycznym UUID — URL sesji jest
  dynamiczny; używaj regex: `waitForURL(/\/dashboard\/session\//)`
- Pominięcie `test.use({ storageState: { cookies: [], origins: [] } })` w teście
  logowania — bez tego test startuje z aktywną sesją i pomija formularz

### 6.5 Dodawanie testu interakcji z komponentem (UI sesji / DnD)

**Lokalizacja**

- Testy: `src/modules/session/components/SessionView/SessionView.test.tsx`
- Testy logiki reorder:
  `src/modules/session/components/SessionView/SessionView.reorder.test.ts`

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

**Zarządzanie timerem** — `SessionView` ma `setInterval` na timerze sesji. Użyj
`toFake: ['setInterval', 'clearInterval']` — pełne `vi.useFakeTimers()` blokuje
też `setTimeout`, który Testing Library używa wewnętrznie w `waitFor`/`findBy*`:

```ts
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
```

**Wzorzec kliknięcia przycisku "Zleć"**

`DraggableTestCard` ma `aria-label="Przeciągnij: {name}"` na wrapperze. Scope
button przez `within()`. Przekaż `{ delay: null }` do `userEvent.setup()` —
domyślne opóźnienie userEvent blokuje się na sfałszowanych timerach:

```ts
const card = screen.getByLabelText('Przeciągnij: EKG 12-odprowadzeniowe');
await userEvent
  .setup({ delay: null })
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
import { applyReorder, type OrderedTest } from './SessionView.utils';

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
- `vi.useFakeTimers()` bez `toFake` — blokuje `waitFor` z Testing Library
- Symulacja pointer drag w jsdom — użyj `applyReorder` unit testu dla logiki
  reorder; dla pełnej walidacji DnD w przeglądarce — Playwright
- Asercja przez `validatorResult` prop na komponencie zamiast przez widoczny
  tekst badge — testowałoby implementację, nie zachowanie użytkownika

### 6.6 Dodawanie testu retencji / czyszczenia

DO UZUPEŁNIENIA — patrz §3 Faza 6 dla wzorca logiki granicy soft-delete (aktywuj
po wysłaniu S-05).

## 7. Czego celowo nie testujemy

Wykluczenia uzgodnione podczas wywiadów Fazy 2 i Fazy odświeżenia (Q5). Przyszli
współtwórcy powinni je respektować, chyba że zmieni się leżące u podstaw
założenie.

- **Warstwa animacji CSS** — zmiany stylizacji wizualnej nie mają trybu awarii
  istotnego dla poprawności produktu. Zrewiduj jeśli token CSS bezpośrednio
  kontroluje stan logiki biznesowej. (Źródło: wywiad Fazy 2, Q5.)
- **Dane seed w `seed.ts`** — zakodowane na stałe dane scenariuszy i
  klasyfikacji badań; skrypt generatora jest testem. Zrewiduj jeśli scenariusze
  staną się dynamiczne lub generowane przez użytkownika. (Źródło: wywiad Fazy 2,
  Q5.)
- **Czysto prezentacyjne komponenty frontend** — komponenty UI bez logiki
  biznesowej (układ, typografia, statyczny wyświetlacz). Zrewiduj jeśli
  komponent zacznie posiadać walidację lub renderowanie kontroli dostępu.
  (Źródło: wywiad Fazy 2, Q5.)
- **E2E strony ustawień konta (`/account/settings`)** — rzadko używana w MVP,
  mały promień rażenia; ochrona middleware jest weryfikowana przez Ryzyko #6.
  (Źródło: wywiad odświeżenia, Q5.)
- **E2E formularza rejestracji** — jednorazowy onboarding; awaria jest
  natychmiast widoczna dla użytkownika; poza zakresem aktualnego budżetu
  testowego. (Źródło: wywiad odświeżenia, Q5.)

## 8. Rejestr świeżości

- Strategia (§1–§5) ostatnio przeglądana: 2026-06-11
- Wersje stosu ostatnio zweryfikowane: 2026-06-11
- Referencje do narzędzi AI-natywnych ostatnio zweryfikowane: n/d — brak
  narzędzi AI-natywnych w bieżącym planie

Odśwież (`/10x-test-plan --refresh`) gdy:

- nowe ryzyko z top-3 pojawi się z roadmapy lub archiwum,
- data `checked:` rekomendowanego narzędzia jest starsza niż trzy miesiące,
- stos technologiczny projektu zmieni się (nowy framework, nowy runner testów),
- §7 przestrzeń negatywna nie odzwierciedla już przekonań zespołu.
