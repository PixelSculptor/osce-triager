# Serwerowe egzekwowanie limitu czasu sesji — Plan implementacji

## Przegląd

Dziś auto-finalizacja sesji przy 0:00 jest czysto kliencka: działa tylko w
otwartej karcie, a porzucona/wygasła sesja zostaje `outcome = 'in_progress'` na
zawsze i pozostaje edytowalna po deadline. Ten plan dodaje **serwerowe
egzekwowanie limitu czasu**: wygasła sesja `in_progress` jest finalizowana po
stronie serwera przy każdym kontakcie (ładowanie sesji, listowanie/odczyt
historii) oraz blokowana w akcjach (`selectTestAction`). Wynik liczony jest z
dotychczas wybranych testów — tak samo jak ręczne zakończenie — bez nowej reguły
kary za czas.

## Analiza stanu obecnego

- **Auto-finalizacja istnieje tylko po stronie klienta**:
  `SessionView.tsx:107-120` — `setInterval` dekrementuje `remainingSeconds`, a
  efekt przy `remainingSeconds === 0` woła `handleEndSession()` →
  `endSessionAction`. Zamknięcie karty / utrata sieci → finalizacja nigdy nie
  nastąpi.
- **Brak serwerowego egzekwowania deadline'u**: `selectTestAction`
  (`actions.ts:75-76`) blokuje tylko gdy `outcome !== 'in_progress'`; nie
  sprawdza czasu. Po ponownym wejściu w wygasłą sesję (timer pokazuje 00:00
  dzięki klamrowaniu w `SessionView.tsx:73-78`) testy są nadal wybieralne.
- **„in_progress na zawsze"**: `getUserSessions`/`getSessionDetails`
  (`queries.ts:88-89,125`) filtrują `ne(outcome,'in_progress')`, więc porzucone
  sesje nigdy nie pojawiają się w historii; `deleteSessionAction`
  (`actions.ts:235-236`) odmawia ich usunięcia.
- **Deadline jest trwały**: `session_result.started_at` (`schema.ts:116`,
  defaultNow) + `scenario.time_limit_seconds` (`schema.ts:73`) — serwer ma
  wszystko, by policzyć upływ czasu.
- **Rdzeń finalizacji jest wbudowany w `endSessionAction`**
  (`actions.ts:142-219`): zbiera zdarzenia, woła `evaluateSessionEnd`
  (`validator.ts:40-49`), wykonuje **atomowy claim**
  `UPDATE … WHERE outcome = 'in_progress'` (`actions.ts:166-179`) i dopisuje
  zdarzenia `critical_miss`. Ta logika jest niewspółdzielona — żeby użyć jej
  przy odczycie, trzeba ją wydzielić.

## Pożądany stan końcowy

- Sesja, której czas minął, jest finalizowana serwerowo niezależnie od stanu
  karty przeglądarki — najpóźniej przy następnym odczycie (loader sesji lub
  historia).
- Po deadline nie da się dodać testu: `selectTestAction` odrzuca wybór i
  finalizuje sesję.
- Wynik wygasłej sesji liczony jest z wybranych testów (pominięty krytyczny →
  `negative`/`isFailed`), spójnie z `endSessionAction`.
- Finalizacja jest **idempotentna i odporna na wyścigi**: równoległe ścieżki
  (klient `endSession`, lazy-finalize w loaderze, finalize w historii) nie mogą
  zduplikować finalizacji ani zdarzeń `critical_miss`.
- Weryfikacja: `npm run typecheck`, `npm run lint`, `npm test` zielone; E2E
  timeout pokazuje auto-finalizację i wpis w historii jako „Negatywny".

### Kluczowe odkrycia:

- Atomowy claim `WHERE outcome = 'in_progress'` (`actions.ts:166-179`) jest
  istniejącym mechanizmem idempotencji — wydzielony rdzeń MUSI go zachować.
- `validator.ts` jest `server-only`, ale jego czyste funkcje są testowane
  jednostkowo (`validator.test.ts`) — `isSessionExpired` należy tam, by
  korzystać z tego samego wzorca.
- `page.tsx:23-31` ładuje `getSessionEvents` PO `getSessionById`; jeśli
  finalizacja nastąpi między nimi, pobrane `events` będą już zawierać
  `critical_miss`, a `SessionView` (`SessionView.tsx:79-86`) sam zasieje
  `skippedCritical` z `initialEvents`. Wystarczy przekazać zaktualizowany
  `outcome`.
