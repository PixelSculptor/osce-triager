# Per-request DB client (fix "Worker hung") — Plan implementacji

## Przegląd

Aplikacja na produkcji (Cloudflare Workers via OpenNext) zwraca błąd
`The Workers runtime canceled this request because it detected that your Worker's code had hung and would never generate a response`.
Przyczyną jest **module-level singleton** klienta postgres-js w
`src/shared/lib/db.ts`: socket TCP utworzony w kontekście I/O jednego requestu
jest reużywany w kolejnym, czego `workerd` zabrania → zapytanie nigdy się nie
kończy → handler wisi → runtime kasuje request. Lokalnie (Node) problem nie
występuje, bo Node nie izoluje I/O per-request.

Naprawa: zamienić singleton na **fabrykę per-request** `getDb()` opartą o React
`cache()` (ten sam instancja w obrębie jednego requestu, świeża w następnym), z
hardeningiem połączenia i bez Hyperdrive na tym etapie. Pełny kontekst:
`context/changes/fix-db-issue/research.md`.

## Analiza stanu obecnego

- `src/shared/lib/db.ts:6` —
  `const client = postgres(process.env.DATABASE_URL!, { prepare: false })` na
  poziomie modułu; `export const db = drizzle(client, { schema })` (`:8`). Tylko
  `prepare: false`, bez timeoutów/`max`/`fetch_types`.
- **8 konsumentów** importuje `{ db }`:
  - `src/modules/auth/auth.ts:7` — `DrizzleAdapter(db, …)` (module scope) +
    `db.query.users.findFirst` w `authorize` (`:42`).
  - `src/modules/auth/user.util.ts:3` — `registerUser` (SELECT + INSERT users).
  - `src/modules/account/queries.ts:3` — `getAccountSettings`.
  - `src/modules/account/actions.ts:6` — `requestDeletionAction`,
    `cancelDeletionAction`.
  - `src/modules/session/queries.ts:4` — 9 funkcji RSC
    (dashboard/session/history/details).
  - `src/modules/session/actions.ts:6` — `startSessionAction`,
    `selectTestAction`, `endSessionAction`, `deleteSessionAction`.
  - `src/modules/session/queries.test.ts`, `src/modules/session/actions.test.ts`
    — testy integracyjne na lokalnym Postgres
    (`DATABASE_URL_TEST`→`DATABASE_URL` w `vitest.setup.ts`).
- `src/modules/auth/auth.config.ts` — Edge-safe config (JWT, brak adaptera/DB);
  używany w `middleware.ts`. **Nie wymaga zmian** (nie dotyka DB).
- Strategia sesji to **JWT + Credentials** → DrizzleAdapter jest w praktyce
  uśpiony w runtime; prawdziwe zapytania robią `authorize`, route `register`,
  akcje i RSC.
- Połykanie błędów: `startSessionAction` (`actions.ts:51-53`) i
  `selectTestAction` (`:110-112`) mają puste
  `catch { return { error: 'Internal error' } }` bez logu; `endSessionAction`
  (`:215-217`) już loguje.
- `wrangler.jsonc:6` — `nodejs_compat` włączony → `process.env` zasilane w
  request scope.

## Pożądany stan końcowy

`src/shared/lib/db.ts` nie eksportuje już żadnego obiektu połączenia na poziomie
modułu — tylko fabrykę `getDb()`. Każda ścieżka serwerowa (RSC, server action,
route handler, adapter NextAuth, `authorize`) pobiera klienta przez `getDb()` w
obrębie własnego requestu. `grep -r "import { db }" src` oraz
`grep "export const db" src/shared/lib/db.ts` nie zwracają nic. Aplikacja
przechodzi smoke test na `wrangler`/`opennextjs-cloudflare preview` (workerd), a
po deployu trzy przepływy (dashboard → wejście w sesję → zlecanie badań) nie
generują błędu "hung" w Cloudflare logs.

