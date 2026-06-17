# Logged-state: naprawa Error 1101 i wycieku stanu logowania — Plan implementacji

## Przegląd

Produkcja na Cloudflare Workers przestała działać poprawnie: każda strona poza
loginem zawiesza Workera (Cloudflare **Error 1101 — "Worker hung"**), a w
navbarze niezalogowany użytkownik widzi stan zalogowanego (wyciek przez cache
CDN). Lokalnie z lokalnym Supabase wszystko działa.

Oba objawy mają wspólny korzeń: `auth()` na każdej stronie (przez `Nav` w root
layoucie) jest skonfigurowane z `DrizzleAdapter` mimo strategii JWT, więc
`auth()` uderza w DB; przy zrecyklowanym/martwym połączeniu PgBouncer query wisi
bez limitu czasu, a Worker pada w Error 1101. Jednocześnie brak `force-dynamic`
i nagłówków `Cache-Control` pozwala CDN cache'ować HTML ze stanem zalogowanego.

Plan: (1) twardy `query_timeout` w warstwie DB, (2) usunięcie zbędnego
`DrizzleAdapter` — `auth()` przestaje dotykać DB, (3) graceful degradation gdy
DB zawiedzie, (4) wymuszenie dynamicznego renderowania i blokada cache CDN.

## Analiza stanu obecnego

**Co już naprawiono** (commity `38b9fb5`, `e555301`, `40e891b`):

- `src/shared/lib/db.ts` ma `prepare: false`, `fetch_types: false`, SSL z URL
  (`ssl: 'require'` dla zdalnego, `false` dla `127.0.0.1`/`localhost`),
  `connect_timeout: 10`, `idle_timeout: 20`, `max: 1`.
- Server _actions_ sesji (`src/modules/session/actions.ts`) owinięte w try/catch
  wokół `auth()` (commit `63f99bd`).
- Runtime secret `DATABASE_URL` na produkcji jest ustawiony i wskazuje na pooler
  transaction-mode (port 6543) — **potwierdzone przez użytkownika**.

**Czego brakuje (przyczyny pozostałych objawów):**

- `db.ts:16` — `connect_timeout: 10` chroni tylko nawiązanie połączenia; **brak
  `query_timeout`** → query na martwym połączeniu wisi bez limitu (główny driver
  Error 1101).
- `src/modules/auth/auth.ts:16-21` — `DrizzleAdapter` aktywny przy
  `strategy: 'jwt'` + Credentials → `auth()` może wołać DB na każdej stronie.
  Tabele `sessions`/`accounts`/`verificationTokens` są nieużywane przy JWT.
- 7 wywołań `auth()` w Server Components **bez try/catch**: `app/page.tsx:6`,
  `shared/components/Nav/Nav.tsx:7`, `app/dashboard/page.tsx:8`,
  `app/dashboard/history/page.tsx:8`,
  `app/dashboard/session/[sessionId]/page.tsx:20`,
  `app/dashboard/session/[sessionId]/details/page.tsx:40`,
  `app/account/settings/page.tsx:9`.
- `src/modules/account/actions.ts:15,32` — `auth()` bez try/catch.
- `src/modules/session/queries.ts` — funkcje danych bez try/catch; brak
  segmentowych `error.tsx`, więc błąd query → biały ekran / Error 1101 zamiast
  komunikatu.
- `src/app/layout.tsx` — brak `export const dynamic = 'force-dynamic'`.
- `next.config.ts` — brak `headers()` z `Cache-Control`.
- `src/modules/auth/actions.ts:90-96` — `logoutAction` bez
  `revalidatePath('/', 'layout')`.

## Pożądany stan końcowy

Po wdrożeniu na produkcję:

- Każda chroniona strona (`/dashboard`, historia prób, szczegóły sesji, konto)
  **ładuje się bez Error 1101**; pełna sesja diagnostyczna przechodzi od
  początku do końca, a historia prób jest dostępna.
- Gdy zapytanie DB faktycznie zawiedzie (np. chwilowa niedostępność Supabase),
  użytkownik widzi **segmentowy komunikat błędu z możliwością ponowienia**, a
  nie zawieszoną stronę Cloudflare.