- E2E nie może czekać 300 s (scenariusze z `seed.ts`); potrzebny krótki
  scenariusz testowy w `seed-test.ts`.
- Wzorzec dostępu do DB: **per-request `getDb()`** (lekcja prod-DB) — każdy
  helper woła `getDb()` sam, bez singletona.

## Czego NIE robimy

- **Brak crona / zadania harmonogramu / pg_cron / DB triggera** — porzucona
  sesja domyka się przy następnym odczycie, nie proaktywnie.
- **Brak twardej reguły „czas minął = porażka"** — wynik nadal z wybranych
  testów.
- **Brak zmian schematu DB** — `started_at` + `time_limit_seconds` wystarczają.
- **Brak re-synchronizacji zegara klienta** (np. na `visibilitychange`) — dryf
  uśpionej karty pozostaje znanym ograniczeniem; serwer jest autorytetem przy
  odczycie.
- **Brak zmian UX timera** poza obsługą nowego błędu „czas minął" zwracanego
  przez `selectTestAction`.

## Podejście do implementacji

Jeden wspólny, server-only rdzeń finalizacji wywoływany ze wszystkich ścieżek.
Czysta funkcja `isSessionExpired` decyduje o wygaśnięciu (z małym buforem na
dryf zegara). `endSessionAction` (ręczny/kliencki koniec) finalizuje
bezwarunkowo; ścieżki odczytu i `selectTestAction` finalizują tylko gdy
`in_progress` **i** po deadline. Atomowy claim gwarantuje idempotencję między
wszystkimi wywołującymi.

## Krytyczne szczegóły implementacji

- **Idempotencja / wyścig**: wydzielony `finalizeSession` MUSI zachować claim
  `UPDATE … WHERE id = ? AND outcome = 'in_progress' … RETURNING` oraz dopisywać
  `critical_miss` **tylko gdy** claim coś zwrócił (`actions.ts:181-213`).
  Inaczej lazy-finalize z loadera i równoległy kliencki `endSession` zdublują
  zdarzenia.
- **Czas i cykl życia**: klient auto-strzela dokładnie przy 0:00 (bez bufora).
  Serwerowy guard używa `EXPIRY_GRACE_SECONDS` (mały bufor, np. 3 s), żeby nie
  odrzucić legalnego kliknięcia tuż przed deadline, które klient jeszcze
  dopuścił (skew zegara/opóźnienie sieci). Bufor dotyczy WYŁĄCZNIE ścieżki
  serwerowej.
- **Sekwencjonowanie w loaderze**: w `page.tsx` finalizuj PO `getSessionById` a
  PRZED pobraniem `getSessionEvents`, by zdarzenia `critical_miss` znalazły się
  w `initialEvents`; przekaż efektywny `outcome` do `SessionView`.

---

## Faza 1: Logika wygasania + wspólny rdzeń finalizacji

### Przegląd

Dodaj czystą funkcję wykrywania wygaśnięcia i wydziel rdzeń finalizacji z
`endSessionAction` do współdzielonego modułu server-only — bez zmiany
obserwowalnego zachowania.

### Wymagane zmiany:

#### 1. Czysta logika wygasania

**Plik**: `src/shared/lib/validator.ts`

**Cel**: Udostępnić deterministyczną funkcję decydującą, czy sesja przekroczyła
limit czasu, oraz stałą bufora — testowalną jednostkowo jak
`evaluateSessionEnd`.

**Kontrakt**: Eksport `EXPIRY_GRACE_SECONDS: number` (np. 3) oraz
`isSessionExpired(startedAt: Date, timeLimitSeconds: number, now?: Date, graceSeconds?: number): boolean`
zwracający `true`, gdy upłynięty czas `> timeLimitSeconds + graceSeconds`. `now`
domyślnie `new Date()`; w testach przekazywany jawnie dla determinizmu. Domyślny
`graceSeconds = EXPIRY_GRACE_SECONDS`.

#### 2. Wspólny rdzeń finalizacji

**Plik**: `src/modules/session/finalize.ts` (nowy, `import 'server-only'`)

**Cel**: Przenieść logikę finalizacji sesji (zbieranie zdarzeń → ocena → atomowy
claim → dopis `critical_miss` → zwrot wyniku) z `endSessionAction` do
reużywalnej funkcji, by mogły jej używać ścieżki odczytu i `selectTestAction`.

