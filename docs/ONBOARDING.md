# OSCE Triager — Przewodnik po codebase (onboarding)

> Przekrojowa, techniczna dokumentacja **flow** w kodzie. Pisana dla osoby,
> która zna **React, Node i TypeScript**, ale dopiero wchodzi w **Next.js (App
> Router)** — dlatego pojęcia specyficzne dla Next.js tłumaczę po drodze we
> wstawkach **📘 Next.js**. Czytaj sekcjami: każda opisuje jeden przepływ krok
> po kroku, z odnośnikami `plik:linia`, nazwami funkcji i komponentów.
>
> - **Repozytorium:** `osce-triager`
> - **Branch dokumentowany:** `check-timer`
> - **Commit:** `09bbc0b`
> - **Data:** 2026-06-18
> - **Stack:** Next.js 16 (App Router, React 19) · NextAuth v5 (beta) · Drizzle
>   ORM · Supabase Postgres · Cloudflare Workers (OpenNext) · dnd-kit ·
>   next-themes

---

## 0. Czym jest aplikacja (model domenowy w 30 sekund)

OSCE Triager to trenażer egzaminu medycznego OSCE. Użytkownik:

1. wybiera **scenariusz** (np. ból w klatce piersiowej, limit czasu w
   sekundach),
2. uruchamia **sesję** i widzi listę **badań diagnostycznych**,
3. **zleca** (triażuje) badania — przeciąga je z lewej kolumny do prawej,
4. sesja kończy się **ręcznie**, po **upływie czasu** (timer) lub **leniwie po
   stronie serwera** przy odczycie wygasłej sesji,
5. wynik to **Pozytywny** lub **Negatywny** — o przejściu decyduje wyłącznie to,
   czy zlecono **wszystkie badania krytyczne** danego scenariusza.

Cztery domenowe tabele: `scenario`, `diagnostic_test`, `test_classification`
(klucz odpowiedzi: kategoria badania w danym scenariuszu) oraz `session_result`

- `session_event` (przebieg i wynik sesji). Szczegóły schematu → sekcja 13.

---

## 1. Przepływy z perspektywy użytkownika (co widzi, co klika)

Zanim wejdziemy w kod, przejdźmy aplikację oczami użytkownika. Każdy „ekran"
mapuje się na konkretny plik strony (`page.tsx`) — w nawiasie podaję URL, żebyś
od razu wiązał obraz z route'em.

**A. Wejście i rejestracja**

1. Niezalogowany użytkownik trafia na **landing** (`/`). Górna nawigacja
   pokazuje „Zaloguj / Zarejestruj".
2. Klika **Zarejestruj** (`/register`), wpisuje email + hasło + powtórzenie
   hasła. Po sukcesie jest **automatycznie zalogowany** i przeniesiony na panel.
3. Alternatywnie **Zaloguj** (`/login`) — email + hasło → panel.
4. Jeśli niezalogowany spróbuje wejść wprost na `/dashboard` czy `/account/...`,
   zostaje odbity na landing (`/`). To pilnuje _middleware_ (sekcja 4).

**B. Rozegranie sesji OSCE — serce aplikacji**

5. Na **panelu** (`/dashboard`) widzi listę scenariuszy (kafelki). Każdy ma
   tytuł, opis i limit czasu. Klika **„Rozpocznij sesję"**.
6. Ląduje na **ekranie sesji** (`/dashboard/session/<id>`). Widzi:
   - **odliczający timer** (np. 5:00 → 4:59 …),
   - **lewą kolumnę** „Dostępne badania" (lista badań do zlecenia),
   - **prawą kolumnę** „Zlecone badania" (na start pusta).
7. **Triaguje**: przeciąga badanie z lewej na prawą (albo klika „Zleć" na
   karcie). Badanie przeskakuje na prawo i dostaje kolorowy **badge** oceny
   (poprawne / akceptowalne / zbędne). Może też poprzestawiać kolejność już
   zleconych badań przeciąganiem — to czysto wizualne, nic nie zmienia w wyniku.
8. Sesja może się skończyć na trzy sposoby:
   - **ręcznie** — klika „Zakończ sesję",
   - **timer dobiega 0:00** — kończy się sama,
   - **porzuca kartę** i wraca później — serwer wykrywa, że czas minął, i kończy
     sesję „leniwie" przy najbliższym odczycie (sekcja 10).
9. Po zakończeniu, **na tym samym ekranie** (bez przeładowania na inny URL)
   pojawia się **wynik**: „Pozytywny ✓" albo „Negatywny ✗" + ewentualna lista
   „Pominięte badania krytyczne". Jest link „Wróć do panelu".

   > Reguła wyniku w jednym zdaniu: **pominięcie choćby jednego badania
   > krytycznego = Negatywny**. Zlecenie zbędnych badań ani kolejność nie
   > szkodzą.

**C. Historia i wgląd w wyniki**

10. W nawigacji wchodzi w **Historia** (`/dashboard/history`) — lista
    zakończonych sesji z datą, czasem trwania i wynikiem. Może filtrować:
    wszystkie / pozytywne / negatywne (filtr działa od razu, bez przeładowania
    strony).
11. Klika **„Szczegóły"** przy sesji (`/dashboard/session/<id>/details`) — widzi
    listę badań w **kolejności zlecania** z oceną każdego.
12. Może **usunąć** sesję z historii (ikona kosza → modal potwierdzenia → znika
    z listy).

**D. Konto i RODO**

13. W **Ustawieniach konta** (`/account/settings`) może **zażądać usunięcia
    konta** — musi wpisać słowo `DELETE`. To **nie usuwa od razu** — planuje
    usunięcie za 30 dni i pokazuje datę czystki.
14. Dopóki te 30 dni nie minie, widzi sekcję **„Anuluj usunięcie"** — jedno
    kliknięcie cofa żądanie.
15. Po 30 dniach **nocny proces** (cron) faktycznie kasuje konto i wszystkie
    jego dane (sekcja 17).

To wszystko. Reszta dokumentu to ta sama podróż, ale „od spodu": jakie pliki,
funkcje i zapytania ją realizują.

---

## 2. Next.js dla osoby z React/Node — model mentalny (czytaj to najpierw)

Znasz React (komponenty, hooki, stan) i Node (serwer, HTTP, DB). Next.js App
Router miesza te dwa światy w sposób, który na początku jest mylący. Oto
minimum, które odblokuje czytanie reszty dokumentu.

### 2.1. Dwa rodzaje komponentów: serwerowe (RSC) i klienckie

W klasycznym React **każdy** komponent renderuje się w przeglądarce. W App
Routerze domyślnie jest odwrotnie:

- **React Server Component (RSC)** — komponent renderowany **na serwerze
  (Node)**. To **domyślny** typ każdego komponentu w `src/app/**`. Może być
  `async`, może bezpośrednio `await`-ować zapytania do bazy, czytać sekrety,
  ciasteczka. Jego kod **nigdy nie trafia do przeglądarki** — do przeglądarki
  idzie tylko wynikowy HTML/strumień. Dlatego w RSC wolno robić
  `const db = getDb(); await db.select(...)` — to bezpieczne, bo wykonuje się na
  serwerze.
- **Client Component** — to „normalny" React, jaki znasz: działa w przeglądarce,
  ma `useState`, `useEffect`, obsługę zdarzeń (`onClick`). Żeby komponent był
  kliencki, musi mieć na górze pliku dyrektywę **`'use client'`**.

  > 📘 **Next.js — `'use client'`:** ta dyrektywa to granica. Plik z
  > `'use client'` (i wszystko, co importuje) ląduje w bundlu przeglądarki. RSC
  > może renderować Client Component (przekazując mu propsy), ale **nie
  > odwrotnie** — Client Component nie może zaimportować i wyrenderować RSC
  > bezpośrednio (może go dostać jako `children`). Reguła kciuka w tym
  > projekcie: strony i layouty są RSC; interaktywne kawałki (formularze,
  > drag&drop, modale) są `'use client'`.

**Dlaczego to ważne dla auth:** w tym projekcie stan zalogowania czyta się **na
serwerze** przez `await auth()` w RSC. Nie ma `SessionProvider` ani
`useSession()` w przeglądarce (sekcja 1 i 19). Dla Ciebie, przyzwyczajonego do
„context z userem w React", to zmiana: tutaj user jest pobierany świeżo na
serwerze przy każdym renderze strony.

### 2.2. Trzy dyrektywy, które rozdzielają świat serwera i klienta