- Niezalogowany użytkownik widzi navbar gościa; po wylogowaniu i odświeżeniu
  stan to "niezalogowany" — **brak wycieku stanu między sesjami przez cache
  CDN**.
- `auth()` nie wykonuje żadnego zapytania do DB.

Weryfikacja: pełny przelot sesji diagnostycznej na produkcji + test wylogowania
w drugiej karcie/incognito (patrz Strategia testowania).

### Kluczowe odkrycia:

- `src/modules/auth/auth.config.ts:3-11` — wariant Edge (middleware) ma już
  `providers: []` i **żadnego adaptera**; usunięcie adaptera z `auth.ts` nie
  ruszy middleware (split-config pozostaje poprawny).
- `src/modules/auth/auth.ts:24-31` — callbacki `jwt`/`session` ustawiają
  `token.sub`/`session.user.id` i **nie zależą od adaptera**; po usunięciu
  adaptera działają bez zmian.
- `src/modules/auth/auth.ts:42` — `authorize()` robi własne `db.query.users`
  (login), więc login działa niezależnie od adaptera (zgodne z obserwacją: login
  jako jedyny działa na produkcji).
- `src/modules/auth/user.util.ts` (rejestracja) używa tabeli `users`
  bezpośrednio — nie zależy od adaptera.
- `next.config.ts:11` — linia `initOpenNextCloudflareForDev()` na końcu pliku
  musi zostać nietknięta.
- `src/modules/session/queries.ts:1` — `import 'server-only'`; pliki queries są
  współdzielone przez Server Components i Server Actions.

## Czego NIE robimy

- **Nie usuwamy** tabel `sessions`/`accounts`/`verificationTokens` ze schematu
  ani nie piszemy migracji — stają się martwe po usunięciu adaptera, ale ich
  usunięcie to osobne sprzątanie poza zakresem (ryzyko migracji bez korzyści dla
  objawów).
- **Nie włączamy** R2 incremental cache (`open-next.config.ts`) — to
  optymalizacja spójności cache między instancjami, nie naprawia żadnego z dwóch
  objawów.
- **Nie przechodzimy** na `strategy: 'database'` — DB query na każdy request to
  dokładnie to, czego unikamy na Workers.
- **Nie zmieniamy** konfiguracji deploymentu/secrets/poolera — `DATABASE_URL` +
  port 6543 potwierdzone jako poprawne.
- **Nie dodajemy** server-side session revocation — poza zakresem MVP.

## Podejście do implementacji

Kolejność jest celowa: najpierw fundament odporności (twardy timeout DB), potem
usunięcie głównej przyczyny zawieszenia (`auth()` → DB), potem graceful
degradation dla pozostałych zapytań danych, na końcu warstwa cache/leak. Każda
faza jest niezależnie wdrażalna i poprawia produkcję inkrementalnie.

## Faza 1: DB fail-fast (query_timeout)

### Przegląd

Sprawić, by żadne zapytanie nie mogło wisieć dłużej niż budżet Workera —
zamienić zawieszenie (Error 1101) w szybki, łapalny błąd. Fundament dla graceful
degradation z Fazy 3.

### Wymagane zmiany:

#### 1. Konfiguracja klienta postgres.js

**Plik**: `src/shared/lib/db.ts`

**Cel**: Dodać twardy limit czasu wykonania zapytania i skrócić timeout
nawiązania połączenia, by każda operacja DB kończyła się poniżej ~10s budżetu
CPU/wall-clock Workera.

**Kontrakt**: W obiekcie opcji `postgres(dbUrl, { ... })` dodać
`query_timeout: 8000` i zmienić `connect_timeout` z `10` na `5`. Pozostałe opcje
(`prepare`, `ssl`, `idle_timeout`, `max`, `fetch_types`) bez zmian.
Zaktualizować komentarz nad blokiem opcji, by odzwierciedlał `query_timeout`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- [ ] Sprawdzanie typów przechodzi: `npm run typecheck` (lub `npx tsc --noEmit`)
- [ ] Linting przechodzi: `npm run lint`
- [ ] Build przechodzi: `npm run build`

