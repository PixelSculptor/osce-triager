---
date: 2026-06-18T08:11:00+0200
researcher: Kacper Nadstoga
git_commit: 82df69e1ff77e87c770708b2f9f9800b970d22d3
branch: check-timer
repository: osce-traiger
topic:
  'Czy po upływie czasu (timer 0:00) system samoistnie zatwierdza sesję jako
  ukończoną z wynikiem negatywnym?'
tags: [research, codebase, session, timer, scoring, server-action]
status: complete
last_updated: 2026-06-18
last_updated_by: Kacper Nadstoga
---

# Research: Auto-finalizacja sesji po wygaśnięciu timera (0:00)

**Date**: 2026-06-18T08:11:00+0200 **Researcher**: Kacper Nadstoga **Git
Commit**: 82df69e1ff77e87c770708b2f9f9800b970d22d3 **Branch**: check-timer
**Repository**: osce-traiger

## Research Question

Gdy użytkownik rozpoczyna nową sesję i leci mu czas — gdy nie zdąży ukończyć
triage'u w czasie i timer wskaże 0:00 — czy system potrafi samoistnie
zatwierdzić taką sesję jako ukończoną z wynikiem negatywnym?

## Summary

**Częściowo TAK — z dwoma istotnymi zastrzeżeniami.**

1. **Tak, istnieje auto-finalizacja przy 0:00**, ale jest ona **wyłącznie po
   stronie klienta**. Gdy timer dojdzie do 0 w otwartej karcie, React
   `useEffect` automatycznie wywołuje tę samą akcję serwerową
   (`endSessionAction`), co przycisk „Zakończ sesję". Sesja zostaje zapisana w
   DB z `completedAt` i terminalnym `outcome`.

2. **Wynik NIE jest automatycznie „negatywny" tylko z powodu upływu czasu.**
   Sesja jest oceniana na podstawie testów wybranych do tej pory. Jeśli
   pominięto którykolwiek test krytyczny → `outcome = 'negative'`,
   `isFailed = true`. Jeśli nie pominięto żadnego krytycznego (lub scenariusz
   ich nie ma) → wynik może być `positive`. W praktyce, gdy użytkownik „nie
   zdążył", zwykle będzie miał pominięte testy krytyczne, więc wynik wyjdzie
   negatywny — ale to konsekwencja oceny, a **nie** twardej reguły „czas minął =
   porażka".

3. **Brak jakiegokolwiek zabezpieczenia po stronie serwera.** Auto-finalizacja
   zależy całkowicie od żywej karty przeglądarki. Jeśli użytkownik zamknie kartę
   / straci sieć / karta zostanie uśpiona, sesja **zostaje `in_progress` w
   nieskończoność**. Co więcej, `selectTestAction` nie sprawdza czasu, więc po
   ponownym wejściu w taką sesję (timer pokaże 00:00, bo jest klamrowany do
   zera) testy nadal są edytowalne i można ją zakończyć bez kary czasowej.

**Krótka odpowiedź:** dla otwartej karty — tak, sesja sama się domyka
(najczęściej negatywnie). Jako gwarancja systemowa — nie; nie ma serwerowego
egzekwowania deadline'u.

## Detailed Findings

### Timer — implementacja (klient)

Cały timer żyje w jednym komponencie klienckim `SessionView.tsx`; brak
dedykowanego hooka.

- Seed wartości startowej jest **kotwiczony serwerowo** — liczony z `startedAt`
  (z DB) + `timeLimitSeconds` (ze scenariusza), więc odświeżenie nie resetuje
  zegara:
  ```ts
  // SessionView.tsx:73-78
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const elapsed = Math.floor(
      (Date.now() - new Date(startedAt).getTime()) / 1000,
    );
    return Math.max(0, timeLimitSeconds - elapsed);
  });
  ```
- Odliczanie tyka po stronie klienta `setInterval(…, 1000)`, bramkowane stanem
  `in_progress` (`SessionView.tsx:107-113`). Po starcie dekrementuje lokalnie —
  **nie** re-synchronizuje się z `startedAt` na każdym ticku, więc
  uśpiona/throttlowana karta może dryfować.
- Propsy `timeLimitSeconds` i `startedAt` przychodzą z serwerowej strony
  `page.tsx:46-56`.

### Co dzieje się przy 0:00 (auto-finalizacja kliencka)

Istnieje efekt typu `onExpire`. Gdy `remainingSeconds === 0` i sesja wciąż
`in_progress`, wywoływany jest `handleEndSession()`:

```ts
// SessionView.tsx:115-120
useEffect(() => {
  if (remainingSeconds === 0 && sessionState === 'in_progress') {
    handleEndSession();
  }
}, [remainingSeconds]);
```