| Dyrektywa              | Gdzie                       | Znaczenie                                                                                                                                                                                                            |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'use client'`         | góra pliku komponentu       | „Ten kod jedzie do przeglądarki." Pozwala na hooki i zdarzenia.                                                                                                                                                      |
| `'use server'`         | góra pliku **albo** funkcji | „Te funkcje to **Server Actions** — wykonują się na serwerze, ale można je wołać z klienta jak zwykłą funkcję." (patrz 2.3)                                                                                          |
| `import 'server-only'` | import na górze modułu      | Strażnik: jeśli ten moduł kiedykolwiek trafi do bundla klienta, **build się wywali**. Używane w `queries.ts`, `validator.ts`, `finalize.ts`, żeby zapytania DB i sekrety fizycznie nie mogły wyciec do przeglądarki. |

### 2.3. Server Actions — zamiast pisania REST API

To prawdopodobnie największa nowość względem klasycznego „Node + REST".

W normalnym fullstacku robisz: formularz w React → `fetch('/api/login', {POST})`
→ endpoint Express → odpowiedź JSON. W App Routerze możesz to **pominąć**:

- piszesz zwykłą funkcję `async` w pliku z `'use server'` (np.
  `loginAction(prevState, formData)`),
- importujesz ją w komponencie klienckim i podpinasz pod formularz,
- Next.js **sam** tworzy ukryty endpoint HTTP, serializuje argumenty, woła
  funkcję na serwerze i zwraca wynik. Ty piszesz to jak wywołanie lokalnej
  funkcji.

  > 📘 **Next.js — Server Actions:** funkcja z `'use server'` to nie jest „kod,
  > który leci do przeglądarki". To kontrakt RPC: klient dostaje tylko _uchwyt_,
  > a ciało wykonuje się na serwerze. Dlatego w Server Action wolno robić
  > `await auth()`, `getDb()`, `bcrypt.compare()` — to wszystko Node. Argumenty
  > muszą być serializowalne (stąd `FormData` zamiast obiektów z metodami).

W tym projekcie **mutacje** (zmiana danych: login, rejestracja, zlecenie
badania, usunięcie sesji) to Server Actions w `modules/*/actions.ts`.
**Odczyty** to czyste funkcje w `modules/*/queries.ts`, importowane wprost przez
RSC (sekcja 3).

### 2.4. Hooki do formularzy z Server Actions

Dwa hooki Reacta 19, których pewnie jeszcze nie używałeś, bo są świeże i „grają"
właśnie z Server Actions:

- **`useActionState(action, initialState)`** — wiąże Server Action z formularzem
  i daje Ci `[state, formAction]`. `state` to **to, co zwróciła akcja** (np.
  obiekt błędów). `formAction` podpinasz pod `<form action={formAction}>`. Po
  submitcie React sam woła akcję, łapie wynik i re-renderuje z nowym `state`. To
  zastępuje ręczne `useState` na błędy + `onSubmit` + `fetch`.
- **`useFormStatus()`** — używany **wewnątrz** formularza (np. w przycisku
  submit), zwraca `{ pending }` — czy akcja właśnie leci. Stąd wzorzec
  `SubmitButton`, który sam się dezaktywuje podczas wysyłki.

### 2.5. Konwencje plików w App Routerze (folder = URL)

W App Routerze **struktura katalogów `src/app/` to mapa URL-i**. Nazwy plików są
zarezerwowane i mają znaczenie:

| Plik / folder                                | Znaczenie                                                                                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/dashboard/page.tsx`                     | strona pod URL `/dashboard`. **Tylko `page.tsx`** jest publicznie routowalny.                                                                                                                                  |
| `app/layout.tsx`                             | wspólna „ramka" (HTML, providery, nawigacja) opakowująca strony poniżej w drzewie. Root layout = `app/layout.tsx`.                                                                                             |
| `app/(auth)/...`                             | **route group** — nawias = folder organizacyjny, który **nie** pojawia się w URL. `(auth)/login/page.tsx` to nadal `/login`, ale ma własny `layout.tsx`. Służy do grupowania stron o wspólnym layoutcie.       |
| `app/dashboard/session/[sessionId]/page.tsx` | **dynamiczny segment** — `[sessionId]` to parametr URL. `/dashboard/session/abc` → `params.sessionId === 'abc'`.                                                                                               |
| `app/api/auth/[...nextauth]/route.ts`        | **route handler** (`route.ts`, nie `page.tsx`) — to klasyczny endpoint HTTP (eksportuje `GET`/`POST`). `[...nextauth]` to **catch-all** — łapie `/api/auth/signin`, `/api/auth/callback`, itd. jednym plikiem. |
| `middleware.ts`                              | kod uruchamiany **przed** każdym żądaniem pasującym do matchera (sekcja 4).                                                                                                                                    |

> 📘 **Next.js — `params` jest asynchroniczne:** w Next.js 16 `params` w stronie
> to `Promise` — stąd w kodzie zobaczysz `const { sessionId } = await params`.
> To nie błąd, to nowe API.

### 2.6. `redirect()` i `notFound()` działają przez rzucenie wyjątku

W RSC i Server Actions przekierowanie robisz wołając `redirect('/login')`, a 404
— `notFound()`. **Obie funkcje rzucają specjalny wyjątek**, który Next.js łapie
wyżej i zamienia na odpowiedź HTTP. Konsekwencja, która Cię zaskoczy:

- po `redirect()` kod **dalej się nie wykonuje** (jak po `throw`),
- w blokach `try/catch` wokół `signIn`/`signOut` trzeba ten wyjątek **przepuścić
  dalej** — stąd w kodzie powtarza się wzorzec
  `if (isRedirectError(e)) throw e;` (inaczej złapałbyś przekierowanie jak
  zwykły błąd i logowanie by „nie działało").

### 2.7. `revalidatePath()` — odświeżanie danych po mutacji

RSC renderują się na serwerze i Next.js **cache'uje** ich wynik. Gdy Server
Action zmieni dane (np. usuniesz sesję), trzeba powiedzieć Next.js: „dane pod
tym URL są nieaktualne, przy następnym wyświetleniu policz je od nowa". Robi to
**`revalidatePath('/dashboard/history')`**. Dzięki temu po usunięciu sesji lista
sama się odświeża — bez ręcznego `fetch` i bez `router.refresh()` w większości
przypadków.

### 2.8. Dwa środowiska uruchomieniowe: Edge i Node

To kluczowe dla zrozumienia, **dlaczego auth jest rozbity na dwa pliki**.

- **Node runtime** — pełny Node.js. Tu działają RSC, Server Actions, route
  handlery. Masz dostęp do `bcrypt`, sterownika Postgresa, wszystkiego.
- **Edge runtime** — okrojone, lekkie środowisko (oparte o API webowe, bez
  pełnego Node API), zaprojektowane pod szybki start na brzegu sieci.
  **`middleware.ts` działa na Edge.** Nie odpalisz tu `bcrypt` ani sterownika
  DB.

  > 📘 **Next.js — dlaczego to boli przy NextAuth:** middleware (Edge) musi
  > umieć sprawdzić _czy_ user jest zalogowany (odczyt tokenu JWT z cookie — to
  > lekkie), ale **nie może** dotykać DB ani bcrypt. Dlatego config NextAuth
  > jest **rozbity**: lekki `auth.config.ts` (Edge, bez DB) dla middleware +
  > pełny `auth.ts` (Node, z adapterem Drizzle i providerem Credentials) dla RSC
  > i route handlera. To nie jest dziwactwo tego projektu — to standardowy
  > wzorzec „split config" w NextAuth v5 (pełne omówienie → sekcja 6). (Uwaga: w
  > niektórych projektach Next.js 16 spotkasz `proxy.ts` jako node'owy
  > odpowiednik middleware — **tu go nie ma**, split jest zrobiony przez dwa
  > configi NextAuth, sekcja 4.)

### 2.9. Hosting na Cloudflare Workers (a nie klasyczny Node) — jedna ważna konsekwencja

Aplikacja jest budowana na Cloudflare Workers przez OpenNext. Workers to
środowisko izolatów (`workerd`), nie długo żyjący proces Node. Najważniejszy
skutek dla codebase: **nie wolno trzymać połączenia do bazy w module-level
singletonie**. Socket otwarty w obsłudze jednego żądania nie może być użyty w
innym. Dlatego klient DB jest tworzony **per żądanie** przez `getDb()`
(sekcja 18) — to nie jest „nieoptymalny kod", to wymóg platformy (był realnym
blockerem na produkcji).

---

## 3. Architektura warstwowa — najważniejsza konwencja kodu

Każdy moduł (`src/modules/<nazwa>/`) trzyma się tego podziału. To bezpośrednie
zastosowanie pojęć z sekcji 2.

| Warstwa            | Plik                          | Dyrektywa              | Rola                                                                                                                                       |
| ------------------ | ----------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mutacje**        | `actions.ts`                  | `'use server'`         | Server Actions (2.3) wołane z formularzy / klienta. Każda **sama** robi `await auth()`, sprawdza własność, woła zapis, `revalidatePath()`. |
| **Odczyty**        | `queries.ts`                  | `import 'server-only'` | Czyste funkcje read-only. Przyjmują jawny `userId` do scopingu własności. **RSC importują je bezpośrednio.**                               |
| **Rdzeń domenowy** | `finalize.ts`, `validator.ts` | `server-only`          | Logika bez auth (caller sprawdza własność): finalizacja sesji, scoring, walidacja, wygaśnięcie.                                            |
| **Prezentacja**    | `components/**`               | `'use client'` zwykle  | Komponenty React (2.1), każdy we własnym folderze `ComponentName/`.                                                                        |

**Reguła nadrzędna (z `context/foundation/lessons.md`):** strona RSC
(`page.tsx`) pobiera dane importując funkcję z `queries.ts` — **nigdy** nie
tworzymy REST route'a po to, by RSC zawołał sam siebie.

> Dlaczego to istotne i nieoczywiste z perspektywy „Node + REST": kusi, żeby
> zrobić `GET /api/sessions` i `fetch`-ować to z komponentu. Ale RSC **już jest
> na serwerze** — robienie z niego HTTP do samego siebie to zbędny round-trip i
> kłopot z przekazywaniem ciasteczka auth. Zamiast tego RSC po prostu woła
> `await getUserSessions(userId)` jak lokalną funkcję. REST endpoint
> (`route.ts`) tworzymy tylko dla _zewnętrznych_ konsumentów (jak
> `/api/auth/register`).

Dwie rzeczy, które łatwo pomylić:

- **Auth jest w pełni server-side** (patrz 2.1). Brak `SessionProvider`.
- „Session" ma **dwa znaczenia**: (a) sesja logowania NextAuth (JWT w cookie) i
  (b) sesja OSCE (`session_result`). Timeout (sekcja 10) dotyczy (b), nie (a).

---

## 4. Cykl żądania i ochrona route'ów

**Mechanizm: Edge `src/middleware.ts`** (czym jest Edge → 2.8; w repo **nie ma**
`proxy.ts`). Mechanika samego NextAuth — w sekcji 6.

> 📘 **Next.js — middleware:** to funkcja uruchamiana przez Next.js **przed**
> dotarciem żądania do strony, dla każdego URL pasującego do `config.matcher`.
> Zwraca `NextResponse` — może przepuścić, przepisać albo przekierować. Idealne
> miejsce na „bramkę logowania", bo działa zanim wyrenderuje się jakikolwiek
> RSC.

Krok po kroku (`src/middleware.ts`):

1. `const { auth } = NextAuth(authConfig)` — `middleware.ts:5`; używa lekkiego,
   Edge-bezpiecznego configu z `auth.config.ts` (puste `providers`, tylko
   `session.strategy:'jwt'`). To ten „lekki" config z 2.8 — potrafi tylko
   odczytać token z cookie, bez DB.
2. `PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth"]` —
   `middleware.ts:7`.
3. `export default auth((req) => {...})` — `middleware.ts:9-18`: `auth()`
   opakowuje handler i wstrzykuje `req.auth` (zdekodowana sesja albo `null`).
   Liczy `isPublic` (dokładne dopasowanie lub `startsWith(path + "/")`); jeśli
   `!req.auth && !isPublic` → `NextResponse.redirect(new URL("/", req.url))`.
   **Niezalogowany trafia na `/` (landing), nie na `/login`.**
4. `matcher` — `middleware.ts:20-22`: wszystko poza `_next/static`,
   `_next/image`, `favicon.ico`. Czyli `/dashboard/*`, `/account/*` są
   chronione.

**Split Edge/Node (dlaczego dwa pliki configu — szczegóły w 2.8 i 6):**

- `src/modules/auth/auth.config.ts` — lekki config dla **Edge** (middleware).
  Bez adaptera, bez bcrypt, bez DB. Zawiera callback `authorized`
  (`auth.config.ts:6-10`), ale w praktyce middleware robi własny redirect, więc
  ten callback jest tu _martwym kodem_.