#### Weryfikacja ręczna:

- [ ] Lokalnie (lokalny Supabase) aplikacja nadal łączy się i ładuje dane bez
      regresji
- [ ] Wartości timeoutów są poniżej budżetu Workera (8s query < ~10s limit)

**Uwaga implementacyjna**: Po przejściu weryfikacji automatycznej zatrzymaj się
na potwierdzenie ręczne przed Fazą 2.

---

## Faza 2: Usunięcie DrizzleAdapter z auth.ts

### Przegląd

Wyciąć `DrizzleAdapter` z konfiguracji NextAuth, by `auth()` przestało dotykać
DB. To główna przyczyna zawieszenia na każdej stronie (Nav w root layoucie woła
`auth()`). Przy `strategy: 'jwt'` + Credentials adapter jest zbędny.

### Wymagane zmiany:

#### 1. Konfiguracja NextAuth bez adaptera

**Plik**: `src/modules/auth/auth.ts`

**Cel**: Usunąć opcję `adapter: DrizzleAdapter(...)` z wywołania
`NextAuth({...})` oraz powiązane, teraz nieużywane importy. Sesja pozostaje w
JWT cookie; callbacki `jwt`/`session`, provider `Credentials` i `authorize()`
zostają bez zmian.

**Kontrakt**:

- Usunąć cały blok `adapter: DrizzleAdapter(db, { ... })` (linie 16-21).
- Usunąć import `DrizzleAdapter` (linia 1).
- Usunąć z importu schematu (`@/shared/lib/schema`) nieużywane już `accounts`,
  `sessions`, `verificationTokens`; **zostawić `users`** (używane w
  `authorize()` przez `db.query.users`).
- Po zmianie pozostają używane: `db`, `users`, `eq`, `bcrypt`, `normalizeEmail`,
  `Credentials`, `NextAuth`.
- Eksport `{ handlers, auth, signIn, signOut }` i sygnatury bez zmian.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- [ ] Sprawdzanie typów przechodzi: `npm run typecheck`
- [ ] Linting przechodzi (brak nieużywanych importów): `npm run lint`
- [ ] Build przechodzi: `npm run build`

#### Weryfikacja ręczna:

- [ ] Lokalnie: login działa (Credentials → JWT cookie ustawione)
- [ ] Lokalnie: rejestracja nowego konta działa (ścieżka `user.util`)
- [ ] Lokalnie: po zalogowaniu `auth()` zwraca sesję z `user.id` i `user.email`
      (callbacki `jwt`/`session` działają bez adaptera)
- [ ] Lokalnie: wylogowanie działa

**Uwaga implementacyjna**: Po przejściu weryfikacji automatycznej zatrzymaj się
na potwierdzenie ręczne przed Fazą 3.

---

## Faza 3: Graceful degradation (try/catch + error.tsx)

### Przegląd

Zabezpieczyć pozostałe ścieżki DB tak, by błąd/timeout zapytania danych dawał
czytelny komunikat z ponowieniem zamiast zawieszenia, oraz dodać
belt-and-suspenders try/catch wokół `auth()` w Server Components i account
actions (spójność z commitem `63f99bd`).

### Wymagane zmiany:

#### 1. Try/catch wokół `auth()` w Server Components

**Pliki**: `src/app/page.tsx:6`, `src/shared/components/Nav/Nav.tsx:7`,
`src/app/dashboard/page.tsx:8`, `src/app/dashboard/history/page.tsx:8`,
`src/app/dashboard/session/[sessionId]/page.tsx:20`,
`src/app/dashboard/session/[sessionId]/details/page.tsx:40`,
`src/app/account/settings/page.tsx:9`

**Cel**: Owinąć każde wywołanie `auth()` tak, by błąd był traktowany jako brak
sesji (`session = null`), nie wysadzał renderowania. Dla stron publicznych
(`page.tsx`, `Nav`) → render wariantu gościa. Dla stron chronionych → istniejąca
logika redirectu na `/` (gdy `!session`) zadziała naturalnie.

