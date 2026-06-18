# Serwerowe egzekwowanie limitu czasu sesji — Krótki plan

> Pełny plan: `context/changes/check-timer/plan.md` Badania:
> `context/changes/check-timer/research.md`

## Co i dlaczego

Limit czasu sesji jest dziś egzekwowany wyłącznie po stronie klienta —
auto-finalizacja przy 0:00 działa tylko w otwartej karcie. Dodajemy serwerowe
egzekwowanie: wygasła sesja `in_progress` jest finalizowana po stronie serwera
przy każdym kontakcie i blokowana w akcjach. Zamyka to lukę „in_progress na
zawsze" i możliwość edycji testów po deadline.

## Punkt wyjścia

`SessionView` (klient) woła `endSessionAction` przy 0:00, ale tylko gdy karta
żyje; zamknięcie karty zostawia sesję `in_progress` na zawsze.
`selectTestAction` nie sprawdza czasu, a historia ukrywa `in_progress`. Deadline
(`started_at` + `time_limit_seconds`) jest już trwały w DB — serwer może go
egzekwować, ale tego nie robi.

## Pożądany stan końcowy

Sesja po przekroczeniu czasu jest domykana serwerowo niezależnie od przeglądarki
— najpóźniej przy następnym odczycie (loader sesji lub historia). Po deadline
nie da się dodać testu. Wynik liczony z dotychczas wybranych testów (pominięty
krytyczny → Negatywny), spójnie z ręcznym zakończeniem. Finalizacja idempotentna
i odporna na wyścigi.

## Kluczowe podjęte decyzje

| Decyzja                    | Wybór                             | Dlaczego (1 zdanie)                                                       | Źródło |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------- | ------ |
| Mechanizm domykania        | Lazy przy odczycie + guard        | Zero infrastruktury; deadline egzekwowany serwerowo przy każdym kontakcie | Plan   |
| Wynik przy timeoucie       | Oceniaj po wybranych testach      | Spójne z istniejącym validatorem, bez nowej reguły kary za czas           | Plan   |
| Guard w `selectTestAction` | Tak — serwer odrzuca po deadline  | Zamyka exploit „wejdź w wygasłą sesję i klikaj dalej"                     | Plan   |
| Punkty lazy-finalize       | Loader sesji + zapytania historii | Każda ścieżka dotykająca wygasłej sesji ją domyka — spójne dane           | Plan   |
| Bufor na dryf zegara       | Mały (np. 3 s), tylko serwerowo   | Unika fałszywego odrzucenia kliknięcia tuż przed 0:00                     | Plan   |
| Zakres testów              | Unit (logika czasu) + E2E timeout | Pokrywa rdzeń logiki i realny przepływ 0:00 w przeglądarce                | Plan   |

## Zakres

**W zakresie:** czysta funkcja `isSessionExpired` + bufor; wydzielenie rdzenia
`finalizeSession`; guard czasu w `selectTestAction`; lazy-finalize w loaderze
sesji i zapytaniach historii; testy jednostkowe + E2E timeout (+ krótki
scenariusz w `seed-test.ts`).

**Poza zakresem:** cron/pg_cron/DB triggery; twarda reguła „czas minął =
porażka"; zmiany schematu DB; re-synchronizacja zegara klienta; zmiany UX timera
poza obsługą błędu „czas minął".

## Architektura / Podejście

Jeden server-only rdzeń `finalizeSession` (wydzielony z `endSessionAction`,
zachowuje atomowy claim `WHERE outcome='in_progress'` → idempotencja). Czysta
`isSessionExpired(startedAt, timeLimitSeconds, now?, grace?)` decyduje o
wygaśnięciu. `endSessionAction` finalizuje bezwarunkowo; `selectTestAction` +
loader sesji + `getUserSessions`/`getSessionDetails` finalizują tylko gdy
`in_progress` i po deadline.

## Fazy w skrócie

| Faza                            | Co dostarcza                                                                      | Kluczowe ryzyko                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Logika + rdzeń               | `isSessionExpired` + wydzielony `finalizeSession`, delegacja w `endSessionAction` | Regresja w finalizacji przy wydzielaniu (utrata claim/idempotencji)                      |
| 2. Egzekwowanie + lazy-finalize | Guard w `selectTestAction`; finalize w loaderze i historii                        | Wyścig/duplikacja `critical_miss`; kolejność finalizacji vs. pobranie zdarzeń w loaderze |
| 3. Testy                        | Unit brzegowe + krótki scenariusz seed + E2E timeout                              | Flaky E2E przy oczekiwaniu na 0:00                                                       |

**Wymagania wstępne:** brak (kod i baza gotowe; E2E wymaga `seed` + `seed:test`
na bazie testowej). **Szacowany nakład pracy:** ~2–3 sesje w 3 fazach.

## Otwarte ryzyka i założenia

- Porzucona sesja, w którą nikt nigdy nie wejdzie ponownie i która nie pojawi
  się na liście historii, pozostanie `in_progress` (akceptowane — świadoma
  rezygnacja z crona).
- Dryf zegara w długo uśpionej karcie — serwer pozostaje autorytetem przy
  odczycie; bufor łagodzi przypadki brzegowe.
- E2E zależy od krótkiego scenariusza w `seed-test.ts` obecnego na bazie
  testowej.

## Kryteria sukcesu (podsumowanie)

- Sesja po 0:00 domyka się sama (otwarta karta) i po ponownym wejściu (zamknięta
  karta), z wynikiem z wybranych testów.
- Po deadline nie można dodać testu; porzucona wygasła sesja trafia do historii
  jako „Negatywny".
- `typecheck`, `lint`, `npm test` i E2E timeout zielone.
