# Naprawa wylogowania — middleware re-wystawia cookie sesji na prod — Plan implementacji

## Przegląd

Na produkcji (Cloudflare Workers / OpenNext) odpowiedź na wylogowanie zawiera
**dwa konkurujące `Set-Cookie`** dla `__Secure-authjs.session-token`: (1) delete
z `signOut` oraz (2) świeży ważny token z rolling-refresh middleware Auth.js.
Delete jest pierwszy, refresh drugi → przeglądarka stosuje regułę „ostatni
wygrywa" i zachowuje ważny token. Przy strategii JWT (stateless) skasowanie
cookie to jedyny mechanizm wylogowania, więc po odświeżeniu sesja wraca.

Naprawa: middleware uruchamia wrapper `auth()` (i jego rolling-refresh) **tylko
dla żądań GET/HEAD**. Żądania mutujące sesję (POST / Server Action, w tym
logout) są przepuszczane bez odświeżania, dzięki czemu kasujący `Set-Cookie` z
`signOut` jest jedynym/autorytatywnym nagłówkiem cookie w odpowiedzi. Rolling-
refresh i ochrona tras dla normalnej nawigacji (GET) pozostają bez zmian.

Druga, osobna i mechaniczna część (zakres z `change.md`): odświeżenie
dokumentacji po wcześniejszym refaktorze warstwy DB.

## Analiza stanu obecnego

- `src/middleware.ts:9` eksportuje `export default auth((req) => {…})`. Wrapper
  `auth()` z Auth.js v5 jako **side-effect waliduje i rolling-refresh'uje**
  cookie JWT na każdym dopasowanym żądaniu — to znany footgun frameworka.
- Matcher `src/middleware.ts:21`
  (`/((?!_next/static|_next/image|favicon.ico).*)`) łapie praktycznie wszystko —
  także `/api/auth` i stronę, na którą Server Action `logoutAction` POST-uje
  (Server Actions POST-ują na bieżącą ścieżkę, np. `/dashboard`).
- `logoutAction` (`src/modules/auth/actions.ts:90`) woła
  `signOut({ redirectTo: '/' })`, który emituje kasujący `Set-Cookie`. Logout
  jest wyzwalany przez `<form>` z `formAction={logoutAction}` w
  `src/shared/components/Nav/NavLinks.tsx:51-55`.
- Strategia sesji to `jwt` (`src/modules/auth/auth.config.ts:4`,
  `src/modules/auth/auth.ts:26`); brak rewokacji po stronie serwera — kasowanie
  cookie jest jedynym wylogowaniem. Domyślny `maxAge` = 30 dni (stąd `Expires`
  +30 dni w zaobserwowanym nagłówku refreshu).
- **Reprodukcja prod-only**: na lokalnym `next dev` (Node) delecja `signOut`
  wygrywa; na runtime Workers/OpenNext (workerd) świeży token z middleware jest
  scalany jako ostatni i wygrywa. To różnica w kolejności scalania `Set-Cookie`
  między runtime'ami, nie w logice aplikacji.
- `src/modules/auth/auth.ts` używa lazy NextAuth factory
  (`NextAuth(() => ({…}))`) z `getDb()` per-request — niezwiązane z bugiem
  cookie, ale potwierdza, że emiterem delete jest Node-owy `signOut`, a emiterem
  refreshu Edge-owy `auth()` middleware (różnica `SameSite=lax` vs `Lax` w
  nagłówkach to potwierdza).

## Pożądany stan końcowy

Po wylogowaniu na produkcji odpowiedź logout niesie **wyłącznie** kasujący
`Set-Cookie` (`__Secure-authjs.session-token=; Max-Age=0`) — bez konkurencyjnego
świeżego tokenu. Po `signOut` + redirect i ręcznym odświeżeniu strony użytkownik
**pozostaje wylogowany**, a middleware przekierowuje go z tras chronionych na
`/`. Normalna nawigacja (GET) nadal rolling-refresh'uje sesję (brak regresji UX)
i nadal chroni trasy prywatne. Weryfikacja: inspekcja nagłówków odpowiedzi
logout na preview deploy (Workers) + ręczny przepływ logout→refresh.

### Kluczowe odkrycia:

- Refresh jest side-effectem wrappera `auth()`, którego inner-callback nie może
  pominąć — dlatego trzeba **warunkowo nie wywoływać `auth()`** dla non-GET, a
  nie próbować tłumić refresh wewnątrz callbacku (`src/middleware.ts:9`).