### Kluczowe odkrycia:

- React `cache()` memoizuje **per request**, nie globalnie — dokładnie izolacja
  I/O wymagana przez workerd
  ([react.dev/cache](https://react.dev/reference/react/cache),
  [opennext.js.org/cloudflare/howtos/db](https://opennext.js.org/cloudflare/howtos/db)).
- NextAuth v5 wspiera **lazy config factory** `NextAuth(req => ({…}))`,
  ewaluowaną per invocation; eksporty `auth/handlers/signIn/signOut` pozostają
  stabilne ([authjs.dev/reference/nextjs](https://authjs.dev/reference/nextjs)).
  `req` bywa `undefined` (np. `auth()` w RSC) — fabryka musi zwracać kompletny
  config niezależnie od `req`.
- Pod JWT+Credentials adapter nie wykonuje zapytań runtime, ale
  `DrizzleAdapter(db)` na poziomie modułu i tak przechwytuje singleton — dlatego
  musi przejść na `getDb()`.
- `cache()` wywołane poza kontekstem requestu (testy Node, seed) po prostu
  tworzy świeżego klienta przy każdym wywołaniu — bez szkody dla poprawności.

## Czego NIE robimy

- **Hyperdrive** — świadomie odłożone (osobna warstwa transportu/TLS; patrz
  [[project-prod-db-connection]]). Ten plan naprawia wyłącznie cykl życia
  klienta.
- Zmiana `DATABASE_URL` / sekretów / poolera (Supavisor) — pozostają jak są.
- `auth.config.ts` / `middleware.ts` — bez zmian (nie dotykają DB).
- Migracje schematu, zmiany w zapytaniach biznesowych, `sql.end()`/`waitUntil`
  cleanup (wybrano wariant bez jawnego zamykania).
- Refaktor sygnatur funkcji query/action — zmieniamy tylko źródło `db` wewnątrz
  nich.

## Podejście do implementacji

Inkrementalnie, utrzymując zielony build na końcu każdej fazy. Faza 1 wprowadza
`getDb()` i migruje wszystkich konsumentów oprócz auth, **chwilowo zachowując**
stary `export const db` (używany jeszcze przez `auth.ts`), więc typecheck
przechodzi. Faza 2 przerabia `auth.ts` na lazy-init i **usuwa** singleton — po
niej żaden kod nie odwołuje się do globalnego klienta. Faza 3 weryfikuje
zachowanie na realnym workerd (preview) i na produkcji.

## Krytyczne szczegóły implementacji

- **Kolejność usunięcia singletonu**: `export const db` można usunąć z `db.ts`
  dopiero w Fazie 2, po migracji `auth.ts`. Usunięcie go w Fazie 1 złamałoby
  typecheck (auth.ts wciąż importuje `db`).
- **`req` w lazy NextAuth bywa `undefined`**: fabryka `NextAuth(req => …)` musi
  zwracać pełny, poprawny config także gdy `req` jest nieobecny (wywołania
  `auth()` w RSC). Nie warunkuj budowy adaptera/providerów od obecności `req`.
- **`cache()` musi obejmować całą budowę klienta** (`postgres(...)` +
  `drizzle(...)`), nie tylko `drizzle` — inaczej socket postgres-js wciąż
  powstałby raz i był reużywany.

---

## Faza 1: Fabryka DB + migracja konsumentów nie-auth

### Przegląd

Wprowadzić `getDb()` w `db.ts`, przełączyć wszystkich konsumentów poza `auth.ts`
(w tym testy) na pobieranie klienta per-request, dodać logowanie do dwóch
pustych bloków `catch`. Stary `export const db` pozostaje tymczasowo, aby
`auth.ts` się kompilował.

### Wymagane zmiany:

#### 1. Fabryka połączenia per-request

**Plik**: `src/shared/lib/db.ts`

**Cel**: Dodać `getDb()` tworzące klienta postgres-js + drizzle per-request,
memoizowane przez React `cache()`, z hardeningiem połączenia. Zachować chwilowo
dotychczasowy `export const db` (zostanie usunięty w Fazie 2), aby nie zepsuć
`auth.ts`.

**Kontrakt**: nowy eksport
`export const getDb: () => PostgresJsDatabase<typeof schema>`. Wewnątrz
`cache()`:
`postgres(process.env.DATABASE_URL!, { max: 3, prepare: false, fetch_types: false, connect_timeout: 10 })`
→ `drizzle(client, { schema })`. Cała budowa (postgres + drizzle) wewnątrz
callbacku `cache()`. Bez `sql.end()`.

```ts
import { cache } from 'react';
// ...
export const getDb = cache(() =>
  drizzle(
    postgres(process.env.DATABASE_URL!, {
      max: 3,
      prepare: false,
      fetch_types: false,
      connect_timeout: 10,
    }),
    { schema },
  ),
);
```

#### 2. Konsumenci RSC (session + account queries)

**Pliki**: `src/modules/session/queries.ts`, `src/modules/account/queries.ts`

**Cel**: Zamienić import singletonu na fabrykę; w każdej funkcji pobrać
`const db = getDb();` jako pierwszą instrukcję, reszta logiki bez zmian.

**Kontrakt**: usunąć `import { db } from '@/shared/lib/db'`, dodać
`import { getDb } from '@/shared/lib/db'`; sygnatury i zwracane typy 9 funkcji w
`queries.ts` oraz `getAccountSettings` bez zmian. Zachować dyrektywę
`import 'server-only'`.

#### 3. Konsumenci server actions (session + account)

**Pliki**: `src/modules/session/actions.ts`, `src/modules/account/actions.ts`

**Cel**: Per-request `const db = getDb();` na początku ciała każdej akcji (po
`await auth()`), bez zmiany logiki. Dla `deleteSessionAction` (delegującego do
`queries.ts`) wystarczy migracja samego `queries.ts`.

**Kontrakt**: `import { getDb }` zamiast `import { db }`; `db` definiowane
lokalnie w `startSessionAction`, `selectTestAction`, `endSessionAction`,
`requestDeletionAction`, `cancelDeletionAction`. Zachować `'use server'`.

#### 4. Logowanie w pustych blokach catch

**Plik**: `src/modules/session/actions.ts`

**Cel**: Dodać `console.error(...)` w blokach `catch` w `startSessionAction` i
`selectTestAction`, spójnie z istniejącym wzorcem w `endSessionAction` (`:216`),
aby prawdziwa przyczyna trafiała do Workers Logs zamiast niemego HTTP 500.

**Kontrakt**: `} catch { return { error: 'Internal error' }; }` →
`} catch (error) { console.error('[startSessionAction] DB error:', error); return { error: 'Internal error' }; }`
(analogicznie `[selectTestAction]`).

#### 5. Rejestracja użytkownika

**Plik**: `src/modules/auth/user.util.ts`

**Cel**: `registerUser` pobiera `const db = getDb();` przed zapytaniami;
`normalizeEmail` bez zmian. (Plik jest w module auth, ale nie dotyka NextAuth —
migrujemy go tutaj.)

**Kontrakt**: `import { getDb }` zamiast `import { db }`; `db` lokalnie w
`registerUser`.

#### 6. Testy integracyjne

**Pliki**: `src/modules/session/queries.test.ts`,
`src/modules/session/actions.test.ts`

**Cel**: Dostosować testy do nowego API — uzyskiwać klienta przez `getDb()`
zamiast importu `db`. W środowisku Node `cache()` zwraca świeżego klienta przy
każdym wywołaniu, więc testy integracyjne na lokalnym Postgres działają bez
dodatkowego mockowania.

**Kontrakt**: zamienić `import { db }` → `import { getDb }` i użycia `db` →
`getDb()` (np. w setupie/cleanupie i asercjach). Bez zmian w `vitest.setup.ts`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- [ ] Typecheck przechodzi: `npm run typecheck`
- [ ] Lint przechodzi: `npm run lint`
- [ ] Testy jednostkowe/integracyjne przechodzą: `npm run test`
- [ ] `getDb` istnieje i jest jedynym nowym eksportem fabryki:
      `grep -n "getDb" src/shared/lib/db.ts`
- [ ] Żaden plik nie-auth nie importuje już singletonu:
      `grep -rn "import { db }" src/modules/session src/modules/account src/modules/auth/user.util.ts`
      zwraca pusto

#### Weryfikacja ręczna:

- [ ] Przegląd diffu: każda funkcja query/action pobiera `db = getDb()`
      lokalnie, logika niezmieniona
- [ ] `auth.ts` nadal kompiluje się dzięki tymczasowemu `export const db`

**Uwaga implementacyjna**: Po przejściu automatycznych weryfikacji zatrzymaj się
na ręczne potwierdzenie przed Fazą 2.

---

## Faza 2: Lazy-init NextAuth + usunięcie singletonu

### Przegląd

Przerobić `auth.ts` na lazy config factory NextAuth używającą `getDb()`, a
następnie usunąć tymczasowy `export const db`/`client` z `db.ts`. Po tej fazie
singleton nie istnieje.

### Wymagane zmiany:

#### 1. Lazy-init NextAuth z adapterem per-request

**Plik**: `src/modules/auth/auth.ts`

**Cel**: Zamienić obiektowy config NextAuth na formę funkcyjną
`NextAuth((req) => ({ … }))`, budującą `DrizzleAdapter(getDb(), {…})` oraz
wykonującą `authorize` przez `getDb()`. Eksporty
`{ handlers, auth, signIn, signOut }` pozostają bez zmian. Config musi być
kompletny także gdy `req` jest `undefined`.

**Kontrakt**: `import { getDb }` zamiast `import { db }`;
`export const { handlers, auth, signIn, signOut } = NextAuth((req) => ({ adapter: DrizzleAdapter(getDb(), { usersTable, accountsTable, sessionsTable, verificationTokensTable }), session: { strategy: 'jwt' }, callbacks: {…}, providers: [Credentials({ … authorize: async (credentials) => { const db = getDb(); … } })] }))`.
Callbacki `jwt`/`session` i logika `authorize` bez zmian poza źródłem `db`.

#### 2. Usunięcie singletonu

**Plik**: `src/shared/lib/db.ts`

**Cel**: Usunąć `const client = postgres(...)` i
`export const db = drizzle(...)`; pozostaje wyłącznie `getDb()`.

**Kontrakt**: po zmianie plik eksportuje tylko `getDb`. Brak jakiegokolwiek
wywołania `postgres()` / `drizzle()` na poziomie modułu.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- [ ] Typecheck przechodzi: `npm run typecheck`
- [ ] Lint przechodzi: `npm run lint`
- [ ] Testy przechodzą: `npm run test`
- [ ] Build OpenNext przechodzi: `npm run build:worker`
- [ ] Brak singletonu: `grep -n "export const db" src/shared/lib/db.ts` zwraca
      pusto
- [ ] Brak konstrukcji klienta na poziomie modułu:
      `grep -n "postgres(" src/shared/lib/db.ts` występuje tylko wewnątrz
      `cache(() => …)`
- [ ] Żaden plik nie importuje singletonu: `grep -rn "import { db }" src` zwraca
      pusto

#### Weryfikacja ręczna:

- [ ] Przegląd `auth.ts`: forma funkcyjna zwraca pełny config także dla
      `req === undefined`; eksporty niezmienione
- [ ] Logowanie i rejestracja działają lokalnie (`npm run dev`): login
      (Credentials) i rejestracja przez `/api/auth/register`

**Uwaga implementacyjna**: Po automatycznych weryfikacjach zatrzymaj się na
ręczne potwierdzenie przed Fazą 3.

---

## Faza 3: Weryfikacja na workerd (preview + prod)

### Przegląd

Potwierdzić, że błąd "hung" zniknął na realnym runtime workerd — najpierw
lokalnie przez preview OpenNext, potem na produkcji.

### Wymagane zmiany:

Brak zmian w kodzie. Faza weryfikacyjna.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- [ ] Build + preview startuje bez błędów: `npm run preview`
      (`opennextjs-cloudflare preview`)

#### Weryfikacja ręczna:

- [ ] Preview (workerd lokalnie): wejście na `/dashboard` ładuje się za
      pierwszym razem (brak ekranu "reload")
- [ ] Preview: wejście w sesję `/dashboard/session/[id]` renderuje się bez
      zawieszenia
- [ ] Preview: zlecenie badania (`selectTestAction`) zwraca wynik, brak HTTP 500
- [ ] Deploy na prod: `npm run deploy`
- [ ] Prod: te same trzy przepływy działają, w Cloudflare Workers Logs **brak**
      błędu "code had hung"; ewentualne błędy DB pojawiają się z czytelnym
      `console.error` (z Fazy 1)

**Uwaga**: bez Hyperdrive preview może nie odtworzyć warstwy TLS/cert do
Supabase — część weryfikacji transportu rozstrzyga się dopiero na prod. Jeśli na
prod pojawi się błąd TLS/cert (a nie "hung"), to potwierdza, że pozostała
warstwa to Hyperdrive (osobna zmiana).

---

## Strategia testowania

### Testy jednostkowe/integracyjne:

- Istniejące testy `session/queries.test.ts` i `actions.test.ts` muszą przejść
  po migracji na `getDb()` (lokalny Postgres przez `DATABASE_URL_TEST`).
- Brak nowych testów jednostkowych — refaktor nie zmienia logiki; zachowanie
  workerd nie jest testowalne w Node.

### Testy integracyjne / E2E:

- Smoke na preview (workerd) i prod dla trzech przepływów (dashboard, sesja,
  zlecanie badań).

### Kroki testowania ręcznego:

1. `npm run preview` → przejdź `/dashboard`, wejdź w sesję, zleć badanie;
   potwierdź brak zawieszeń/500.
2. `npm run deploy` → powtórz na prod; obserwuj Workers Logs pod kątem braku
   "hung".
3. Odśwież kilkukrotnie (ciepły isolate) — wcześniej to wywoływało naprzemienne
   zawieszenia; teraz każde żądanie powinno działać.

## Uwagi dotyczące wydajności

Tworzenie klienta per-request jest tanie (postgres-js nie łączy się przy
konstrukcji, tylko przy pierwszym zapytaniu; `cache()` zapewnia jeden klient na
request). `max: 3` mieści się w limicie ~6 jednoczesnych połączeń workerd.
`connect_timeout: 10` zapewnia szybkie failowanie zamiast wiszącego requestu.

## Uwagi dotyczące migracji

Brak migracji danych. Zmiana wyłącznie w warstwie połączenia; wycofanie = revert
commitów faz 1-2 (przywrócenie singletonu). Deploy dopiero po Fazie 2.

## Referencje

- Powiązane badania: `context/changes/fix-db-issue/research.md`
- Wzorzec OpenNext DB (cache + per-request):
  https://opennext.js.org/cloudflare/howtos/db
- React `cache()`: https://react.dev/reference/react/cache
- Auth.js lazy init: https://authjs.dev/reference/nextjs
- Istniejący wzorzec logowania błędu: `src/modules/session/actions.ts:216`
- Pamięć: [[project-prod-db-connection]] (warstwa Hyperdrive — poza zakresem)

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Fabryka DB + migracja konsumentów nie-auth

#### Automatyczne

- [x] 1.1 Typecheck przechodzi: `npm run typecheck` (po usunięciu nieaktualnego
      `.next/types/validator.ts` wskazującego na usunięty route `debug-env` —
      artefakt builda, niezwiązany z tą zmianą)
- [x] 1.2 Lint przechodzi: `npm run lint` (0 błędów, 0 ostrzeżeń)
- [~] 1.3 Testy: wynik identyczny jak baseline (`2 passed | 10 skipped` dla obu
  zmigrowanych plików; pełny pakiet `20 passed | 5 failed | 10 skipped`). Testy
  hermetyczne przechodzą (m.in. spy na `getDb()` w `endSessionAction`). Testy
  integracyjne padają na `remaining connection slots` (53300) — ograniczenie
  testowej bazy `DATABASE_URL_TEST`, takie samo przed i po zmianie; brak
  regresji.
- [x] 1.4 `getDb` obecne w `db.ts`: `grep -n "getDb" src/shared/lib/db.ts`
- [x] 1.5 Pliki nie-auth nie importują singletonu:
      `grep -rn "import { db }" src/modules/session src/modules/account src/modules/auth/user.util.ts`
      pusto

#### Ręczne

- [ ] 1.6 Przegląd diffu: każda funkcja pobiera `db = getDb()` lokalnie, logika
      niezmieniona
- [x] 1.7 `auth.ts` nadal kompiluje się dzięki tymczasowemu `export const db`
      (potwierdzone przez zielony typecheck — `auth.ts` wciąż importuje `db`)

### Faza 2: Lazy-init NextAuth + usunięcie singletonu

#### Automatyczne

- [x] 2.1 Typecheck przechodzi: `npm run typecheck`
- [x] 2.2 Lint przechodzi: `npm run lint`
- [x] 2.3 Testy przechodzą: `npm run test` (`35 passed` po wyczyszczeniu idle
      połączeń lokalnej bazy — sam test runner nie był problemem)
- [x] 2.4 Build OpenNext przechodzi: `npm run build:worker`
      (`OpenNext build complete.`, `worker.js` zapisany)
- [x] 2.5 Brak singletonu: `grep -n "export const db" src/shared/lib/db.ts`
      pusto
- [x] 2.6 `postgres(` w `db.ts` tylko wewnątrz `cache(() => …)`
- [x] 2.7 Żaden plik nie importuje singletonu: `grep -rn "import { db }" src`
      pusto

> Uwaga: analiza planu wymieniała 8 konsumentów; typecheck po usunięciu
> singletonu wykrył jeszcze 2 (`src/shared/lib/seed.ts`,
> `src/shared/lib/seed-test.ts`) używające `const { db } = await import('./db')`
> (dynamiczny import — pominięty przez grep statyczny). Oba zmigrowane na
> `getDb()`; wzorzec dynamicznego importu zachowany.

#### Ręczne

- [x] 2.8 Przegląd `auth.ts`: pełny config także dla `req === undefined` (forma
      `NextAuth(() => ({…}))` — config nie zależy od `req`), eksporty
      `{ handlers, auth, signIn, signOut }` niezmienione
- [ ] 2.9 Login (Credentials) i rejestracja działają lokalnie (`npm run dev`)

### Faza 3: Weryfikacja na workerd (preview + prod)

#### Automatyczne

- [ ] 3.1 Preview startuje bez błędów: `npm run preview`

#### Ręczne

- [ ] 3.2 Preview: `/dashboard` ładuje się za pierwszym razem
- [ ] 3.3 Preview: wejście w sesję bez zawieszenia
- [ ] 3.4 Preview: zlecenie badania zwraca wynik, brak HTTP 500
- [ ] 3.5 Deploy na prod: `npm run deploy`
- [ ] 3.6 Prod: trzy przepływy działają, brak "code had hung" w Workers Logs