**Kontrakt**: Wzorzec jak w `src/modules/session/actions.ts` (commit `63f99bd`):
`let session = null; try { session = await auth() } catch { /* traktuj jako brak sesji */ }`.
Zachować dotychczasowe zachowanie redirect/render zależne od `session`.

#### 2. Try/catch wokół `auth()` w account actions

**Plik**: `src/modules/account/actions.ts` (`requestDeletionAction:15`,
`cancelDeletionAction:32`)

**Cel**: Domknąć dwie server actions, które jeszcze nie mają ochrony `auth()`.

**Kontrakt**: Ten sam wzorzec co w `session/actions.ts`; przy braku sesji
zwrócić istniejący kształt błędu/wyniku tych akcji (zgodnie z ich obecnym
kontraktem zwrotnym).

#### 3. Try/catch w funkcjach zapytań

**Plik**: `src/modules/session/queries.ts` (oraz
`src/modules/account/queries.ts` dla `getAccountSettings`)

**Cel**: Każda funkcja danych łapie błąd DB i zwraca bezpieczną wartość, a błąd
re-rzuca w sposób kontrolowany tam, gdzie segment ma `error.tsx` (by pokazać
komunikat), albo zwraca pustą wartość tam, gdzie pusto jest poprawnym stanem.

**Kontrakt**: Dla funkcji list (`getScenarios`, `getUserSessions`,
`getDiagnosticTests`, `getTestClassificationsByScenario`, `getSessionEvents`) —
przy błędzie re-rzuć, by przejął segmentowy `error.tsx`. Dla funkcji single-row,
które już zwracają `null` przy braku danych (`getSessionById`,
`getScenarioById`, `getSessionDetails`, `getAccountSettings`) — odróżnić "brak
wiersza" (zwróć `null` → `notFound()`/redirect jak dziś) od "błąd DB" (re-rzuć →
`error.tsx`). Nie tłumić błędu DB jako "pusto", by nie mylić użytkownika.

#### 4. Segmentowe error boundaries

**Pliki (nowe)**: `src/app/dashboard/error.tsx`,
`src/app/dashboard/session/[sessionId]/error.tsx`,
`src/app/dashboard/history/error.tsx`

**Cel**: Pokazać użytkownikowi komunikat o błędzie ładowania danych z
przyciskiem ponowienia, izolując awarię do segmentu zamiast wysadzać całą stronę
/ oddawać Error 1101.

**Kontrakt**: Client Component (`'use client'`) eksportujący domyślnie komponent
z propsami `{ error: Error & { digest?: string }, reset: () => void }`; przycisk
wołający `reset()`. Treść po polsku, spójna z istniejącym stylem UI.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- [ ] Sprawdzanie typów przechodzi: `npm run typecheck`
- [ ] Linting przechodzi: `npm run lint`
- [ ] Build przechodzi: `npm run build`
- [ ] Pliki `error.tsx` istnieją w trzech segmentach (`dashboard`,
      `dashboard/session/[sessionId]`, `dashboard/history`)

#### Weryfikacja ręczna:

- [ ] Lokalnie: normalne ładowanie wszystkich chronionych stron działa
- [ ] Symulacja błędu DB (np. tymczasowo zły `DATABASE_URL` lokalnie) → strona
      pokazuje komunikat z `error.tsx`, nie biały ekran/zawieszenie
- [ ] Przycisk "spróbuj ponownie" (`reset()`) ponawia render po przywróceniu DB
- [ ] Strona główna / Nav renderują wariant gościa, gdy `auth()` rzuci

**Uwaga implementacyjna**: Po przejściu weryfikacji automatycznej zatrzymaj się
na potwierdzenie ręczne przed Fazą 4.

---

## Faza 4: Cache CDN / leak stanu logowania

### Przegląd

Wymusić dynamiczne renderowanie całej aplikacji i zablokować cache CDN dla
odpowiedzi zawierających stan auth, oraz wyczyścić cache po wylogowaniu.