- `src/modules/auth/auth.ts` — **pełny** config dla **Node** (RSC `auth()`,
  route `[...nextauth]`): DrizzleAdapter + bcrypt + provider Credentials.

> ⚠️ **Defense-in-depth:** middleware to pierwsza linia, ale to _nie_ jedyna
> ochrona. Każda Server Action i każde query **i tak** osobno woła `auth()` i
> sprawdza własność (`userId`). Middleware można obejść (np. bezpośrednie
> wywołanie Server Action), więc autoryzacja jest też przy każdej mutacji i
> odczycie. Nigdy nie polegaj wyłącznie na middleware.

---

## 5. Mapa katalogów

```
src/
├─ app/                       # App Router — folder = URL (sekcja 2.5)
│  ├─ (auth)/                 # route group: /login, /register (wspólny layout, nawias = nie w URL)
│  ├─ account/settings/       # ustawienia konta + usuwanie (RODO)
│  ├─ api/auth/               # route handlery: [...nextauth] (catch-all) + REST /register
│  ├─ dashboard/              # panel: lista scenariuszy, sesja, historia, szczegóły
│  └─ layout.tsx              # root layout: ThemeProvider + SceneBg + Nav
├─ modules/                   # logika domenowa, podzielona na moduły
│  ├─ auth/                   # auth.ts (Node), auth.config.ts (Edge), actions.ts, user.util.ts, components
│  ├─ session/               # actions.ts, queries.ts, finalize.ts, components (SessionView…)
│  └─ account/               # actions.ts, queries.ts (RODO)
├─ shared/
│  ├─ components/             # Button, Nav, ConfirmModal, Spinner, ThemeToggle, SceneBg
│  ├─ hooks/                  # useModal
│  └─ lib/                    # db.ts, schema.ts, validator.ts, seed.ts, seed-test.ts
└─ middleware.ts              # ochrona route'ów (Edge)
```

---

## 6. NextAuth (Auth.js v5) — czym jest, jak działa, jak go używamy

Auth flow w sekcjach 7–9 pokazuje _przepływy_. Ta sekcja tłumaczy _bibliotekę_
pod spodem — żeby te przepływy miały sens.

### 6.1. Czym jest NextAuth