**Kontrakt**:
`finalizeSession(sessionRow: typeof sessionResults.$inferSelect): Promise<EndSessionResult>`
— odwzorowuje obecne `actions.ts:135-219`: jeśli `outcome !== 'in_progress'`,
zwraca bieżący stan (z `skippedCritical` z istniejących zdarzeń
`critical_miss`); w przeciwnym razie wykonuje atomowy claim i zwraca
`{ outcome, isFailed, skippedCritical }`. Woła `getDb()` wewnętrznie
(per-request). NIE wykonuje auth/ownership — to robi wywołujący. Zachowuje claim
`WHERE outcome = 'in_progress'` i warunkowy dopis `critical_miss`.

#### 3. Delegacja w `endSessionAction`

**Plik**: `src/modules/session/actions.ts`

**Cel**: `endSessionAction` zachowuje auth + ownership, a finalizację deleguje
do `finalizeSession`, eliminując duplikat logiki.

**Kontrakt**: Po sprawdzeniu
`auth()`/`Unauthorized`/`Forbidden`/`Session not found`, `endSessionAction` woła
`finalizeSession(sessionRow)` i zwraca jego wynik. Sygnatura i kształt zwracany
(`EndSessionResult`) bez zmian — `SessionView.handleEndSession`
(`SessionView.tsx:127`) działa bez modyfikacji.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów przechodzi: `npm run typecheck`
- Linting przechodzi: `npm run lint`
- Testy jednostkowe `isSessionExpired` przechodzą: `npm test`
- Istniejące testy `actions.test.ts` (w tym hermetyczny test `endSessionAction`)
  nadal zielone: `npm test`

#### Weryfikacja ręczna:

- Ręczne zakończenie sesji („Zakończ sesję") nadal pokazuje ekran wyników z
  poprawnym wynikiem (brak regresji).

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
automatycznych weryfikacji, zatrzymaj się tu po ręczne potwierdzenie człowieka,
zanim przejdziesz do Fazy 2.

---

## Faza 2: Serwerowe egzekwowanie + lazy-finalize przy odczycie

### Przegląd

Podłącz wykrywanie wygaśnięcia i wspólny rdzeń finalizacji do akcji oraz
wszystkich ścieżek odczytu, tak by wygasłe sesje były egzekwowane i domykane
serwerowo.

### Wymagane zmiany:

#### 1. Guard czasu w `selectTestAction`

**Plik**: `src/modules/session/actions.ts`

**Cel**: Odrzucić wybór testu wykonany po deadline i jednocześnie domknąć
wygasłą sesję, zamykając exploit „wejdź w wygasłą sesję i dalej klikaj".

**Kontrakt**: Po pobraniu `sessionRow` (i potwierdzeniu
`outcome === 'in_progress'`), pobierz `scenario.timeLimitSeconds`
(`getScenarioById(sessionRow.scenarioId)` — już dostępne w `queries.ts`). Jeśli
`isSessionExpired(sessionRow.startedAt, timeLimitSeconds)` → wywołaj
`finalizeSession(sessionRow)` i zwróć `{ error: 'Session time expired' }`. W
przeciwnym razie kontynuuj jak dotąd. `SelectTestResult` zyskuje nowy wariant
błędu (string), zgodny z istniejącą obsługą `selectError` w `SessionView`.

#### 2. Lazy-finalize w loaderze sesji

**Plik**: `src/app/dashboard/session/[sessionId]/page.tsx`

**Cel**: Wejście na stronę wygasłej, wciąż `in_progress` sesji finalizuje ją
serwerowo i od razu pokazuje ekran wyników.

**Kontrakt**: Po `getSessionById`, pobierz scenariusz, a jeśli
`outcome === 'in_progress'` i `isSessionExpired(...)` →
`finalizeSession(sessionRow)`; użyj zwróconego `outcome` jako `sessionOutcome`
przekazywanego do `SessionView`. Finalizacja przed `getSessionEvents`, by
`initialEvents` zawierały `critical_miss`. Świeża sesja (nie wygasła) — bez
zmian.

#### 3. Lazy-finalize w zapytaniach historii

**Plik**: `src/modules/session/queries.ts`

**Cel**: Wygasłe porzucone sesje pojawiają się w historii (jako zakończone),
zamiast być na stałe ukryte przez filtr `ne(outcome,'in_progress')`.

**Kontrakt**:

- `getUserSessions(userId)`: przed głównym selectem znajdź `in_progress` sesje
  użytkownika z `time_limit_seconds` (join `scenarios`), odfiltruj wygasłe przez
  `isSessionExpired`, wywołaj `finalizeSession` dla każdej, a następnie uruchom
  istniejące zapytanie listujące.
- `getSessionDetails(sessionId, userId)`: jeśli sesja istnieje, jest
  `in_progress` i wygasła → `finalizeSession`, potem istniejące zapytanie (filtr
  `ne in_progress` zwróci już domkniętą sesję). Import `finalizeSession` z
  `./finalize` (bez cyklu — `finalize.ts` nie importuje `queries.ts`).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów przechodzi: `npm run typecheck`
- Linting przechodzi: `npm run lint`
- Testy przechodzą: `npm test`

#### Weryfikacja ręczna:

- Rozpocznij sesję, odczekaj do 0:00 przy otwartej karcie → ekran wyników
  pojawia się automatycznie.
- Rozpocznij sesję, zamknij kartę przed 0:00, odczekaj > limit, wejdź ponownie
  na URL sesji → strona pokazuje wynik (sesja domknięta), testy niewybieralne.
- Po wygaśnięciu próba dodania testu (np. przez ponowne wejście tuż po deadline)
  skutkuje komunikatem błędu, nie zapisem.
- Porzucona, wygasła sesja pojawia się na liście historii jako „Negatywny" (gdy
  pominięto krytyczne).