- Server Action logout POST-uje na bieżącą (chronioną) ścieżkę, więc nie da się
  go wykluczyć po `pathname` — bramka po **metodzie HTTP** (non-GET) jest
  właściwym, stabilnym sygnałem (`NavLinks.tsx:51`, `actions.ts:92`).
- Ochrona tras realnie chroni **GET-nawigację**; POST-y to Server Actions/route
  handlery, które egzekwują auth po stronie serwera (`auth()` w RSC/akcjach) —
  pominięcie middleware-redirectu dla non-GET nie otwiera nowej dziury (patrz
  „Otwarte ryzyka").
- `npm run preview` = `opennextjs-cloudflare build && … preview` uruchamia kod w
  **workerd lokalnie** — najbliższa lokalna reprodukcja kolejności scalania
  `Set-Cookie` (bliżej prod niż `next dev`).

## Czego NIE robimy

- **Nie** zmieniamy atrybutów cookie (`__Secure-`/`Secure`/`SameSite`) — rama
  obaliła hipotezę atrybutów (H1) dowodem z nagłówków.
- **Nie** ruszamy propagacji `Set-Cookie` w adapterze Workers/OpenNext (H2
  obalona — propagacja działa).
- **Nie** zmieniamy `AUTH_SECRET`, nazw cookie ani konfiguracji dwóch instancji
  NextAuth (H3 obalona).
- **Nie** rezygnujemy z rolling-session dla normalnej nawigacji (wybór: zachować
  rolling dla GET).
- **Nie** wprowadzamy server-side session store / rewokacji (pozostajemy przy
  stateless JWT).
- **Nie** dotykamy logiki `check-timer` (serwerowy timeout sesji egzaminu) — to
  osobny mechanizm domenowy, niezwiązany z cookie auth.
- **Nie** tworzymy dedykowanej trasy logout ani nie zawężamy matchera po ścieżce
  (odrzucone warianty projektowe).

## Podejście do implementacji

Przebudować `src/middleware.ts` z `export default auth(cb)` na zwykłą funkcję
middleware, która **deleguje do `auth()`-owiniętego handlera tylko dla
GET/HEAD**, a dla pozostałych metod zwraca `NextResponse.next()` bez wywołania
`auth()`. Eliminuje to rolling-refresh na żądaniu logout (POST), pozostawiając
delecję `signOut` jako jedyny `Set-Cookie`. Logika ochrony tras (redirect na `/`
dla niezalogowanych na trasach prywatnych) pozostaje identyczna dla GET — czyli
dla faktycznej nawigacji użytkownika.

## Faza 1: Naprawa middleware — pominięcie rolling-refresh dla żądań mutujących

### Przegląd

Middleware przestaje rolling-refresh'ować cookie sesji na żądaniach non-GET, w
tym na POST-cie wylogowania, tak by kasujący `Set-Cookie` z `signOut` był
autorytatywny na runtime Workers.

### Wymagane zmiany:

#### 1. Middleware — bramka po metodzie HTTP

**Plik**: `src/middleware.ts`

**Cel**: Uruchamiać wrapper `auth()` (a więc i jego rolling-refresh oraz
redirect ochronny) tylko dla żądań GET/HEAD. Dla pozostałych metod (POST i inne
mutujące, w tym Server Action logout) przepuszczać żądanie bez wywoływania
`auth()`, eliminując konkurencyjny świeży `Set-Cookie`.

**Kontrakt**: `export default` staje się zwykłą funkcją middleway o sygnaturze
zgodnej z Next.js (`(req: NextRequest, event: NextFetchEvent)`), która dla
GET/HEAD deleguje do zachowanego `auth((req) => {…})` handlera (ta sama logika
`PUBLIC_PATHS` + redirect co dziś), a dla innych metod zwraca
`NextResponse.next()`. `export const config.matcher` pozostaje bez zmian.
Niezmiennik: dla GET na trasie prywatnej bez sesji nadal następuje redirect na
`/`; dla GET zalogowanego użytkownika cookie nadal jest rolling-refresh'owane;
dla POST nie jest emitowany żaden cookie z middleware.

```ts
// Szkic kontraktu (implementator dobiera szczegóły do typów Next.js):
const authMiddleware = auth((req) => {
  /* obecna logika PUBLIC_PATHS + redirect */
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Tylko bezpieczne (nawigacyjne) metody przechodzą przez auth(), który
  // rolling-refresh'uje cookie. Żądania mutujące sesję (POST/Server Action,
  // w tym logout) pomijają auth(), by nie nadpisać delete z signOut.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return NextResponse.next();
  }
  return authMiddleware(req, event);
}
```

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów przechodzi: `npm run typecheck`
- Linting przechodzi: `npm run lint`
- Build produkcyjny przechodzi: `npm run build`
- Build workera przechodzi: `npm run build:worker`

#### Weryfikacja ręczna:

- Lokalny smoke (`npm run dev`): wylogowanie przekierowuje do `/`; wejście na
  trasę prywatną (np. `/dashboard`) bez sesji przekierowuje na `/`; zalogowana
  nawigacja działa.
- **Preview deploy (Workers, decydujący gate)**: na buildzie z `npm run preview`
  (workerd) lub na preview deploy — w DevTools/`wrangler tail` odpowiedź na
  wylogowanie zawiera **dokładnie jeden** `Set-Cookie` dla
  `__Secure-authjs.session-token`, i jest to **delete** (`Max-Age=0`), bez
  drugiego nagłówka ze świeżym tokenem.
- Po wylogowaniu i **ręcznym odświeżeniu** strony użytkownik pozostaje
  wylogowany; powrót na trasę prywatną przekierowuje na `/`.
- Brak regresji: ponowne zalogowanie działa; podczas zwykłej nawigacji (GET)
  cookie nadal jest odświeżane (`Expires` przesuwa się) — rolling-session
  zachowany.

**Uwaga implementacyjna**: Po przejściu weryfikacji automatycznej zatrzymaj się
i poczekaj na ręczne potwierdzenie inspekcji nagłówków na preview deploy
(reprodukcja prod-only) przed przejściem do Fazy 2.

---

## Faza 2: Odświeżenie dokumentacji po refaktorze warstwy DB

### Przegląd

Mechaniczne, niblokujące odświeżenie dokumentacji, by nie opisywała
nieistniejącego już wzorca DB-singletonu i odzwierciedlała `getDb()` per-request
oraz pooler w trybie transaction. Niezależne od Fazy 1 — może być wdrożone
osobno.

### Wymagane zmiany:

#### 1. Audyt i aktualizacja dokumentacji

**Pliki**: `README.md`, `AGENTS.md`, `CLAUDE.md` (oraz inne docs, jeśli audyt je
wykryje)

**Cel**: Usunąć/poprawić wszelkie opisy starego module-level singletonu
(`export const db` / `import { db }`) i opisać aktualny dostęp: fabryka
per-request `getDb()` (React `cache()`, workerd-safe), hardening połączenia
(`max:3, prepare:false, fetch_types:false, connect_timeout:10, idle_timeout:20`)
oraz pooler Supabase w **trybie transaction (port 6543)**, pod który dobrane
jest `prepare:false`.

**Kontrakt**: Po zmianie żaden plik docs nie odwołuje się do singletonu `db`;
opis warstwy DB (np. `README.md:123` „Drizzle client (server-only)" i sekcja
architektury ~`:130-136`) wymienia `getDb()` per-request jako jedyny wzorzec
dostępu. Brak zmian w kodzie — wyłącznie pliki dokumentacji. (Audyt: bieżący
grep nie wykrył odniesień do `import { db }`/`export const db` w `.md`, więc
zakres to potwierdzenie wyrównania + ewentualne dopisanie wzorca `getDb()`/
pooler tam, gdzie opis jest ogólnikowy.)

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Brak odniesień do starego singletonu:
  `grep -rniE "import \{ db|export const db" README.md AGENTS.md CLAUDE.md` nie
  zwraca trafień.
- Formatowanie docs przechodzi: `npm run format:check`

#### Weryfikacja ręczna:

- README/AGENTS/CLAUDE opisują `getDb()` per-request i pooler transaction-mode
  spójnie z `src/shared/lib/db.ts`.
- Brak sprzeczności między dokumentacją a faktycznym kodem warstwy DB i NextAuth
  (lazy factory).

**Uwaga implementacyjna**: Faza czysto dokumentacyjna — po przejściu weryfikacji
automatycznej wystarczy potwierdzenie spójności opisu z kodem.

---

## Strategia testowania

### Testy jednostkowe:

- Brak nowej logiki czysto-funkcyjnej do testów jednostkowych (zmiana dotyczy
  rozgałęzienia po metodzie HTTP w middleway, najlepiej weryfikowanego
  integracyjnie/E2E na właściwym runtime).

### Testy integracyjne / E2E:

- Lokalny E2E (Playwright na `next dev`) **nie odtworzy** bugu prod-only — nie
  należy traktować jego zieloności jako dowodu naprawy. Wartość: regresja
  funkcjonalna (logout przekierowuje, trasy chronione redirectują).
- Decydująca weryfikacja: inspekcja nagłówków `Set-Cookie` na buildzie workerd
  (`npm run preview`) lub preview deploy.

### Kroki testowania ręcznego:

1. `npm run preview` (workerd) — zaloguj się, otwórz DevTools → Network.
2. Kliknij „Wyloguj"; w odpowiedzi na żądanie logout sprawdź nagłówki
   `Set-Cookie` — ma być **jeden** delete dla `__Secure-authjs.session-token`
   (`Max-Age=0`), bez drugiego ze świeżym tokenem.
3. Po przekierowaniu **odśwież** stronę — użytkownik ma pozostać wylogowany.
4. Wejdź ręcznie na `/dashboard` — ma nastąpić redirect na `/`.
5. Zaloguj ponownie, klikaj po stronach (GET) — potwierdź, że cookie nadal się
   odświeża (rolling zachowany).

## Uwagi dotyczące wydajności

Brak implikacji wydajnościowych — bramka po metodzie HTTP to pojedyncze
porównanie stringa przed delegacją; eliminuje wręcz zbędny refresh-write na
żądaniach mutujących.

## Uwagi dotyczące migracji

Brak migracji danych. Po wdrożeniu istniejące sesje zachowują się normalnie;
pierwsze wylogowanie po deployu poprawnie skasuje cookie. Rollback =
przywrócenie poprzedniego `middleware.ts` (czysto kodowy, bez stanu).

## Otwarte ryzyka i założenia

- **Ochrona tras dla non-GET**: pominięcie `auth()` dla POST oznacza brak
  middleware-redirectu dla żądań mutujących na trasach prywatnych. Założenie:
  Server Actions / route handlery egzekwują auth po stronie serwera (`auth()` w
  RSC/akcjach), a ochrona nawigacyjna (GET) pozostaje. Ryzyko niskie; gdyby
  pojawił się chroniony endpoint POST zależny wyłącznie od middleware, wymagałby
  własnego sprawdzenia auth.
- **Atrybucja drugiego emitera**: rama oznacza WYSOKĄ pewność (dwa nagłówki w
  jednej odpowiedzi prod). Inspekcja nagłówków na preview w Fazie 1 jest
  ostatecznym potwierdzeniem, że po fixie zostaje tylko delete.
- **Reprodukcja na `npm run preview`**: zakładamy, że workerd lokalnie odtwarza
  kolejność scalania `Set-Cookie` jak prod; jeśli nie odtworzy bugu przed fixem,
  weryfikacją zastępczą jest preview deploy na Workers.

## Referencje

- Brief ramowy: `context/changes/fix-logout-session-persists/frame.md`
- Identyfikacja zmiany: `context/changes/fix-logout-session-persists/change.md`
- Pliki źródłowe: `src/middleware.ts:9,21`, `src/modules/auth/auth.ts:19,26`,
  `src/modules/auth/auth.config.ts:4`, `src/modules/auth/actions.ts:90-96`,
  `src/shared/components/Nav/NavLinks.tsx:51-55`, `src/shared/lib/db.ts`
- Powiązane: `context/changes/fix-db-issue/` (refaktor `getDb()`),
  `context/changes/check-timer/` (serwerowy timeout sesji egzaminu),
  `context/foundation/infrastructure.md:125`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz
> `references/progress-format.md`.

### Faza 1: Naprawa middleware — pominięcie rolling-refresh dla żądań mutujących

#### Automatyczne

- [ ] 1.1 Sprawdzanie typów przechodzi: `npm run typecheck`
- [ ] 1.2 Linting przechodzi: `npm run lint`
- [ ] 1.3 Build produkcyjny przechodzi: `npm run build`
- [ ] 1.4 Build workera przechodzi: `npm run build:worker`

#### Ręczne

- [ ] 1.5 Lokalny smoke: logout redirect na `/`, trasy prywatne redirectują,
      nawigacja działa
- [ ] 1.6 Preview deploy (workerd): odpowiedź logout ma dokładnie jeden
      delete-`Set-Cookie`, bez świeżego tokenu
- [ ] 1.7 Po logout + ręcznym odświeżeniu użytkownik pozostaje wylogowany; trasa
      prywatna redirectuje
- [ ] 1.8 Brak regresji: ponowne logowanie działa, rolling-refresh zachowany dla
      GET

### Faza 2: Odświeżenie dokumentacji po refaktorze warstwy DB

#### Automatyczne

- [ ] 2.1 Brak odniesień do starego singletonu w README/AGENTS/CLAUDE (`grep`)
- [ ] 2.2 Formatowanie docs przechodzi: `npm run format:check`

#### Ręczne

- [ ] 2.3 README/AGENTS/CLAUDE opisują `getDb()` per-request + pooler
      transaction-mode spójnie z `db.ts`