**NextAuth** (od wersji 5 oficjalnie „Auth.js") to biblioteka uwierzytelniania
dla Next.js. Zamiast samemu pisać: obsługę logowania, podpisywanie i walidację
tokenów, ciasteczka sesji, ochronę CSRF, integrację z providerami (Google,
GitHub, e-mail, hasło) — dostajesz to z pudełka i konfigurujesz deklaratywnie.

W projekcie jest w `package.json` jako `next-auth@^5.0.0-beta.x` (stąd „v5
beta") + `@auth/drizzle-adapter` (adapter bazy). Wersja 5 mocno różni się od 4 —
dokumentacja w sieci do v4 często Cię zmyli, więc zwracaj uwagę na wersję.

### 6.2. Pięć pojęć, które musisz znać

| Pojęcie                | Co to                                                                                               | W tym projekcie                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Provider**           | „sposób logowania". Może być OAuth (Google…) albo `Credentials` (własny email+hasło).               | Jeden provider: **`Credentials`** (`auth.ts:37-63`) — logowanie hasłem.           |
| **Session strategy**   | gdzie żyje sesja: `'jwt'` (podpisany token w cookie) albo `'database'` (wiersz w tabeli `session`). | **`'jwt'`** (`auth.ts:26`). Sesja = zaszyfrowane cookie, **nie** wiersz w DB.     |
| **Callbacks**          | haki, którymi modyfikujesz token/sesję w locie.                                                     | `jwt` i `session` (`auth.ts:27-36`) — przepychają `user.id` do `session.user.id`. |
| **Adapter**            | warstwa łącząca NextAuth z bazą (zapis userów, kont, sesji).                                        | `DrizzleAdapter` (`auth.ts:20-25`) — mapuje na tabele z `schema.ts`.              |
| **Handlers / helpers** | wygenerowane funkcje: `auth()`, `signIn()`, `signOut()`, `handlers` (GET/POST).                     | eksport z `auth.ts:19`; route handler w `[...nextauth]/route.ts`.                 |

### 6.3. Jak działa logowanie „od środka" (mechanika)

Prześledźmy, co NextAuth robi sam, gdy zawołasz `signIn('credentials', {...})`:

1. **Wywołanie providera.** NextAuth woła Twoją funkcję `authorize(credentials)`
   z configu (`auth.ts:43-61`). Ty w niej sprawdzasz email+hasło w bazie i
   zwracasz obiekt usera (`{ id, email, name }`) albo `null` (= odrzuć).
2. **Budowa tokenu (callback `jwt`).** Po udanym `authorize` NextAuth tworzy
   token i przepuszcza go przez callback `jwt({ token, user })`. Tu dokładasz do
   tokenu, co chcesz mieć w sesji — u nas `token.sub = user.id`
   (`auth.ts:28-31`).
3. **Podpisanie i zapis w cookie.** Token jest **podpisany/zaszyfrowany**
   sekretem `AUTH_SECRET` i zapisany w ciasteczku `HttpOnly` (przeglądarka nie
   czyta go z JS). Przy strategii `jwt` **nic nie ląduje w bazie** — cała sesja
   to to cookie.
4. **Odczyt sesji (callback `session`).** Gdy później wołasz `auth()`, NextAuth
   odczytuje cookie, weryfikuje podpis, dekoduje token i przepuszcza go przez
   callback `session({ session, token })`. U nas: `session.user.id = token.sub`
   (`auth.ts:32-35`). Dlatego w całym kodzie masz dostępne `session.user.id`.
5. **Wylogowanie.** `signOut()` po prostu kasuje to ciasteczko. Brak stanu w DB
   = nie ma czego usuwać po stronie bazy.

> 📘 **JWT vs database — czemu to ważne:** przy strategii `jwt` serwer nie musi
> odpytywać bazy, żeby wiedzieć kim jesteś — wystarczy odczytać i zweryfikować
> cookie. To dlatego **middleware na Edge** (sekcja 4) potrafi sprawdzić
> zalogowanie bez dostępu do DB. Minus: token jest „zapieczętowany" w chwili
> logowania — jeśli zmienisz dane usera, token się nie zaktualizuje aż do
> kolejnego logowania (albo aż wygaśnie). Tu nieistotne, ale warto wiedzieć.

### 6.4. Jak NextAuth jest spięty w tym projekcie (pliki)

```
src/modules/auth/auth.config.ts   → lekki config (Edge): providers:[], session.strategy:'jwt', callback authorized
src/modules/auth/auth.ts          → pełny config (Node): spread auth.config + DrizzleAdapter + Credentials + callbacks jwt/session
                                     eksportuje: { handlers, auth, signIn, signOut }
src/app/api/auth/[...nextauth]/route.ts → export const { GET, POST } = handlers   (catch-all endpoint NextAuth)
src/middleware.ts                 → NextAuth(authConfig) → auth() jako bramka Edge (sekcja 4)
src/modules/auth/actions.ts       → loginAction/registerAction/logoutAction wołają signIn/signOut (sekcje 7–9)
```

Najważniejsze niuanse implementacyjne (wszystkie w `auth.ts:15-64`):

- **Config to funkcja (fabryka), nie obiekt:** `NextAuth(() => ({...}))`
  (`auth.ts:15-18`). Powód: `DrizzleAdapter(getDb())` musi dostać klienta DB
  **per żądanie** (sekcja 2.9 / 18). Gdyby config był statycznym obiektem,
  `getDb()` wykonałby się raz przy ładowaniu modułu (singleton) i padłby na
  Workers. Fabryka odracza to do momentu obsługi żądania.
- **Split Edge/Node** (sekcja 4): `auth.config.ts` jest celowo „głupi" (bez
  adaptera/bcrypt/DB), żeby dało się go zaimportować na Edge w middleware;
  `auth.ts` rozszerza go o ciężkie rzeczy i działa tylko w Node (RSC, Server
  Actions, route handler).
- **Adapter obecny, ale tabela `session` nieużywana:** `DrizzleAdapter`
  (`auth.ts:20-25`) rejestruje tabele
  `user`/`account`/`session`/`verificationToken`. Przy strategii `jwt` adapter
  używa głównie `user` (i `account` pod OAuth) — a `session`/`verificationToken`
  zostają puste (sekcja 21). Adapter wymaga, by istniały, więc je trzymamy.
- **Provider Credentials** (`auth.ts:37-63`): definiuje pola (email, password) i
  funkcję `authorize` z weryfikacją bcrypt — szczegóły w sekcji 8.

### 6.5. Gdzie w kodzie „dotykasz" NextAuth

- **`auth()`** — wywoływane w **RSC** (`dashboard/page.tsx`, `Nav.tsx`,
  `account/settings/page.tsx`…) i w **Server Actions** (każda akcja na starcie),
  żeby dostać `session.user.id`. To jedyny sposób na „kto jest zalogowany" —
  serwerowy, bez kontekstu w przeglądarce.
- **`signIn('credentials', {...})`** — w `loginAction` i `registerAction`
  (auto-login po rejestracji), sekcje 7–8.
- **`signOut({...})`** — w `logoutAction`, sekcja 9.
- **`handlers` (GET/POST)** — wystawione w `[...nextauth]/route.ts`; obsługują
  wewnętrzne endpointy NextAuth (callback, csrf, signout…), których normalnie
  nie wołasz ręcznie.

### 6.6. Zmienne środowiskowe NextAuth

- **`AUTH_SECRET`** — sekret do podpisu/odszyfrowania JWT. Bez niego sesje nie
  działają. Trzymany w env/sekrecie (lokalnie `.dev.vars`/`.env*`, na prod w
  sekretach Workera).
- **`AUTH_URL`** i **`AUTH_TRUST_HOST=true`** — publiczne `vars` w
  `wrangler.jsonc` (sekcja 20). `AUTH_TRUST_HOST` mówi NextAuth, by ufał
  nagłówkowi hosta za proxy Cloudflare (inaczej callbacki URL-i mogą się sypać
  na produkcji).

---

## 7. Flow: REJESTRACJA

Dwa wejścia zbiegają się na funkcji `registerUser()`.

### 7a. Ścieżka UI (Server Action) — główna

1. **Formularz** — `RegisterForm.tsx:9-31` (`'use client'`, bo to interaktywny
   komponent z 2.1): `useActionState(registerAction, null)` (patrz 2.4) wiąże
   Server Action z `<form action={...}>`. Natywny `onSubmit` (`:13-28`) robi
   tylko kliencki check `password === confirmPassword` — `confirmPassword`
   celowo nigdy nie idzie na serwer (to czysto kosmetyczna walidacja UX).
2. **Server Action** `registerAction(prevState, formData)` —
   `src/modules/auth/actions.ts:51-88`. `prevState` to poprzedni wynik z
   `useActionState`; `formData` to natywne `FormData` z pól formularza.
3. **Walidacja inline** (bez Zod) — `actions.ts:60-67`: email musi zawierać `@`,
   hasło `>= 8` znaków. Zwraca `{ errors }` — to trafia z powrotem do `state` w
   `useActionState` i renderuje komunikaty pod polami.
4. `registerUser(email, password)` — `actions.ts:70` →
   `src/modules/auth/user.util.ts:10-46`:
   - re-walidacja (`INVALID_INPUT` / `INVALID_EMAIL` / `WEAK_PASSWORD`,
     `:14-24`),
   - `normalizeEmail` (trim + lowercase) — `user.util.ts:6-8`,
   - check duplikatu `db.query.users.findFirst` → rzuca `EMAIL_TAKEN`
     (`:30-36`),
   - **bcrypt hash, cost 12** — `user.util.ts:38` (to czysty Node, działa bo
     jesteśmy w Server Action / Node runtime, nie na Edge),
   - **insert** `db.insert(users).values({...}).returning(...)` — `:40-43`.
5. **Auto-login + redirect** — `actions.ts:79`:
   `signIn('credentials', { email, password, redirectTo: '/dashboard' })`.
   `signIn` rzuca redirect (patrz 2.6), więc tuż obok jest
   `if (isRedirectError(e)) throw e` (`:81`) — żeby przekierowanie nie zostało
   połknięte jako błąd.

### 7b. Ścieżka REST

`POST /api/auth/register` — `src/app/api/auth/register/route.ts:4-43`: to
**route handler** (2.5) — klasyczny endpoint dla zewnętrznych klientów. Parsuje
JSON, woła ten sam `registerUser()` (`:15`), mapuje rzucone błędy na kody HTTP
(`EMAIL_TAKEN`→409, `INVALID_*`/`WEAK_PASSWORD`→400, sukces→201). **Bez**
auto-loginu — to tylko utworzenie usera.

> 🔎 Walidacja jest ręczna (`if`-y) w obu miejscach — w projekcie **nie ma**
> Zod. Jeśli przychodzisz z ekosystemu, gdzie Zod jest standardem, nie szukaj
> go.

---

## 8. Flow: LOGOWANIE

1. **Formularz** — `LoginForm.tsx:9-13`: `useActionState(loginAction, null)`
   (2.4).
2. **Server Action** `loginAction` — `actions.ts:23-49`: walidacja inline (email
   z `@`, hasło niepuste, `:32-37`) →
   `signIn('credentials', { email, password, redirectTo: '/dashboard' })`
   (`:42`). Błąd inny niż redirect → `_form: 'Nieprawidłowy email lub hasło'`
   (`:45`) — wraca do `state` i renderuje się nad formularzem.
3. **Provider Credentials `authorize()`** — `src/modules/auth/auth.ts:43-61`. To
   funkcja NextAuth, którą wywołuje on sam po `signIn('credentials', ...)`
   (patrz 6.3 krok 1). Tu weryfikujemy hasło:
   - null-guard na email/hasło (`:44`),
   - `db.query.users.findFirst` po `normalizeEmail(email)` (`:46-49`),
   - odrzuć, jeśli brak `hashedPassword` (`:51`),
   - **`bcrypt.compare`** (`:53-56`), odrzuć jeśli niezgodne (`:58`),
   - zwróć `{ id, email, name }` (`:60`) — to staje się „user" sesji.
4. **Callbacks** — `auth.ts:27-36` (mechanika w 6.3 kroki 2 i 4):
   - `jwt({ token, user })` wkłada `user.id` w `token.sub` (`:28-31`) — token
     JWT jest zaszyfrowany w cookie,
   - `session({ session, token })` kopiuje `token.sub` → `session.user.id`
     (`:32-35`).

   > 📘 Po co to: domyślnie NextAuth nie wystawia `id` usera w `session.user`.
   > Te dwa callbacki przepychają `id` z bazy → token → sesję, dzięki czemu w
   > całym kodzie możesz robić `const { user } = await auth()` i mieć `user.id`
   > do scopingu zapytań. To `session.user.id` jest używane _wszędzie_ w akcjach
   > i queries do sprawdzania własności.

5. **Redirect** na `/dashboard` (rzucany przez NextAuth, przepuszczany jak w
   2.6).

**Konfiguracja NextAuth** (`auth.ts:19-64`) — rzeczy nieoczywiste (pełne
omówienie w sekcji 6):

- `NextAuth(() => ({...}))` — config jest **funkcją (fabryką)**, nie statycznym
  obiektem (`auth.ts:15-18`). Powód: dzięki temu `getDb()` jest wywoływany
  per-request, a nie raz przy starcie modułu (patrz 2.9, 6.4 i sekcja 18).
- `session.strategy: 'jwt'` (`auth.ts:26`). Czyli stan sesji żyje w **podpisanym
  cookie (JWT)**, nie w tabeli w bazie. **`maxAge` nie ustawione** → domyślne 30
  dni NextAuth. (To inna „sesja" niż timeout OSCE — patrz 3 i 10.)
- `DrizzleAdapter(getDb(), {...})` (`auth.ts:20-25`) — adapter łączy NextAuth z
  bazą. Przy strategii JWT tabela `session` **nie jest** używana jako stan auth,
  ale adapter wymaga, by istniała (np. pod przyszłe providery OAuth).
- Handlery: `export const { GET, POST } = handlers` —
  `src/app/api/auth/[...nextauth]/route.ts:1-3`. To catch-all route (2.5), który
  NextAuth obsługuje w całości (signin, callback, signout, csrf…).

---

## 9. Flow: WYLOGOWANIE

1. `logoutAction()` — `actions.ts:90-96`: woła `signOut({ redirectTo: '/' })`
   (`:92`), przepuszcza redirect (`:94`, patrz 2.6).
2. **UI:** `<Button formAction={logoutAction}>` w gołym `<form>` —
   `src/shared/components/Nav/NavLinks.tsx:51-55` (etykieta „Wyloguj").

   > 📘 `formAction` na przycisku to natywna własność HTML, którą Next.js
   > podłącza pod Server Action — pozwala mieć kilka akcji w jednym formularzu
   > albo akcję bez `useActionState`, gdy nie potrzebujesz wyniku.

3. Co czyści sesję: `signOut` (przy JWT) usuwa cookie z tokenem (6.3 krok 5).
   **Brak** usuwania wiersza w DB — bo przy strategii JWT tabela `session` nie
   trzyma stanu auth (patrz 6.2, 8).

---

## 10. Flow: START SESJI OSCE

1. **Dashboard (RSC)** — `src/app/dashboard/page.tsx:8-11`: `DashboardPage` to
   `async` server component (2.1). Uwierzytelnia (`await auth()`), ładuje
   scenariusze przez `getScenarios()` — bez żadnego `fetch`, bezpośrednie
   wołanie funkcji z `queries.ts` (sekcja 3).
2. `getScenarios()` — `src/modules/session/queries.ts:15-18`: `SELECT`
   wszystkich `scenarios` wg `createdAt`.
3. Render — `dashboard/page.tsx:17-25`: każdy scenariusz jako `ScenarioCard`
   (RSC przekazuje propsy do komponentu, który jest kliencki bo ma przycisk).
4. **Klik „Rozpocznij sesję"** — `ScenarioCard.tsx:28-31` (`'use client'`):
   `handleStart` woła Server Action `startSessionAction(id)` (wywołanie z
   klienta, wykonanie na serwerze — 2.3).
5. `startSessionAction` — `src/modules/session/actions.ts:26-52`: `auth()` →
   sprawdza istnienie scenariusza → **insert jednego wiersza `sessionResults`**
   z `outcome:'in_progress'`, `isFailed:false`, `userId`, `scenarioId`
   (`startedAt` = teraz domyślnie, `id` = UUID). **Brak** wierszy
   `sessionEvents` na tym etapie — one powstają dopiero przy zlecaniu badań.
6. Zwraca `{ sessionId }`; karta robi
   `router.push('/dashboard/session/${sessionId}')` — `ScenarioCard.tsx:37`
   (klienckie przejście do dynamicznego route'u z 2.5).

---

## 11. Flow: RENDER I PRZEBIEG SESJI (triage)

### 11a. Ładowanie strony sesji (RSC)

`src/app/dashboard/session/[sessionId]/page.tsx` — `[sessionId]` to dynamiczny
segment (2.5):

1. `await params` (bo `params` jest async w Next.js 16, patrz 2.5), `auth()`,
   `getSessionById(sessionId, userId)` — `:23-29`. Query filtruje po `id` **i**
   `userId`; `null` → `notFound()` (rzuca 404, patrz 2.6) — `queries.ts:20-30`.
   Filtrowanie po `userId` to ochrona własności: nie podejrzysz cudzej sesji
   znając jej `id`.
2. `getScenarioById` po `timeLimitSeconds` — `:31-32`.
3. **Leniwa finalizacja** (sekcja 12, ścieżka B) — `:41-47`, **przed** odczytem
   eventów. To kluczowy moment: jeśli ktoś wszedł na wygasłą sesję, serwer
   kończy ją tutaj, zanim cokolwiek wyrenderuje.
4. Równoległe ładowanie: `getDiagnosticTests()`,
   `getTestClassificationsByScenario(scenarioId)`,
   `getSessionEvents(sessionId, userId)` — `:49-53` (`queries.ts:42-74`).
5. Budowa mapy `classifications` (`testId → kategoria`) i `initialEvents`
   (`{testId, validatorResult}`) — `:55-63`. Mapa pozwala kliencko renderować
   badge bez kolejnego zapytania.
6. Render `<SessionView>` z `sessionId`, `timeLimitSeconds`, `startedAt` (jako
   ISO string — bo propsy z RSC do klienta muszą być serializowalne, `Date`
   przechodzi jako string), `tests`, `classifications`, `initialEvents`,
   `sessionOutcome` — `:65-75`.

### 11b. SessionView — orkiestracja kliencka

`src/modules/session/components/SessionView/SessionView.tsx` (`'use client'` —
bo to serce interaktywności: drag&drop, timer, stan):

- Seeduje `orderedTests` z `initialEvents` (bez `critical_miss`) — `:53-69`;
  `remainingSeconds` liczy z różnicy „teraz − `startedAt`" — `:73-78`. Czyli
  timer jest odtwarzany ze stanu serwera, a nie zaczyna od zera przy każdym
  wejściu.
- Dwie kolumny: lewa = `unorderedTests` jako `DraggableTestCard` (`:261-275`);
  prawa = `orderedTests` w `SortableContext`/`verticalListSortingStrategy` jako
  `SortableTestCard` (`:277-298`). `DragOverlay` pokazuje zwykły `TestCard` w
  trakcie ciągnięcia (`:301-303`).

  > 📘 **dnd-kit:** to biblioteka drag&drop. `DndContext` opakowuje obszar,
  > `useDraggable` czyni element ciągnialnym, `useSortable` + `SortableContext`
  > obsługują listę z przestawianiem. Nie musisz jej znać w detalach — ważne, że
  > „upuszczenie" badania wpada do jednego handlera `handleDragEnd`.

- Hierarchia kart: `DraggableTestCard` (`useDraggable`,
  `data:{source:'available'}`) → renderuje `TestCard`; `SortableTestCard`
  (`useSortable`, `data:{source:'ordered'}`); `TestCard` pokazuje przycisk
  „Zleć" albo badge wyniku (`TestCard.tsx:28-47`). Pole `data.source` mówi
  handlerowi, z której kolumny pochodzi przeciągany element.

### 11c. Dwa gesty drag, jeden handler `handleDragEnd`

**A. Zlecenie badania (lewa → prawa) — właściwy triage:**

1. `handleDragEnd` czyta `active.data.current.source`; jeśli `'available'` →
   `handleSelectTest(id, name)` — `SessionView.tsx:171-188`. (Klik „Zleć" robi
   to samo — `:270`, `TestCard.tsx:41`.)
2. `handleSelectTest` (guard: jedno żądanie naraz, sesja `in_progress`) woła
   `selectTestAction(sessionId, testId)` — `:141-146`.
3. `selectTestAction` — `actions.ts:59-125`: auth + własność → odrzuć nie-
   `in_progress` → **server-side deadline guard** (`isSessionExpired`,
   sekcja 12) → odrzuć duplikat → walidacja, że badanie należy do scenariusza →
   `validateTestSelection` liczy `{category, validatorResult}` → **insert
   `sessionEvents`** `{sessionId, testId, validatorResult}` (`selectedAt` =
   teraz).
4. Optymistyczny UI: po sukcesie klient dopisuje badanie do `orderedTests`
   (`:149-159`). „Optymistyczny" = UI aktualizuje się od razu, ufając, że serwer
   też się zgodzi (a guardy w akcji pilnują, by niespójność nie przeszła do DB).

**B. Reorder w prawej kolumnie — TYLKO kosmetyka:**

1. W `handleDragEnd`, gdy `source === 'ordered'` i cel różny → `applyReorder` —
   `SessionView.tsx:190-194`.
2. `applyReorder` to lokalne `arrayMove` na `orderedTests` —
   `SessionView.utils.ts:22-31`. **Żadnej akcji serwerowej, nic nie jest
   utrwalane.**

> 🔑 **Brak kolumny kolejności / ordinala w bazie.** Utrwalane jest tylko
> _które_ badania zlecono (po jednym wierszu `sessionEvents`, kolejność wynika z
> `selectedAt`). Scoring jest niezależny od kolejności. Przestawianie już
> zleconych badań nie wpływa na wynik — to czysto wizualne.

---

## 12. Flow: FINALIZACJA (ręczna, timer, leniwa serwerowa)

Wszystkie trzy ścieżki zbiegają się na jednym, idempotentnym rdzeniu
`finalizeSession`. „Idempotentny" = można go bezpiecznie zawołać wielokrotnie,
wynik się nie zdublu­je — to ważne, bo trzy różne ścieżki mogą trafić w tę samą
sesję niemal jednocześnie.

### Rdzeń: `finalizeSession(sessionRow)` — `src/modules/session/finalize.ts:24-130`

1. Jeśli sesja już terminalna → zwróć aktualny `outcome` + istniejące
   `critical_miss` (idempotencja) — `:32-48`.
2. Wczytaj `sessionEvents`, zbuduj `orderedTestIds` (bez `critical_miss`) —
   `:50-57`.
3. Wczytaj klasyfikacje scenariusza (klucz odpowiedzi) — `:59-67`.
4. `evaluateSessionEnd(orderedTestIds, classifications)` →
   `{irreversibleFail, skippedCritical}` — `:69-72`.
5. **Atomowy claim:**
   `UPDATE sessionResults SET outcome=…, isFailed, completedAt=now WHERE id=… AND outcome='in_progress'`
   — `:76-89`.

   > 📘 **Dlaczego `WHERE … AND outcome='in_progress'` jest sprytne:** to
   > wzorzec „compare-and-set" na poziomie SQL. Jeśli dwie ścieżki (np. timer
   > klienta i leniwa finalizacja serwera) wykonają ten UPDATE równocześnie,
   > **tylko pierwsza** trafi w wiersz, który jeszcze ma `in_progress`. Druga
   > dostanie 0 zmienionych wierszy i zwróci już ustawiony stan (`:91-113`).
   > Baza danych pełni tu rolę zamka — bez transakcji i blokad aplikacyjnych. To
   > eliminuje podwójną finalizację (race condition).

6. Jeśli pominięto krytyczne → **insert `critical_miss`** `sessionEvents` —
   `:115-123`.
7. `finalizeSession` **nie robi auth** — to świadome: caller (akcja albo query)
   sprawdził już własność. Dzięki temu ten sam rdzeń obsługuje i write-path, i
   read-path.

### Ścieżka 1 — finalizacja ręczna

1. Klik „Zakończ sesję" → `handleEndSession` (guard `endingRef` przeciw
   podwójnemu klikowi) → `endSessionAction(sessionId)` — `SessionView.tsx:243`,
   `:122-139`.
2. `endSessionAction` — `actions.ts:132-149`: auth + własność →
   `finalizeSession`.
3. **Bez redirectu na inny URL.** `SessionView` przełącza się na ekran wyniku
   **w miejscu** (zmiana stanu klienta, nie nawigacja): „Sesja zakończona",
   „Wynik: Pozytywny ✓ / Negatywny ✗", lista „Pominięte badania krytyczne", link
   „Wróć do panelu" — `SessionView.tsx:208-234`.

### Ścieżka 2 — timer dochodzi do 0:00 (klient)

1. Interwał 1 s zmniejsza `remainingSeconds` gdy `in_progress` —
   `SessionView.tsx:107-113` (`useEffect` z `setInterval`, sprzątany przy
   odmontowaniu — klasyczny React).
2. Efekt reagujący na `remainingSeconds === 0` woła `handleEndSession()` —
   `:115-120` — czyli tę samą ścieżkę co ręczna. Otwarta karta auto-finalizuje
   się o 0:00.

### Ścieżka 3 — leniwa finalizacja serwerowa (branch `check-timer`)

Zamyka ryzyko: użytkownik **zamyka kartę** (timer kliencki nigdy nie odpali)
albo wraca do wygasłej sesji. Nie ma wtedy żadnego klienta, który by ją
zakończył — więc **serwer robi to przy każdym odczycie**. Trzy ścieżki odczytu
re-sprawdzają i finalizują:

1. **Loader sesji** — `[sessionId]/page.tsx:41-47`: jeśli
   `isSessionExpired(startedAt, timeLimitSeconds)` → `finalizeSession` **przed**
   odczytem eventów, więc `critical_miss` od razu widać na ekranie wyniku.
2. **Guard zlecenia** — `selectTestAction` (`actions.ts:82-89`): re-sprawdza
   wygaśnięcie i zwraca `'Session time expired'` — ubija exploit „wróć na starą
   kartę i klikaj dalej po czasie".
3. **Odczyty historii** — `getUserSessions` (`queries.ts:82-100`) i
   `getSessionDetails` (`queries.ts:140-161`): finalizują porzucone, wygasłe
   sesje zanim opuszczą stan `in_progress`, żeby pojawiły się w historii jako
   zakończone.

`isSessionExpired(startedAt, timeLimitSeconds, now, grace)` —
`src/shared/lib/validator.ts:54-62`: zwraca `true` gdy
`elapsed > timeLimitSeconds + EXPIRY_GRACE_SECONDS`.
**`EXPIRY_GRACE_SECONDS = 3`** (`validator.ts:46`) — margines serwerowy na
rozjazd zegarów: klient kończy dokładnie o 0:00, serwer toleruje 3 s, żeby
ostatni legalny klik tuż przed czasem nie został odrzucony przez różnicę zegara
klient/serwer.

> Mentalnie: ścieżki 1 i 2 to „klient grzecznie kończy sesję", ścieżka 3 to
> „serwer nie ufa, że klient w ogóle istnieje". Razem gwarantują, że żadna sesja
> nie zostanie wiecznie `in_progress` po czasie — niezależnie od tego, co zrobi
> przeglądarka.

---

## 13. Scoring — zasady przejścia (prosty język)

Cztery kategorie badania (`TestCategory`, `validator.ts:3-7`): `critical`,
`optimal`, `acceptable`, `unnecessary`.

- **Feedback per badanie** (`validateTestSelection` / `CATEGORY_TO_RESULT`,
  `validator.ts:25-38`): `critical`/`optimal`→`correct`, `acceptable`→
  `suboptimal`, `unnecessary`→`unnecessary`. Nieznane badanie → `unnecessary`.
  To steruje tylko kolorowymi badge'ami na kartach (`TestCard.tsx:15-20`) —
  **nie** decyduje o przejściu.
- **Werdykt** (`evaluateSessionEnd`, `validator.ts:64-73`): weź zbiór wszystkich
  badań `critical` w scenariuszu; te, których user **nie** zlecił, to
  `skippedCritical`. `irreversibleFail = skippedCritical.length > 0`.
- **Zatem:**
  - **Negatywny** (`isFailed=true`) ⇔ pominięto **co najmniej jedno** badanie
    krytyczne. To jedyny powód porażki.
  - **Pozytywny** ⇔ zlecono **każde** badanie krytyczne. Zlecanie zbędnych
    badań, wybór `acceptable` zamiast `optimal` ani kolejność **nie** powodują
    porażki — wpływają tylko na badge'e.
- Każde pominięte krytyczne badanie jest zapisywane jako event `critical_miss` i
  pokazywane jako „Pominięte badania krytyczne" — `finalize.ts:115-123`,
  `SessionView.tsx:220-229`.

---

## 14. Flow: HISTORIA SESJI

1. **RSC** `/dashboard/history` — `src/app/dashboard/history/page.tsx`: `auth()`
   → brak id ⇒ `redirect('/login')` (`:8-9`); `getUserSessions(userId)` (`:11`).
2. `getUserSessions(userId)` — `queries.ts:76-119`:
   - **leniwa finalizacja** wygasłych `in_progress` (`:82-100`, patrz 12),
   - **select główny**: `sessionResults ⋈ scenarios`,
     `WHERE userId AND outcome != 'in_progress'`, `ORDER BY completedAt DESC`
     (`:102-118`). Własność wymuszona w `WHERE` — query nigdy nie zwróci cudzych
     sesji.
3. Strona filtruje do `completedAt != null` i mapuje (`:12-20`); pusto → „Brak
   zakończonych sesji.", inaczej `<HistoryFilter sessions={completed} />`.
4. **`HistoryFilter`** (`'use client'`) — `HistoryFilter.tsx`: filtr czysto
   kliencki `all | positive | negative` (`useState`, `:24-27`) — **nie** query
   param, nie ponowne zapytanie. Dane przyszły raz z serwera, filtr tylko
   ukrywa/pokazuje. Renderuje `<HistoryCard>` per pozycja.
5. **`HistoryCard`** — `HistoryCard.tsx`: liczy czas trwania mm:ss
   (`completedAt - startedAt`, `:23-28`), badge wyniku, `<DeleteSessionButton>`
   (`:39-43`) i `<Link href="/dashboard/session/${id}/details">` „Szczegóły".

   > 📘 `<Link>` z `next/link` to klienckie przejście (bez pełnego przeładowania
   > strony) + prefetch — odpowiednik `<a>`, ale w obrębie SPA-owej nawigacji
   > App Routera.

---

## 15. Flow: SZCZEGÓŁY SESJI

1. **RSC** `/dashboard/session/[sessionId]/details` — `details/page.tsx`:
   `await params` (`:38`), `auth()` → brak ⇒ `redirect('/login')` (`:40-41`),
   `getSessionDetails(sessionId, userId)` (`:43`). `null` ⇒ `notFound()`
   (`:44`).

   > 🔒 Sprytne pod kątem bezpieczeństwa: `getSessionDetails` filtruje po `id`
   > **i** `userId`, więc cudza sesja zwróci `null` → `notFound()` (404).
   > Użytkownik nie rozróżni „nie istnieje" od „nie należy do ciebie" — brak
   > wycieku informacji.

2. `getSessionDetails` — `queries.ts:135-209`: leniwa finalizacja (`:140-161`,
   p.12) → wiersz sesji `WHERE id AND userId AND outcome != 'in_progress'`
   (`:163-180`) → eventy `sessionEvents ⋈ diagnosticTests`
   `ORDER BY selectedAt ASC` (kolejność zlecania, `:184-194`).
3. Render — `details/page.tsx:46-97`: link powrotu do historii, badge wyniku,
   data, czas (`formatDuration`, `:22-31`), oraz `<ol>` „Wybrane badania" z
   etykietą/kolorem wyniku per badanie (`VALIDATOR_LABELS`/`VALIDATOR_CLASS`,
   `:8-20`).

---

## 16. Flow: USUWANIE SESJI

1. **`DeleteSessionButton`** (`'use client'`) — `DeleteSessionButton.tsx`:
   `useModal()` (`:21`), `useTransition` (`:22`).

   > 📘 **`useTransition`** to hook Reacta 19:
   > `const [isPending, startTransition] = useTransition()`. Owijasz w
   > `startTransition(...)` wywołanie Server Action; `isPending` mówi, czy trwa
   > — bez ręcznego `useState(loading)`. Dezaktywujesz nim przyciski na czas
   > wysyłki.

2. Ikona kosza `aria-label='Usuń sesję'` → `open` (`:43-50`); renderuje
   `<ConfirmModal>` (`:51-59`).
3. `handleConfirm` (`:25-34`): `startTransition` →
   `await deleteSessionAction(sessionId)`; błąd → stan błędu, sukces →
   `close()`.
4. **`useModal`** — `src/shared/hooks/useModal.ts:1-15`: trywialny
   `useState(false)`
   - `open`/`close`. Zwykły custom hook, nic next-specyficznego.
5. **`ConfirmModal`** — `ConfirmModal.tsx`: `createPortal` do `document.body`
   (`:31,66`) — renderuje modal poza drzewem rodzica, żeby uniknąć problemów z
   `overflow`/`z-index`; `role='dialog'`, `aria-modal`, przyciski disabled przy
   `isPending`.
6. **Server Action** `deleteSessionAction(sessionId)` — `actions.ts:156-171`:
   auth (`:159-160`) → `getSessionById(sessionId, userId)` własność (`:163`) →
   guard `outcome === 'in_progress'` ⇒ „Cannot delete an active session"
   (`:165-166`) → `deleteSessionById(sessionId, userId)` (`queries.ts:121-133`,
   `DELETE … WHERE id AND userId`) → **`revalidatePath('/dashboard/history')`**
   (`:169`, patrz 2.7 — to powoduje, że lista odświeży się sama). **Bez
   redirectu** — modal się zamyka, a zrewalidowana lista re-renderuje bez
   usuniętej pozycji. Dzieci `sessionEvents` znikają przez kaskadę FK w bazie.

---

## 17. Flow: USUWANIE KONTA (RODO) + anulowanie + nocny cron

> To **miękkie, zaplanowane** usunięcie z 30-dniowym oknem karencji, **realnie
> wymuszane** nocnym cronem GitHub Actions (nie Cloudflare). Czyli: kliknięcie
> „usuń konto" _planuje_ usunięcie, a faktyczny `DELETE` robi zaplanowany proces
> po 30 dniach.

### 17a. Żądanie usunięcia

1. **RSC** `/account/settings` — `account/settings/page.tsx`: `auth()` → brak ⇒
   `redirect('/login')` (`:9-10`); `getAccountSettings(userId)` (`:12`). Jeśli
   `deletionRequestedAt` ustawione → renderuj `<CancelDeletionSection>`, inaczej
   `<DeleteAccountSection>` (`:17-21`). Czyli to **serwer** decyduje, którą
   sekcję pokazać, na podstawie stanu w bazie.
2. `getAccountSettings` — `src/modules/account/queries.ts:5-16`:
   `users.findFirst WHERE id = userId`, kolumny
   `{id, email, name, deletionRequestedAt}`.
3. **`DeleteAccountSection`** (`'use client'`) — wymaga wpisania literału
   `DELETE` (`isConfirmed`, `:18`), przycisk disabled do potwierdzenia
   (`:49-51`); `useActionState(requestDeletionAction, null)`.
4. **Server Action** `requestDeletionAction` — `account/actions.ts:11-30`: auth
   (`:15-16`) → walidacja `confirmation === 'DELETE'` (`:18-20`) →
   `db.update(users).set({ deletionRequestedAt: new Date() })` (`:22-26`) →
   `revalidatePath('/account/settings')`. **Tylko stempel daty — dane usera
   zostają.**

### 17b. Anulowanie

`CancelDeletionSection` pokazuje datę czystki (`deletionRequestedAt + 30 dni`,
`:12-13`); przycisk „Anuluj usunięcie" `formAction={cancelDeletionAction}`.
`cancelDeletionAction` — `account/actions.ts:32-43`: auth →
`db.update(users).set({ deletionRequestedAt: null })` (`:36-40`) →
`revalidatePath`. Po re-renderze serwer znów pokazuje `DeleteAccountSection`.

### 17c. Realny enforcement — nocny cron (poza aplikacją Next.js)

To nie żyje w kodzie Next.js ani w runtime Workers — to osobny skrypt Node
odpalany przez GitHub Actions:

- **Workflow** `.github/workflows/cleanup.yml`: `cron: '0 2 * * *'` (02:00
  UTC) + ręczny `workflow_dispatch`. Node 22, `npm ci`,
  `node scripts/cleanup-expired-accounts.mjs` z `DATABASE_URL` z sekretu repo.
- **Skrypt** `scripts/cleanup-expired-accounts.mjs` — `runCleanup(sql)`
  (`:5-27`): jedno zapytanie z CTE —
  `DELETE FROM "user" WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at < NOW() - INTERVAL '30 days' RETURNING …`,
  plus kasowanie powiązanych `verificationToken`. Loguje liczby. Wiersze
  `account` / `session` / `session_result` znikają **kaskadą FK**
  (`onDelete: 'cascade'` na `userId` w schemacie).

> 🔎 W `wrangler.jsonc` **nie ma** cron triggers — czystka żyje wyłącznie w
> GitHub Actions. Nie ma też check'u przy logowaniu: konto „zaplanowane do
> usunięcia" działa normalnie aż do nocnej czystki po 30 dniach. Jeśli szukałbyś
> tej logiki w `auth.ts` albo w middleware — tam jej nie znajdziesz.

---

## 18. Połączenie z DB — `src/shared/lib/db.ts` (czytaj uważnie — nieoczywiste)

Jedyny eksport: **`getDb()`** — fabryka owinięta w `cache()` z `react`
(`db.ts:1,11`), zwraca typowany `PostgresJsDatabase<typeof schema>` (drizzle +
sterownik `postgres`).

- **Per-request, nie singleton.** W zwykłym Node trzymałbyś jeden klient DB w
  module-level zmiennej i reużywał. **Tutaj nie wolno** — powód w 2.9 (workerd).
  `cache()` z Reacta memoizuje wynik **w obrębie jednego żądania**: pierwszy
  `getDb()` w danym requeście tworzy klienta, kolejne wywołania w tym samym
  requeście dostają ten sam, a po zakończeniu żądania jest odrzucany (`:6-10`).

  > 📘 **`cache()` z `react`** (nie mylić z `useMemo`): to serwerowa memoizacja
  > na czas pojedynczego żądania RSC. Dlatego każdy plik woła `getDb()` lokalnie
  > (np. `queries.ts:16`, `actions.ts:32`, `finalize.ts:27`) zamiast importować
  > wspólną instancję — i to jest _poprawne_, nie marnotrawne.

- **Driver** (`:13-23`):
  `postgres(process.env.DATABASE_URL!, { max:3, prepare:false, fetch_types:false, connect_timeout:10, idle_timeout:20 })`.
  `prepare:false` jest wymagane przez pooler Supabase w trybie transakcyjnym
  (port 6543) — prepared statements nie działają z tym poolerem.
  `idle_timeout:20` zamyka bezczynne sockety, by przy lokalnym Node (`next dev`,
  testy) nie wyczerpać slotów połączeń.
- **Env:** tylko `DATABASE_URL`. Lokalnie/CI → local Supabase
  (`127.0.0.1:54322`); prod → pooler Supabase.

> To był realny blocker na produkcji: singleton połączenia działał lokalnie, ale
> wywalał się na Workers. Fix = per-request `getDb()`. Jeśli kiedyś
> „zoptymalizujesz" to do singletona — wróci błąd.

---

## 19. Root layout, nawigacja, motyw

`src/app/layout.tsx` — to **root layout** (2.5), opakowuje całą aplikację:

- Fonty `Inter` (`--font-sans`) + `IBM_Plex_Mono` (`--font-mono`) z subsetem
  `latin-ext` (PL) — `:8-19`.

  > 📘 `next/font/google` ładuje fonty w czasie buildu i self-hostuje je (zero
  > requestów do Google w runtime), eksponując je jako CSS variables.

- `lang='pl'`, `suppressHydrationWarning` — `:33-36` (to drugie wycisza
  ostrzeżenie hydracji, bo `next-themes` modyfikuje `data-theme` przed hydracją
  Reacta).
- **Jedyny provider: `ThemeProvider` (next-themes)** — `:3,38-42`
  (`attribute='data-theme'`, `defaultTheme='system'`). **Brak
  `SessionProvider`** — auth czytane server-side (2.1), więc nie ma potrzeby
  kontekstu sesji w przeglądarce.
- Wrappuje `<SceneBg />` (dekoracyjne animowane tło) + `<Nav />` + `{children}`
  — `:43-45`.
- **`Nav`** — `src/shared/components/Nav/Nav.tsx`: to **async RSC**, woła
  `await auth()` (`:7`) i przekazuje `isLoggedIn`/`email` do klienckiego
  `NavLinks` (`:16`). Czyli nawigacja „wie", czy jesteś zalogowany, bo serwer to
  sprawdził — nie ma migotania „najpierw guest, potem user".

---

## 20. Infrastruktura, deploy, CI/CD

- **Build na Workers:** `@opennextjs/cloudflare` przepakowuje build Next.js na
  format Cloudflare Workers. `next.config.ts:11` woła
  `initOpenNextCloudflareForDev()`, żeby `next dev` widział bindings CF.
  `open-next.config.ts` = domyślny `defineCloudflareConfig({})`. Skrypty:
  `build:worker` / `deploy` / `preview` (package.json).
- **`wrangler.jsonc`:** `main: .open-next/worker.js`, `name: osce-triager`,
  flagi `nodejs_compat` (włącza część API Node na Workers) +
  `global_fetch_strictly_public`, bindings `ASSETS`, `WORKER_SELF_REFERENCE`,
  `IMAGES`; vars publiczne (`NEXT_PUBLIC_SUPABASE_*`, `AUTH_URL`,
  `AUTH_TRUST_HOST`). **Bez cron triggers.**
- **Workflows (`.github/workflows/`):**
  - `deploy.yml` — push do `main`, Node 22: `npm ci` → `drizzle-kit migrate`
    (migracje na prod DB) → lint → `tsc --noEmit` → `npm run deploy`.
  - `ci.yml` — PR do `main`, Node 24: lint+typecheck → unit → integracyjne
    (`supabase start` + `drizzle-kit push`) → E2E (seed + Playwright chromium).
  - `cleanup.yml` — nocny cron RODO (sekcja 17c).

---

## 21. Schemat danych (Drizzle) — `src/shared/lib/schema.ts`

> 📘 **Drizzle** to typed query builder/ORM: tabele definiujesz w TS, a typy
> kolumn propagują się do zapytań. Brak natywnych enumów Postgresa — enumy są tu
> `text` z `.$type<…>()`, czyli ograniczenie istnieje tylko po stronie typów TS
> (baza widzi zwykły `text`). Nazwy eksportów w TS są w `camelCase` liczbie
> mnogiej (`sessionResults`), a fizyczne nazwy tabel w bazie — w `snake_case`
> liczbie pojedynczej (`session_result`). W dokumencie używam obu.

Diagram relacji (FK) w skrócie:

```
user ─┬─< account            (OAuth — nieużywane, tylko pod adapter)
      ├─< session             (NextAuth DB session — nieużywane przy JWT)
      └─< session_result >─── scenario ─< test_classification >─ diagnostic_test
                  │                                                    │
                  └─< session_event >─────────────────────────────────┘
verificationToken  (samodzielna, e-mail flows — nieużywane)
```

---

### Tabele NextAuth / adaptera

Te cztery tabele to **standardowy schemat `@auth/drizzle-adapter`**. Adapter
wymaga, by istniały, mimo że projekt loguje przez Credentials + strategię JWT
(sekcja 6, 8) — dlatego trzy z nich są w praktyce puste/nieużywane. Trzymamy je,
bo (a) adapter by się wywalił bez nich i (b) ułatwiają późniejsze dodanie OAuth.

#### `user` (`schema.ts:11-21`) — konto użytkownika

- **Zawiera:** `id` (text PK, domyślnie `crypto.randomUUID()`), `name`, `email`
  (unique), `emailVerified`, `image`, **`hashed_password`** (bcrypt — login
  Credentials), **`deletion_requested_at`** (nullable timestamp — znacznik
  RODO).
- **Cel biznesowy:** tożsamość użytkownika i jego dane logowania.
  `hashed_password` jest dodatkiem tego projektu do standardowego schematu
  NextAuth (logowanie hasłem). `deletion_requested_at` realizuje miękkie
  usunięcie konta (RODO): `NULL` = konto aktywne, data = zaplanowane do czystki
  za 30 dni.
- **Gdzie używana:**
  - rejestracja/insert + check duplikatu — `modules/auth/user.util.ts`,
  - weryfikacja hasła przy logowaniu (`authorize`) — `modules/auth/auth.ts`,
  - żądanie/anulowanie usunięcia (`deletion_requested_at`) —
    `modules/account/actions.ts`, odczyt w `modules/account/queries.ts`,
  - twarda czystka po 30 dniach — `scripts/cleanup-expired-accounts.mjs`,
  - FK rodzic dla `session_result` (scoping własności po `userId`).

#### `account` (`schema.ts:23-45`) — konta zewnętrznych providerów (OAuth)

- **Zawiera:** złożony PK `(provider, providerAccountId)`, `userId` → `user.id`
  **ON DELETE cascade**, oraz komplet kolumn tokenów OAuth (`access_token`,
  `refresh_token`, `expires_at`, `scope`, `id_token`…).
- **Cel biznesowy:** powiązanie konta z logowaniem przez Google/GitHub itp.
- **Gdzie używana:** tylko zarejestrowana w adapterze (`modules/auth/auth.ts`) i
  kaskadowo czyszczona przez `scripts/cleanup-expired-accounts.mjs`. **Nie ma
  aktywnego providera OAuth — tabela jest faktycznie pusta.**

#### `session` (`schema.ts:47-53`) — sesje logowania w bazie

- **Zawiera:** `sessionToken` (PK), `userId` → cascade, `expires`.
- **Cel biznesowy:** trzymanie sesji logowania **w bazie** — używane, gdyby
  strategia była `database`.
- **Gdzie używana:** **nigdzie aktywnie.** Projekt ma `session.strategy: 'jwt'`
  (sekcja 6.2), więc sesja żyje w podpisanym cookie, nie w tej tabeli. Istnieje
  tylko pod adapter. ⚠️ Nie myl jej z `session_result` (sesja OSCE) — to
  zupełnie inna rzecz (patrz pułapka 10 w sekcji 23).

#### `verificationToken` (`schema.ts:55-63`) — tokeny weryfikacji e-mail

- **Zawiera:** złożony PK `(identifier, token)`, `expires`.
- **Cel biznesowy:** magic-link / weryfikacja e-mail / reset hasła (flow
  e-mailowe NextAuth).
- **Gdzie używana:** zarejestrowana w adapterze (`modules/auth/auth.ts`);
  dodatkowo czyszczona dla usuwanych userów w
  `scripts/cleanup-expired-accounts.mjs` (po `email`). Brak aktywnego flow
  e-mailowego — w praktyce pusta.

---

### Tabele domenowe (właściwa logika OSCE)

To serce aplikacji. Cztery tabele dzielą się na **dane referencyjne**
(scenariusze i ich klucz odpowiedzi — wgrywane seedem) oraz **dane przebiegu**
(co użytkownik faktycznie zrobił w sesji).

#### `scenario` (`schema.ts:67-75`) — przypadek kliniczny (dane referencyjne)

- **Zawiera:** `id` (PK uuid), `title`, `description`, **`time_limit_seconds`**
  (int NOT NULL — limit czasu sesji w sekundach), `created_at` (defaultNow).
- **Cel biznesowy:** definiuje jeden przypadek do przećwiczenia (np. „ból w
  klatce piersiowej, 300 s"). `time_limit_seconds` steruje timerem na ekranie
  sesji i serwerową detekcją wygaśnięcia (`isSessionExpired`).
- **Gdzie używana:**
  - lista na panelu — `getScenarios()` w `modules/session/queries.ts`,
  - walidacja istnienia przy starcie sesji — `startSessionAction`
    (`modules/session/actions.ts`),
  - pobranie limitu czasu przy renderze sesji i w leniwej finalizacji —
    `queries.ts`, `finalize.ts`,
  - wgrywana seedem — `seed.ts` (2 scenariusze) i `seed-test.ts` (krótki, 5 s).

#### `diagnostic_test` (`schema.ts:77-83`) — katalog badań diagnostycznych (dane referencyjne)

- **Zawiera:** `id` (PK), `name` (NOT NULL **unique**), `created_at`.
- **Cel biznesowy:** globalny słownik badań, które można zlecać (np. „EKG",
  „Troponina", „RTG klatki"). Współdzielony między scenariuszami — to _które_
  badanie jest krytyczne, definiuje dopiero `test_classification`, nie samo
  badanie. Seed nadaje czytelne id `dt-001`…`dt-018`.
- **Gdzie używana:**
  - lista wszystkich badań do wyświetlenia w lewej kolumnie sesji —
    `getDiagnosticTests()` w `modules/session/queries.ts`,
  - join po `name` na ekranie szczegółów (żeby pokazać nazwę zamiast id) —
    `getSessionDetails` w `queries.ts`,
  - wgrywany wyłącznie przez `seed.ts`.

#### `test_classification` (`schema.ts:85-99`) — KLUCZ ODPOWIEDZI (dane referencyjne)

- **Zawiera:** złożony PK `(scenario_id, test_id)` — oba FK **ON DELETE
  cascade**; **`classification`**
  `'critical' | 'optimal' | 'acceptable' | 'unnecessary'` (NOT NULL).
- **Cel biznesowy:** **to jest tabela rozstrzygająca scoring.** Mówi: „w tym
  scenariuszu to badanie ma taką kategorię". Tabela łącząca many-to-many między
  `scenario` a `diagnostic_test` z atrybutem `classification` na relacji. Zbiór
  badań `critical` danego scenariusza decyduje o Pozytywny/Negatywny (sekcja
  13).
- **Gdzie używana:**
  - ocena pojedynczego zlecenia (kategoria → badge) — `selectTestAction`
    (`modules/session/actions.ts`) przez `validator.ts`,
  - werdykt końcowy (które krytyczne pominięto) — `finalize.ts`
    (`evaluateSessionEnd`),
  - mapa klasyfikacji przekazywana do `SessionView` — `queries.ts`
    (`getTestClassificationsByScenario`),
  - wgrywany seedem — `seed.ts` (36 wierszy) i `seed-test.ts` (1 wiersz:
    `dt-001` = `critical`).

#### `session_result` (`schema.ts:101-118`) — jedna rozegrana sesja (dane przebiegu)

- **Zawiera:** `id` (PK uuid); `user_id` → `user.id` **cascade** (kto grał);
  `scenario_id` → `scenario.id` **ON DELETE restrict** (czego dotyczyła);
  **`outcome`** `'in_progress' | 'positive' | 'negative'` (default
  `in_progress`); `is_failed` (bool, default false); `started_at` (defaultNow);
  `completed_at` (nullable — ustawiane przy finalizacji).
- **Cel biznesowy:** „nagłówek" jednej próby rozwiązania scenariusza przez
  danego użytkownika. `outcome` to maszyna stanów: sesja rodzi się jako
  `in_progress` i przechodzi raz w `positive`/`negative` przy finalizacji.
  `completed_at = NULL` ⇔ sesja jeszcze trwa.

  > 🔎 **Dlaczego `scenario_id` ma `restrict`, a nie `cascade`:** nie chcemy, by
  > usunięcie scenariusza skasowało historyczne wyniki użytkowników. `user_id`
  > ma `cascade`, bo usunięcie konta (RODO) _ma_ zabrać ze sobą jego sesje.

- **Gdzie używana:** to najczęściej dotykana tabela domenowa —
  - tworzenie (`startSessionAction`), zmiana stanu (atomowy claim w
    `finalize.ts`),
  - odczyt pojedynczej sesji i historii — `getSessionById`, `getUserSessions`,
    `getSessionDetails` (`queries.ts`),
  - usuwanie z historii — `deleteSessionById` (`queries.ts`) /
    `deleteSessionAction` (`actions.ts`).

#### `session_event` (`schema.ts:120-134`) — pojedyncze zlecenie badania w sesji (dane przebiegu)

- **Zawiera:** `id` (PK); `session_id` → `session_result.id` **cascade** (do
  której sesji należy); `test_id` → `diagnostic_test.id` **ON DELETE restrict**
  (jakie badanie); **`validator_result`**
  `'correct' | 'suboptimal' | 'unnecessary' | 'critical_miss'` (NOT NULL);
  `selected_at` (defaultNow).
- **Cel biznesowy:** dziennik (append-only log) tego, co użytkownik zrobił w
  sesji. Dwa rodzaje wierszy:
  1. **zlecenie badania** — wstawiane na żywo przy każdym „Zleć"
     (`validator_result` = ocena tego badania w tym scenariuszu),
  2. **`critical_miss`** — wiersze syntetyczne dopisywane _przy finalizacji_ dla
     każdego pominiętego badania krytycznego (sekcja 12). To one zasilają listę
     „Pominięte badania krytyczne".

  Kolejność zlecania odtwarzamy z `selected_at` (rosnąco) — **nie ma osobnej
  kolumny ordinala** (pułapka 1, sekcja 23).

- **Gdzie używana:**
  - insert przy zleceniu — `selectTestAction` (`actions.ts`),
  - odczyt do odtworzenia stanu sesji i do szczegółów — `getSessionEvents`,
    `getSessionDetails` (`queries.ts`),
  - odczyt + insert `critical_miss` przy finalizacji — `finalize.ts`.

---

**Migracje:** `drizzle/migrations/` (journal v7, 3 wpisy): `0000` tabele
NextAuth, `0001` tabele domenowe + FK, `0002`
`ALTER TABLE user ADD deletion_requested_at`. W prod aplikowane w CI przez
`npx drizzle-kit migrate` (`deploy.yml`); lokalnie/CI test używa
`drizzle-kit push`.

---

## 22. Seedy

Oba skrypty używają **dynamicznego `import('./db')`**, żeby `DATABASE_URL` był
ustawiony przed inicjalizacją klienta DB; wszystkie inserty
`.onConflictDoNothing()` (idempotentne — można puścić wielokrotnie).

- **`seed.ts`** (`npm run seed`): treść referencyjna — **2 scenariusze** (UUID
  `…001` ból w klatce 300 s, `…002` zaburzenia świadomości 240 s), **18 badań**
  (`dt-001`…`dt-018`), **36 klasyfikacji**. Nie tworzy userów.
- **`seed-test.ts`** (`npm run seed:test`): fixtures E2E — jeden user
  (`TEST_USER_EMAIL`/`PASSWORD`, bcrypt cost 12, `:14-21`), **scenariusz
  krótkiego limitu** (`…003`, **`timeLimitSeconds: 5`**, `:24-32`) i jedna
  klasyfikacja (`dt-001` = `critical`, `:34-41`), żeby test timeoutu szybko
  trafił w 0:00 i dał wynik Negatywny. Zależy od `dt-001` z `seed.ts`.

---

## 23. Pułapki i nieoczywistości (czytaj przed grzebaniem)

1. **Reorder w prawej kolumnie nie jest utrwalany** — tylko zlecenie. Scoring
   jest niezależny od kolejności (sekcja 11c, 13).
2. **Ręczne/timeout zakończenie nie robi redirectu** — `SessionView` pokazuje
   wynik w miejscu (zmiana stanu, nie nawigacja); trwałe szczegóły są pod
   osobnym route'em historii (sekcja 12, 15).
3. **Niezalogowany → `/`**, nie `/login` (sekcja 4).
4. **Brak Zod** — cała walidacja ręczna (sekcja 7).
5. **Brak `SessionProvider`** — auth wyłącznie server-side (sekcja 2.1, 19).
6. **Brak `proxy.ts`** — split Edge/Node przez dwa configi NextAuth (sekcja 2.8,
   4, 6).
7. **JWT strategy** — tabela `session` istnieje dla adaptera, ale nie trzyma
   stanu auth; logout nie kasuje wiersza w DB (sekcja 6, 8, 9, 21).
8. **RODO enforcement = GitHub Actions cron**, nie Cloudflare; brak check'u przy
   logowaniu (sekcja 17c).
9. **`getDb()` zawsze lokalnie, nigdy singleton** — inaczej prod-DB na Workers
   się wywala (sekcja 2.9, 18).
10. **Dwa znaczenia „session"** — login NextAuth (JWT) vs sesja OSCE
    (`session_result`); timeout dotyczy OSCE (sekcja 3, 12).
11. **`params` jest async** w stronach (Next.js 16) — `await params` (sekcja
    2.5).
12. **`redirect()`/`notFound()` rzucają** — stąd
    `isRedirectError(e) ? throw : …` wokół `signIn`/`signOut` (sekcja 2.6, 7,
    8).

---

## 24. Indeks plików — gdzie czego szukać

| Obszar                | Pliki                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ochrona route'ów**  | `src/middleware.ts`                                                                                                                                     |
| **Auth (config)**     | `src/modules/auth/auth.ts` (Node), `auth.config.ts` (Edge)                                                                                              |
| **Auth (akcje/util)** | `src/modules/auth/actions.ts`, `user.util.ts`                                                                                                           |
| **Auth (UI)**         | `src/modules/auth/components/{LoginForm,RegisterForm,SubmitButton}.tsx`, `src/app/(auth)/**`                                                            |
| **Auth (API)**        | `src/app/api/auth/[...nextauth]/route.ts`, `register/route.ts`                                                                                          |
| **Sesja (akcje)**     | `src/modules/session/actions.ts`                                                                                                                        |
| **Sesja (odczyty)**   | `src/modules/session/queries.ts`                                                                                                                        |
| **Sesja (rdzeń)**     | `src/modules/session/finalize.ts`, `src/shared/lib/validator.ts`                                                                                        |
| **Sesja (UI)**        | `src/modules/session/components/SessionView/**`, `ScenarioCard`, `{Draggable,Sortable,}TestCard`, `HistoryCard`, `HistoryFilter`, `DeleteSessionButton` |
| **Strony sesji**      | `src/app/dashboard/{page,history/page}.tsx`, `session/[sessionId]/{page,details/page}.tsx`                                                              |
| **Konto / RODO**      | `src/modules/account/{actions,queries}.ts`, `src/app/account/settings/**`, `scripts/cleanup-expired-accounts.mjs`, `.github/workflows/cleanup.yml`      |
| **Dane / infra**      | `src/shared/lib/{db,schema,validator,seed,seed-test}.ts`, `drizzle/**`, `wrangler.jsonc`, `next.config.ts`, `open-next.config.ts`                       |
| **Layout / shared**   | `src/app/layout.tsx`, `src/shared/components/{Nav,ConfirmModal,Button,Spinner,ThemeToggle,SceneBg}/**`, `src/shared/hooks/useModal.ts`                  |

---

## 25. Sugerowana kolejność czytania kodu (onboarding krok po kroku)

Jeśli chcesz przejść codebase „na żywo", proponuję tę trasę — od najprostszego
do najtrudniejszego flow:

1. **Sekcja 2** (primer Next.js) — żeby pojęcia App Routera nie zaskakiwały.
2. **Sekcja 6** (primer NextAuth) — żeby przepływy auth miały kontekst.
3. `src/app/layout.tsx` + `src/shared/components/Nav/Nav.tsx` — jak wygląda RSC
   i server-side auth w najprostszej formie (sekcja 19).
4. **Login** (sekcja 8): `LoginForm.tsx` → `actions.ts` → `auth.ts`. Pierwszy
   pełny przepływ klient → Server Action → DB.
5. `src/middleware.ts` + `auth.config.ts` (sekcja 4) — zrozum split Edge/Node.
6. **Start + przebieg sesji** (sekcje 10–11): `dashboard/page.tsx` →
   `ScenarioCard` → `startSessionAction` → `[sessionId]/page.tsx` →
   `SessionView`. To rdzeń aplikacji.
7. **Finalizacja** (sekcja 12): `finalize.ts` — przeczytaj atomowy claim i trzy
   ścieżki. Najtrudniejszy, najciekawszy fragment.
8. **Historia / szczegóły / usuwanie** (sekcje 14–16) — wariacje na temat
   RSC-czyta-query + Server-Action-mutuje + `revalidatePath`.
9. **Dane/infra** (sekcje 18, 21) — `db.ts` i `schema.ts` na koniec, gdy już
   widziałeś, jak są używane.

---

_Dokument odzwierciedla stan na commicie `09bbc0b` (branch `check-timer`).
Numery linii mogą drgnąć przy edycjach — traktuj je jako wskazówkę nawigacyjną,
a nie kontrakt._