To **ta sama** funkcja, którą wywołuje przycisk „Zakończ sesję"
(`SessionView.tsx:243`), zabezpieczona przed podwójnym wywołaniem przez
`endingRef` (`SessionView.tsx:122-139`). Po sukcesie ustawia `sessionState` na
`'positive' | 'negative'`, co (a) zatrzymuje interval i (b) przełącza widok na
ekran wyników. Wejścia są wyłączone — `handleSelectTest`/`handleDragEnd` robią
early-return, gdy stan ≠ `in_progress` (`SessionView.tsx:142, 175`).

### Finalizacja i ocena (serwer)

`handleEndSession` → akcja serwerowa `endSessionAction` (`actions.ts:119-224`):

- Auth + sprawdzenie własności (`actions.ts:122-134`).
- Short-circuit, jeśli `outcome !== 'in_progress'` (`actions.ts:135-140`).
- Ocena: `evaluateSessionEnd(orderedTestIds, classifications)` →
  `irreversibleFail` + `skippedCritical` (`actions.ts:161-164`).
- **Atomowe „zaklepanie"** sesji warunkowym UPDATE-em bramkowanym
  `WHERE outcome = 'in_progress'` (`actions.ts:166-179`), co zapisuje `outcome`
  (`negative`/`positive`), `isFailed`, `completedAt = new Date()`. Race-guard:
  wywołanie z timera i ręczny klik nie zduplikują finalizacji.
- Zapis zdarzeń `critical_miss` dla pominiętych testów krytycznych
  (`actions.ts:205-213`).

### Model danych i znaczenie „wyniku negatywnego"

`session_result` (`schema.ts:101-118`) — to jest domenowa „sesja treningowa"
(uwaga: tabela `session`/`sessions` to osobna sesja NextAuth, niezwiązana).

- Brak osobnej kolumny `status` — stan niesie `outcome`
  `$type<"in_progress" | "positive" | "negative">`, NOT NULL, default
  `'in_progress'` (`schema.ts:111-114`).
- `isFailed` boolean, default `false` (`schema.ts:115`).
- `completedAt` timestamp **nullable** — ustawiany tylko przy zakończeniu.
- Brak wyniku liczbowego. **NEGATYWNY/FAILED = `outcome = 'negative'` ORAZ
  `isFailed = true`.**

Reguła oceny (`validator.ts`):

- `evaluateSessionEnd` (`validator.ts:40-49`): `irreversibleFail = true`, jeśli
  którykolwiek test sklasyfikowany jako `'critical'` nie został wybrany
  (`skippedCritical.length > 0`). Czyli porażka = pominięcie testu krytycznego.
- `outcome = irreversibleFail ? 'negative' : 'positive'`,
  `isFailed = irreversibleFail` (`actions.ts:169-170`).

**Pusta odpowiedź jest dozwolona:** `endSessionAction` nie wymaga żadnych
`session_event`. Przy zero wybranych testach `orderedTestIds = []`, więc każdy
test krytyczny liczy się jako pominięty → `negative`/`isFailed = true` (lub
`positive`, gdy scenariusz nie ma testów krytycznych). „Odpowiedzią" jest
wyłącznie zbiór wybranych testów diagnostycznych — nie ma pola na diagnozę
tekstową.

### Brak egzekwowania po stronie serwera (luka)

- **Brak crona/zadań harmonogramu dla sesji.** Jedyny cron to
  `.github/workflows/cleanup.yml` (`0 2 * * *`) →
  `scripts/cleanup-expired-accounts.mjs`, który usuwa tylko konta z
  `deletion_requested_at` starszym niż 30 dni; nie dotyka `session_result`.
- **Brak funkcji edge/Supabase.** `supabase/config.toml:370` wprost zaznacza „no
  supabase/functions in this project"; katalog nie istnieje.
- **Brak triggerów/funkcji DB/pg_cron.** Migracje `0000–0002` zawierają tylko
  `CREATE/ALTER TABLE` i FK.
- **Brak czasowego guardu w akcjach.** `endSessionAction`, `selectTestAction` i
  loader strony nie porównują czasu z `timeLimitSeconds`. `selectTestAction`
  (`actions.ts:75-76`) blokuje tylko gdy `outcome !== 'in_progress'` — nie
  odrzuca wyboru po deadline.
- **Deadline JEST trwały** (`started_at` defaultNow +
  `scenario.time_limit_seconds`), więc serwer _mógłby_ egzekwować — ale nic tego
  nie robi.

**Konsekwencja:** porzucona, wygasła sesja zostaje `in_progress` na zawsze; po
ponownym otwarciu timer pokazuje 00:00 (klamrowanie do zera), lecz testy są
nadal wybieralne i można zakończyć bez kary — auto-finalizacja działa tylko w
stale otwartej karcie.

## Code References

- `src/modules/session/components/SessionView/SessionView.tsx:73-78` — seed
  `remainingSeconds` z `startedAt` + `timeLimitSeconds` (kotwica serwerowa)
- `src/modules/session/components/SessionView/SessionView.tsx:107-113` —
  `setInterval` odliczający co 1 s, bramkowany `in_progress`
