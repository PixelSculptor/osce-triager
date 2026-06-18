# Frame Brief: Wylogowanie nie czyści sesji na produkcji

> Etap ramowania przed /10x-plan. Ten dokument przedstawia, co _faktycznie_ jest
> problemem, oddzielone od tego, co początkowo zakładano.

## Zgłoszona obserwacja

Po ręcznym wylogowaniu i odświeżeniu strony **na produkcji (Cloudflare Workers,
HTTPS)** aplikacja wraca do stanu zalogowanego użytkownika. **Na lokalnej
aplikacji z lokalną bazą (HTTP dev) problem nie występuje.** Samo wylogowanie
_pozornie działa_ — UI przekierowuje do strony logowania; dopiero odświeżenie
przywraca zalogowany stan. Niepożądane z punktu widzenia bezpieczeństwa.

## Początkowe ramy (zachowane)

- **Podana przyczyna lub podejście użytkownika**: sesja nie jest faktycznie
  czyszczona — cookie JWT NextAuth nie jest usuwane / nie wygasa, albo `signOut`
  nie czyści stanu na serwerze (z `change.md`).
- **Proponowany kierunek działania użytkownika**: zbadać, dlaczego dzieje się to
  na prod a nie lokalnie, i naprawić.
- **Zawężenie przed wysyłką** (Krok 1.5): (1) w momencie wylogowania UI
  **przekierowuje do logowania** — wylogowanie pozornie działa; (2) zachowanie
  jest **zawsze na prod, nigdy lokalnie** — czysty podział środowiskowy; (3)
  zakres ramowania: **tylko bug wylogowania** (odświeżenie dokumentacji po
  refaktorze DB to osobna, mechaniczna praca na później).

## Mapa wymiarów

Obserwacja (logout pozornie działa, cookie zostaje, tylko na prod) może
pochodzić z:

1. **Atrybuty cookie prod vs local (`__Secure-` prefix / domain / sameSite)** —
   na HTTPS Auth.js używa `__Secure-authjs.session-token`+`Secure`; lokalnie
   `authjs.session-token`. Mismatch atrybutów set vs delete → przeglądarka
   ignoruje delecję. Podkategoria: chunked cookie (`.0`/`.1`). ← część ram
   użytkownika
2. **Adapter Cloudflare Workers gubi `Set-Cookie`** przy redirect z Server
   Action — nagłówek kasujący token przepada na prod, lokalny Node propaguje.
3. **Rozjazd dwóch instancji NextAuth** (middleware Edge `authConfig` vs auth.ts
   Node factory) — różny `AUTH_SECRET` / nazwy cookie na prod.
4. **Chunked JWT cookie** — signOut kasuje bazową nazwę, chunk zostaje.
5. **Cache krawędziowy Cloudflare** — odświeżenie serwuje zcache'owany
   uwierzytelniony HTML mimo skasowanego cookie.

## Badanie hipotez

> **Aktualizacja po weryfikacji nagłówków na prod (Krok 5).** Obserwacja
> nagłówków wylogowania **zaprzeczyła** wiodącym hipotezom H1 i H2 i ujawniła
> nową przyczynę (N1). Odpowiedź logout **nie kasuje cookie — re-wystawia ważny
> token**. Patrz „Sygnały zawężające".