### Wymagane zmiany:

#### 1. force-dynamic w root layoucie

**Plik**: `src/app/layout.tsx`

**Cel**: Wymusić dynamiczne renderowanie dla całego drzewa (Nav czyta auth na
każdej stronie), by Cloudflare nie cache'owało HTML ze stanem zalogowanego.

**Kontrakt**: Dodać `export const dynamic = 'force-dynamic';` obok istniejącego
`export const metadata`. Reszta layoutu bez zmian.

#### 2. Nagłówki Cache-Control dla ścieżek chronionych

**Plik**: `next.config.ts`

**Cel**: Defence-in-depth — jawne `private, no-store` dla ścieżek ze stanem
użytkownika, by CDN i przeglądarka nie przechowywały odpowiedzi.

**Kontrakt**: Dodać `async headers()` do `nextConfig` zwracające regułę dla
`source: '/(dashboard|account)(.*)'` z nagłówkiem
`Cache-Control: private, no-store, must-revalidate`. **Nie usuwać** linii
`initOpenNextCloudflareForDev()` ani istniejącego
`experimental.optimizePackageImports`.

#### 3. revalidatePath po wylogowaniu

**Plik**: `src/modules/auth/actions.ts` (`logoutAction:90-96`)

**Cel**: Po `signOut()` wyczyścić cache layoutu Next.js, by odświeżenie po
wylogowaniu nie pokazało stanu zalogowanego.

**Kontrakt**: Po bloku try/catch z `signOut()` dodać
`revalidatePath('/', 'layout')` (import `revalidatePath` z `next/cache`).
Zachować obecną obsługę `isRedirectError`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- [ ] Sprawdzanie typów przechodzi: `npm run typecheck`
- [ ] Linting przechodzi: `npm run lint`
- [ ] Build przechodzi: `npm run build`
- [ ] `next.config.ts` eksportuje `headers()` i zachowuje
      `initOpenNextCloudflareForDev()`

#### Weryfikacja ręczna (na produkcji / preview po deployu):

- [ ] Odpowiedź dla `/dashboard` ma nagłówek `Cache-Control: private, no-store`
      (sprawdzić DevTools / `curl -I`)
- [ ] Niezalogowany użytkownik (incognito) widzi navbar gościa, bez emaila
- [ ] Po wylogowaniu i odświeżeniu (oraz w nowej karcie) stan to "niezalogowany"
- [ ] Dwie różne sesje przeglądarki nie współdzielą stanu navbaru

**Uwaga implementacyjna**: Faza 4 weryfikuje się w pełni dopiero po deployu na
Cloudflare (cache CDN nie istnieje lokalnie). Po przejściu automatycznych
sprawdzeń wdróż i wykonaj weryfikację ręczną na produkcji.

---

## Strategia testowania

### Testy jednostkowe / integracyjne:

- Brak nowej logiki biznesowej; istniejące testy auth/session muszą przejść bez
  regresji (`npm test` jeśli skonfigurowane).
- Po usunięciu adaptera: zweryfikować, że testy logowania/rejestracji (jeśli
  istnieją) nadal przechodzą.

### Kroki testowania ręcznego (produkcja po deployu):

1. **Pełny przelot sesji diagnostycznej**: login → `/dashboard` (lista
   scenariuszy ładuje się) → wybór scenariusza → start sesji → wybór testów →
   zakończenie sesji → wynik. Żadnego Error 1101 na żadnym kroku.
2. **Historia prób**: `/dashboard/history` ładuje listę; wejście w szczegóły
   sesji (`/dashboard/session/[id]/details`) ładuje zdarzenia.
3. **Leak stanu**: w incognito otwórz `/` — navbar gościa, brak emaila. Zaloguj
   się w jednej karcie, w drugiej (incognito) odśwież `/` — nadal gość.
4. **Logout**: wyloguj się, odśwież — stan "niezalogowany"; powrót na
   `/dashboard` przekierowuje na `/`.
5. **Graceful error** (opcjonalnie, jeśli da się wymusić): chwilowa
   niedostępność DB → segmentowy komunikat błędu, nie strona Cloudflare.