- `src/modules/session/components/SessionView/SessionView.tsx:115-120` — efekt
  `onExpire`: przy `remainingSeconds === 0` woła `handleEndSession()`
- `src/modules/session/components/SessionView/SessionView.tsx:122-139` —
  `handleEndSession` + guard `endingRef`, wywołanie `endSessionAction`
- `src/modules/session/components/SessionView/SessionView.tsx:142,175` — wejścia
  wyłączone poza `in_progress`
- `src/modules/session/actions.ts:119-224` — `endSessionAction`: ocena + atomowy
  UPDATE (`outcome`, `isFailed`, `completedAt`)
- `src/modules/session/actions.ts:166-179` — atomowe „zaklepanie"
  `WHERE outcome = 'in_progress'`
- `src/modules/session/actions.ts:75-76` — `selectTestAction` blokuje tylko gdy
  sesja nie `in_progress` (brak guardu czasowego)
- `src/shared/lib/validator.ts:40-49` — `evaluateSessionEnd`: `irreversibleFail`
  gdy pominięto test krytyczny
- `src/shared/lib/schema.ts:101-118` — tabela `session_result` (`outcome`,
  `isFailed`, `completedAt`)
- `src/app/dashboard/session/[sessionId]/page.tsx:46-56` — przekazanie
  `timeLimitSeconds` + `startedAt` do widoku
- `.github/workflows/cleanup.yml` — jedyny cron; dotyczy kont, nie sesji
- `supabase/config.toml:370` — brak funkcji Supabase w projekcie

GitHub permalinks (commit `82df69e`):

- https://github.com/PixelSculptor/osce-traiger/blob/82df69e1ff77e87c770708b2f9f9800b970d22d3/src/modules/session/components/SessionView/SessionView.tsx#L115-L120
- https://github.com/PixelSculptor/osce-traiger/blob/82df69e1ff77e87c770708b2f9f9800b970d22d3/src/modules/session/actions.ts#L166-L179
- https://github.com/PixelSculptor/osce-traiger/blob/82df69e1ff77e87c770708b2f9f9800b970d22d3/src/shared/lib/validator.ts#L40-L49

## Architecture Insights

- **Stan sesji niesie jedna kolumna `outcome`** (`in_progress` →
  `positive|negative`), bez osobnego pola statusu — terminalność jest
  jednokierunkowa i wymuszana atomowym UPDATE-em z bramką
  `WHERE outcome = 'in_progress'` (concurrency-safe, jeden zwycięzca
  finalizacji).
- **Czas jest kotwiczony serwerowo, ale egzekwowany klienckim tickiem** —
  projekt zaufał żywej karcie jako jedynemu „triggerowi" wygaśnięcia. Trwały
  `started_at` + `time_limit_seconds` to wystarczająca podstawa, by dodać
  serwerowy guard, ale go nie ma.
- **Ocena jest binarna i oparta na pokryciu testów krytycznych** — nie ma kary
  czasowej ani wyniku liczbowego; „negatywny" wynika z pominięcia testu
  krytycznego, co z upływem czasu zwykle zachodzi mimochodem.
- **Pominięte krytyczne** są materializowane jako zdarzenia `critical_miss` przy
  finalizacji — wynik i jego uzasadnienie są audytowalne.

## Historical Context (from prior changes)

- `context/changes/first-playable-session/` — pierwotna implementacja przepływu
  sesji (start → wybór testów → zakończenie); źródło wzorca
  `outcome`/`endSessionAction`.
- `context/changes/session-history-save/` — utrwalanie zakończonych sesji;
  zapytania historii filtrują `ne(outcome, 'in_progress')`
  (`queries.ts:74-93,109-128`), więc sesje nigdy nie zakończone nie pojawiają
  się w historii (potwierdza lukę „in_progress na zawsze").
- `context/changes/delete-session/` — `deleteSessionAction` odmawia usunięcia,
  gdy `in_progress` (`actions.ts:235-236`) — kolejny dowód, że porzucone sesje
  pozostają trwale „zawieszone".

## Open Questions

- **Czy auto-finalizacja powinna być gwarantowana przez serwer?** Obecny model
  gubi porzucone/wygasłe sesje (zostają `in_progress`). Czy MVP tego wymaga, czy
  wystarczy ścieżka kliencka?
- **Czy `selectTestAction` powinno odrzucać wybory po deadline?** Dziś brak
  guardu pozwala edytować i kończyć wygasłą sesję bez kary czasowej po ponownym
  wejściu.
- **Czy „przekroczenie czasu" powinno wymuszać `negative` niezależnie od
  pokrycia testów krytycznych?** Obecnie wynik jest czysto merytoryczny; nie ma
  reguły „czas minął = porażka".
- **Dryf zegara w uśpionej karcie** — czy potrzebna jest re-synchronizacja
  `remainingSeconds` z `startedAt` na ticku (np. przy `visibilitychange`)?

## Related Research

- (brak wcześniejszych `research.md` dotyczących timera/sesji w
  `context/changes/**` ani `context/archive/**`)