| Hipoteza                                                                                                                                                                             | Dowody                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Werdykt                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **N1 (potwierdzona): middleware rolling-refresh re-wystawia JWT na żądaniu wylogowania; jego `Set-Cookie` jest scalany PO delecie z `signOut` → przeglądarka zachowuje ważny token** | **Decydujące: odpowiedź logout zawiera DWA `Set-Cookie` dla tej samej nazwy** — (1) delete `…=; Max-Age=0; SameSite=lax` z `signOut`, (2) świeży ważny token `Expires` +30 dni `SameSite=Lax`. Delete jest pierwszy, refresh drugi → reguła „ostatni wygrywa" zostawia przeglądarkę z ważnym tokenem. Różnica wielkości liter (`lax` vs `Lax`) = dwa różne emitery: `signOut` (Node, `auth.ts:19`, `actions.ts:92`) vs rolling-refresh middleware `auth()` (Edge, `middleware.ts:5,9`; matcher `:21` łapie POST). RSC `auth()` (`Nav.tsx:7`) nie ustawia cookie w renderze → drugi emiter to middleware. | **SILNE (dwa nagłówki w jednej odpowiedzi prod + kod)** |
| H1: mismatch atrybutów/prefiksu cookie set↔delete                                                                                                                                    | **OBALONA przez nagłówki**: atrybuty są idealnie zgodne (`__Secure-` + `Secure; HttpOnly; SameSite=Lax; Path=/`), a problemem nie jest nieskuteczny delete, lecz że delete w ogóle nie jest emitowany — zamiast niego leci ważny token.                                                                                                                                                                                                                                                                                                                                                                  | BRAK (zaprzeczona dowodem)                              |
| H2 (część ram): Workers gubi delete-`Set-Cookie` przy redirect                                                                                                                       | **OBALONA przez nagłówki**: `Set-Cookie` dociera do przeglądarki bez problemu i poprawnie nadpisuje cookie — tyle że niosąc ważny token, nie delete. Propagacja działa.                                                                                                                                                                                                                                                                                                                                                                                                                                  | BRAK (zaprzeczona dowodem)                              |
| H3: rozjazd instancji NextAuth / secret                                                                                                                                              | `AUTH_SECRET` to pojedynczy runtime secret (`wrangler secret put`, `infrastructure.md:125`) dostępny dla całego workera; obie instancje czytają to samo (`next-auth/lib/env.js:22`) i te same domyślne nazwy cookie. Gdyby secret się różnił, login by nie działał.                                                                                                                                                                                                                                                                                                                                      | BRAK (silne dowody przeciw)                             |
| H4: chunked cookie (.0/.1)                                                                                                                                                           | Brak chunków w obserwacji (cookie mieści się w jednym `__Secure-authjs.session-token`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | BRAK                                                    |
| H5: cache krawędziowy                                                                                                                                                                | Obserwacja nagłówków pokazuje świeży `Set-Cookie` w odpowiedzi runtime, nie zcache'owany HTML; cache wykluczony.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | BRAK                                                    |

## Sygnały zawężające

- **DECYDUJĄCY — DWA `Set-Cookie` w jednej odpowiedzi logout (prod):** (1)
  `__Secure-authjs.session-token=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax`
  (delete z `signOut`) ORAZ (2)
  `__Secure-authjs.session-token= <świeży JWE>; Path=/; Expires=Sat, 18 Jul 2026 …; HttpOnly; Secure; SameSite=Lax`
  (rolling-refresh). Delete jest **pierwszy**, refresh **drugi** → reguła
  przeglądarki „ostatni `Set-Cookie` wygrywa" zostawia ważny token. To
  jednoznacznie pokazuje, że `signOut` **działa**, a winowajcą jest **drugi
  emiter** dokładający świeży token. Różnica `SameSite=lax` vs `SameSite=Lax`
  potwierdza dwa różne emitery (signOut vs middleware-refresh).
- `Expires` = dokładnie +30 dni = **domyślny `session.maxAge` Auth.js**, nigdzie
  nie nadpisany (`auth.ts:26`, `auth.config.ts:4`) → cookie świeżo wybity z
  domyślnym maxAge przez rolling-refresh, nie podtrzymany stary.
- **Logout pozornie działa (redirect następuje), cookie zostaje** → `signOut`
  jest wywoływane (`actions.ts:92`), ale jego kasujący `Set-Cookie` jest
  nadpisany przez świeży token z middleware na tej samej odpowiedzi.
- **Zawsze prod, nigdy lokalnie** → przyczyna NIE leży w semantyce atrybutów
  `__Secure-`/`Secure` (jak zakładało wcześniejsze przeformułowanie), lecz w
  **kolejności scalania dwóch `Set-Cookie` (middleware vs Server Action) na
  runtime Workers/OpenNext** — lokalny `next dev` (Node) najwyraźniej pozwala
  wygrać delecji z `signOut`.
- **Strategia `jwt`** (`auth.config.ts:4`, `auth.ts:26`) → brak rewokacji po
  stronie serwera; kasowanie cookie jest jedynym mechanizmem wylogowania — a
  rolling-refresh w middleware aktywnie mu przeciwdziała.

## Konwencja między systemami

Przy stateless-JWT (Auth.js v5) poprawne wylogowanie polega wyłącznie na
wyemitowaniu `Set-Cookie` kasującego token. Znany footgun Auth.js v5: wrapper
`auth()` użyty jako **middleware rolling-refresh'uje** cookie sesji na każdym
dopasowanym żądaniu. Gdy żądanie wylogowania (POST do trasy objętej matcherem)
przechodzi przez ten middleware, świeżo wystawiony token konkuruje z delecją z
`signOut` w tej samej odpowiedzi. Konwencja naprawcza: wykluczyć ścieżkę
auth/logout z odświeżania w middleware (zawęzić matcher / pominąć refresh dla
żądań mutujących sesję) albo nie polegać na refreshu w middleware — tak by
delecja `signOut` była autorytatywna.

## Przeformułowane sformułowanie problemu

> **Rzeczywisty problem do zaplanowania to**: na produkcji odpowiedź na
> wylogowanie **re-wystawia ważny token sesji zamiast go skasować**, ponieważ
> middleware Auth.js (`auth()` wrapper) rolling-refresh'uje cookie JWT na tym
> samym POST, który wykonuje `signOut`, a na runtime Workers/OpenNext jego
> `Set-Cookie` ze świeżym tokenem nadpisuje kasujący `Set-Cookie` z `signOut`.
> Przy stateless-JWT wciąż ważny token re-autoryzuje przy odświeżeniu. Defekt
> leży w **interakcji middleware-refresh ↔ logout**, **nie** w atrybutach
> `__Secure-` cookie (H1), propagacji `Set-Cookie` (H2) ani w stanie serwera.

Co się zmienia, gdy rozwiązane: odpowiedź na wylogowanie niesie kasujący
`Set-Cookie` (lub brak konkurencyjnego refreshu), cookie znika na prod,
odświeżenie nie przywraca sesji, middleware przekierowuje na `/`. Zarówno
pierwotna teoria „server state", jak i wcześniejsze przeformułowanie „delecja
nieskuteczna przez atrybuty/propagację" są odrzucone dowodami z nagłówków.

## Pewność

- **WYSOKA** — i co do kierunku, i co do mechanizmu. Odpowiedź logout zawiera
  **dwa `Set-Cookie`**: poprawny delete z `signOut` ORAZ świeży ważny token z
  rolling-refresh, w tej kolejności → przeglądarka zachowuje token. Dowód
  bezpośredni z prod, spójny z kodem (`signOut` w `actions.ts:92`/`auth.ts:19`
  emituje delete; middleware `auth()` w `middleware.ts:5,9` odświeża na POST
  łapanym matcherem `:21`). H1/H2/H3/H4/H5 obalone.
- **Brak kroku blokującego przed /10x-plan.** Element wcześniej „do
  potwierdzenia" (źródło świeżego cookie) jest rozstrzygnięty dwoma nagłówkami.
  Plan może opcjonalnie potwierdzić atrybucję middleware przez `wrangler tail`,
  ale to weryfikacja implementacji, nie ram.

## Co zmienia się dla /10x-plan

Plan powinien dotyczyć **powstrzymania re-wystawienia cookie sesji na ścieżce
wylogowania** — np. wykluczenia tras auth/logout (lub żądań POST) z rolling
-refresh w `middleware.ts`, ewentualnie przeniesienia ochrony tras tak, by
middleware nie odświeżał sesji na mutującym żądaniu — tak aby kasujący
`Set-Cookie` z `signOut` był autorytatywny. **Nie** dotyczy atrybutów
`__Secure-` ani „stanu serwera". Zakres dokumentacyjny z `change.md` pozostaje
osobny. Cel: w odpowiedzi logout ma zostać **tylko** kasujący `Set-Cookie` (albo
delete ma być scalony jako ostatni) — nie konkurencyjny świeży token.

## Referencje

- Pliki źródłowe: `src/modules/auth/auth.ts:19-64,26`,
  `src/modules/auth/auth.config.ts:3-11`, `src/modules/auth/actions.ts:90-96`,
  `src/middleware.ts:5,15`, `src/shared/components/Nav/Nav.tsx:7`,
  `wrangler.jsonc:24-29`, `open-next.config.ts:6-9`, `public/_headers:3-4`,
  `package.json:33`, `context/foundation/infrastructure.md:125`
- Powiązane: `context/changes/fix-db-issue/` (refaktor `getDb()`),
  `context/changes/check-timer/` (ostatni deployment — enforce session timeout)
- Zadania badawcze: TaskCreate #1 (H1), #2 (H2), #3 (H3), #4 (H5)