**Uwaga implementacyjna**: Po przejściu automatycznych weryfikacji zatrzymaj się
po ręczne potwierdzenie człowieka przed Fazą 3.

---

## Faza 3: Testy (jednostkowe brzegowe + E2E timeout)

### Przegląd

Pokryj rdzeń logiki czasu przypadkami brzegowymi oraz dodaj deterministyczny
scenariusz E2E auto-finalizacji przy 0:00.

### Wymagane zmiany:

#### 1. Jednostkowe przypadki brzegowe `isSessionExpired`

**Plik**: `src/shared/lib/validator.test.ts`

**Cel**: Zabezpieczyć granice decyzji o wygaśnięciu (w granicy bufora vs. po
buforze, dokładnie limit).

**Kontrakt**: Przypadki: elapsed < limit → `false`; elapsed w
`(limit, limit + grace]` → `false` (bufor); elapsed > limit + grace → `true`.
`now` i `graceSeconds` przekazywane jawnie dla determinizmu.

#### 2. Krótki scenariusz testowy dla E2E

**Plik**: `src/shared/lib/seed-test.ts`

**Cel**: Dostarczyć scenariusz o małym `timeLimitSeconds`, by E2E mógł doczekać
0:00 w kilka sekund (zamiast 300 s), bez zaśmiecania produkcyjnego `seed.ts`.

**Kontrakt**: Upsert (`onConflictDoNothing`) scenariusza z deterministycznym
`id`, krótkim `timeLimitSeconds` (np. 5) i czytelnym `title` (np. „Test timeout
— krótki limit"), plus co najmniej jedna klasyfikacja `critical` wskazująca
istniejący `diagnosticTest` z `seed.ts` (np. `dt-001`). Uruchamiane przez
`npm run seed:test` po `seed`.

#### 3. E2E auto-finalizacji przy 0:00

**Plik**: `src/__tests__/e2e/session-timeout.spec.ts` (nowy)

**Cel**: Zweryfikować pełny przepływ: start sesji krótkiego scenariusza → upływ
czasu → automatyczne przejście na ekran wyników → wpis w historii jako
„Negatywny".

**Kontrakt**: Wzorzec jak `session-flow.spec.ts` (storageState, lokatory
`getByRole`/`getByLabel`/`getByText`, `waitForURL`). Start krótkiego
scenariusza, **czekaj na stan** „Sesja zakończona" / „Negatywny” (`toBeVisible`
z odpowiednim timeoutem) — bez `page.waitForTimeout()`. Następnie
`/dashboard/history` i asercja wpisu „Negatywny" dla tego scenariusza (scoping
do `listitem`). Brak własnego cleanupu (zgodnie z konwencją repo).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów przechodzi: `npm run typecheck`
- Linting przechodzi: `npm run lint`
- Testy jednostkowe (z nowymi przypadkami brzegowymi) przechodzą: `npm test`
- E2E timeout przechodzi: `npm run test:e2e` (po `npm run seed` +
  `npm run seed:test` na bazie testowej)

#### Weryfikacja ręczna:

- Uruchom `npm run test:e2e:ui` i obejrzyj przebieg `session-timeout` —
  przejście na ekran wyników następuje bez interakcji użytkownika.