## Uwagi dotyczące wydajności

- `force-dynamic` w root layoucie wyłącza statyczny cache także dla stron
  publicznych — akceptowalne dla MVP (Nav i tak czyta auth na każdej stronie).
- Usunięcie adaptera zmniejsza liczbę round-tripów DB na render (eliminuje
  potencjalne wywołania adaptera w `auth()`), poprawiając latencję.
- `query_timeout: 8000` ogranicza najgorszy przypadek; obecne zapytania to
  proste selecty/joiny — limit nie wpłynie na ścieżkę szczęśliwą.

## Uwagi dotyczące migracji

- Brak migracji DB. Tabele `sessions`/`accounts`/`verificationTokens` pozostają
  w schemacie jako martwe (świadomie poza zakresem — patrz "Czego NIE robimy").

## Referencje

- Powiązane badania: `context/changes/logged-state/research.md`
- Wzorzec try/catch wokół `auth()`: `src/modules/session/actions.ts` (commit
  `63f99bd`)
- Split-config auth: `src/modules/auth/auth.config.ts` (Edge) vs
  `src/modules/auth/auth.ts` (Node)

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: DB fail-fast (query_timeout)

#### Automatyczne

- [x] 1.1 Sprawdzanie typów przechodzi: `npm run typecheck`
- [x] 1.2 Linting przechodzi: `npm run lint`
- [x] 1.3 Build przechodzi: `npm run build`

#### Ręczne

- [x] 1.4 Lokalnie aplikacja łączy się i ładuje dane bez regresji
- [x] 1.5 Wartości timeoutów poniżej budżetu Workera (8s query < ~10s limit)

### Faza 2: Usunięcie DrizzleAdapter z auth.ts

#### Automatyczne

- [ ] 2.1 Sprawdzanie typów przechodzi: `npm run typecheck`
- [ ] 2.2 Linting przechodzi (brak nieużywanych importów): `npm run lint`
- [ ] 2.3 Build przechodzi: `npm run build`

#### Ręczne

- [ ] 2.4 Lokalnie: login działa (JWT cookie ustawione)
- [ ] 2.5 Lokalnie: rejestracja nowego konta działa
- [ ] 2.6 Lokalnie: `auth()` zwraca sesję z `user.id` i `user.email`
- [ ] 2.7 Lokalnie: wylogowanie działa

### Faza 3: Graceful degradation (try/catch + error.tsx)

#### Automatyczne

- [ ] 3.1 Sprawdzanie typów przechodzi: `npm run typecheck`
- [ ] 3.2 Linting przechodzi: `npm run lint`
- [ ] 3.3 Build przechodzi: `npm run build`
- [ ] 3.4 Pliki `error.tsx` istnieją w trzech segmentach

#### Ręczne

- [ ] 3.5 Normalne ładowanie wszystkich chronionych stron działa
- [ ] 3.6 Symulowany błąd DB → komunikat z `error.tsx`, nie biały ekran
- [ ] 3.7 Przycisk `reset()` ponawia render po przywróceniu DB
- [ ] 3.8 Strona główna / Nav renderują wariant gościa, gdy `auth()` rzuci

### Faza 4: Cache CDN / leak stanu logowania

#### Automatyczne

- [ ] 4.1 Sprawdzanie typów przechodzi: `npm run typecheck`
- [ ] 4.2 Linting przechodzi: `npm run lint`
- [ ] 4.3 Build przechodzi: `npm run build`
- [ ] 4.4 `next.config.ts` eksportuje `headers()` i zachowuje
      `initOpenNextCloudflareForDev()`

#### Ręczne

- [ ] 4.5 Odpowiedź `/dashboard` ma nagłówek `Cache-Control: private, no-store`
- [ ] 4.6 Niezalogowany (incognito) widzi navbar gościa, bez emaila
- [ ] 4.7 Po wylogowaniu i odświeżeniu stan to "niezalogowany"
- [ ] 4.8 Dwie różne sesje przeglądarki nie współdzielą stanu navbaru