**Uwaga implementacyjna**: Po przejściu automatycznych weryfikacji potwierdź
ręcznie stabilność E2E (brak flaky przy oczekiwaniu na 0:00).

---

## Strategia testowania

### Testy jednostkowe:

- `isSessionExpired`: przed limitem, w granicy bufora, po buforze, dokładnie
  limit.
- Zachowanie `finalizeSession` pokryte pośrednio przez istniejący hermetyczny
  test `endSessionAction` (delegacja) — potwierdzić, że nadal przechodzi.

### Testy integracyjne (opcjonalne, za `DATABASE_URL_TEST`, wzorzec z `actions.test.ts`):

- `selectTestAction` na wygasłej sesji zwraca
  `{ error: 'Session time expired' }` i sesja zostaje domknięta.
- Lazy-finalize: porzucona, wygasła sesja po wywołaniu `getUserSessions` ma
  `outcome` terminalny.

### Kroki testowania ręcznego:

1. Sesja → odczekaj do 0:00 (karta otwarta) → ekran wyników automatycznie.
2. Sesja → zamknij kartę → odczekaj > limit → wejdź ponownie → wynik widoczny,
   testy niewybieralne.
3. Po deadline próba dodania testu → komunikat błędu, brak zapisu.
4. Porzucona wygasła sesja widoczna w historii jako „Negatywny".

## Uwagi dotyczące wydajności

`getUserSessions` dodaje jedno zapytanie o `in_progress` sesje użytkownika (+
join scenariusza) i sekwencyjne finalizacje wygasłych przy ładowaniu historii.
Liczba aktywnych/porzuconych sesji per użytkownik jest mała (MVP) —
akceptowalne. W razie potrzeby finalizacje można zrównoleglić.

## Uwagi dotyczące migracji

Brak migracji DB. Istniejące porzucone sesje `in_progress` zostaną domknięte
„leniwie" przy pierwszym odczycie (loader/historia) po wdrożeniu.

## Referencje

- Powiązane badania: `context/changes/check-timer/research.md`
- Rdzeń finalizacji do wydzielenia: `src/modules/session/actions.ts:135-219`
- Atomowy claim (idempotencja): `src/modules/session/actions.ts:166-179`
- Reguła oceny: `src/shared/lib/validator.ts:40-49`
- Klient (auto-strzał przy 0:00):
  `src/modules/session/components/SessionView/SessionView.tsx:107-120`
- Wzorzec E2E: `src/__tests__/e2e/session-flow.spec.ts`
- Wzorzec testu akcji: `src/modules/session/actions.test.ts`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz
> `references/progress-format.md`.

### Faza 1: Logika wygasania + wspólny rdzeń finalizacji

#### Automatyczne

- [x] 1.1 Sprawdzanie typów przechodzi: `npm run typecheck`
- [x] 1.2 Linting przechodzi: `npm run lint`
- [x] 1.3 Testy jednostkowe `isSessionExpired` przechodzą: `npm test`
- [x] 1.4 Istniejące testy `actions.test.ts` nadal zielone: `npm test`

#### Ręczne

- [x] 1.5 Ręczne zakończenie sesji pokazuje ekran wyników z poprawnym wynikiem
      (brak regresji)

### Faza 2: Serwerowe egzekwowanie + lazy-finalize przy odczycie

#### Automatyczne

- [x] 2.1 Sprawdzanie typów przechodzi: `npm run typecheck`
- [x] 2.2 Linting przechodzi: `npm run lint`
- [x] 2.3 Testy przechodzą: `npm test`

#### Ręczne

- [x] 2.4 Sesja przy 0:00 (karta otwarta) automatycznie pokazuje ekran wyników
- [x] 2.5 Ponowne wejście w wygasłą sesję pokazuje wynik; testy niewybieralne
- [x] 2.6 Próba dodania testu po deadline → komunikat błędu, brak zapisu
- [x] 2.7 Porzucona wygasła sesja widoczna w historii jako „Negatywny"

### Faza 3: Testy (jednostkowe brzegowe + E2E timeout)

#### Automatyczne

- [x] 3.1 Sprawdzanie typów przechodzi: `npm run typecheck`
- [x] 3.2 Linting przechodzi: `npm run lint`
- [x] 3.3 Testy jednostkowe (z przypadkami brzegowymi) przechodzą: `npm test`
- [x] 3.4 E2E timeout przechodzi: `npm run test:e2e`

#### Ręczne

- [ ] 3.5 `npm run test:e2e:ui` — przebieg `session-timeout` przechodzi bez
      interakcji, stabilnie
