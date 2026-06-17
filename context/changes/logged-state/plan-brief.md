# Logged-state — Krótki plan

> Pełny plan: `context/changes/logged-state/plan.md` Badania:
> `context/changes/logged-state/research.md`

## Co i dlaczego

Produkcja na Cloudflare Workers przestała działać: każda strona poza loginem
zawiesza Workera (**Error 1101 "Worker hung"**), a navbar wycieka stan
zalogowanego do niezalogowanych. Oba objawy mają wspólny korzeń — `auth()` woła
DB na każdej stronie (przez `Nav` w root layoucie) z aktywnym `DrizzleAdapter`,
a query na martwym połączeniu PgBouncer wisi bez `query_timeout`; równolegle
brak `force-dynamic`/`Cache-Control` pozwala CDN cache'ować HTML ze stanem auth.

## Punkt wyjścia

Część fixów DB jest już wdrożona (`prepare: false`, `fetch_types: false`, SSL z
URL, `connect_timeout`, `max: 1`), a server actions sesji mają try/catch wokół
`auth()` (commit `63f99bd`). `DATABASE_URL` + pooler 6543 potwierdzone jako
poprawne. Brakuje: `query_timeout`, usunięcia adaptera, ochrony Server
Components i warstwy cache. Login działa, bo jako jedyny nie woła `auth()`.

## Pożądany stan końcowy

Pełna sesja diagnostyczna i historia prób ładują się na produkcji bez Error
1101; błąd DB daje segmentowy komunikat z ponowieniem zamiast zawieszenia;
niezalogowany widzi navbar gościa, a po wylogowaniu stan to "niezalogowany" —
bez wycieku przez CDN. `auth()` nie dotyka DB.

## Kluczowe podjęte decyzje

| Decyzja                  | Wybór                                 | Dlaczego                                                     | Źródło |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------ | ------ |
| DrizzleAdapter w auth.ts | Usunąć                                | Przy JWT+Credentials zbędny; `auth()` przestaje wołać DB     | Plan   |
| Weryfikacja prod DB      | Secret + pooler 6543 potwierdzone     | Login działa → DB osiągalne; przyczyna nie w deployu         | Plan   |
| Zakres                   | Oba: zawieszenie + leak stanu         | Wspólny korzeń, tanie do zrobienia razem                     | Plan   |
| Cache CDN                | force-dynamic (root) + Cache-Control  | Jeden punkt wymusza dynamikę całej apki + defence-in-depth   | Plan   |
| Timeout DB               | query_timeout 8s + connect_timeout 5s | Twardy limit < budżet Workera → zawieszenie staje się błędem | Plan   |
| UX błędu DB              | error.tsx (segmentowe) + try/catch    | Komunikat z ponowieniem zamiast strony Cloudflare; izolacja  | Plan   |
| Hardening auth()         | try/catch we wszystkich SC + account  | Spójność z `63f99bd`; siatka bezpieczeństwa                  | Plan   |

## Zakres

**W zakresie:** `db.ts` query_timeout; usunięcie adaptera z `auth.ts`; try/catch
wokół `auth()` w 7 Server Components + 2 account actions; try/catch w queries;
3× segmentowe `error.tsx`; `force-dynamic` w root layoucie; `Cache-Control` w
`next.config.ts`; `revalidatePath` w `logoutAction`.

**Poza zakresem:** usuwanie martwych tabel
(sessions/accounts/verificationTokens)

- migracje; R2 incremental cache; `strategy: 'database'`; zmiany
  secrets/poolera/deploymentu; server-side session revocation.

## Architektura / Podejście

Cztery niezależnie wdrażalne fazy w kolejności odporności: (1) twardy timeout DB
jako fundament → (2) usunięcie adaptera odcina główne źródło zawieszenia
(`auth()` → DB) → (3) graceful degradation łapie pozostałe zapytania danych →
(4) warstwa cache/leak. Split-config auth (`auth.config.ts` Edge / `auth.ts`
Node) pozostaje nietknięty — middleware już nie ma adaptera.

## Fazy w skrócie

| Faza                    | Co dostarcza                              | Kluczowe ryzyko                                                            |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| 1. DB fail-fast         | `query_timeout`/`connect_timeout` w db.ts | Za niski limit utnie legalne zapytania (nierealne przy selectach)          |
| 2. Usunięcie adaptera   | `auth()` bez DB                           | Regresja login/rejestracji jeśli callbacki zależą od adaptera (nie zależą) |
| 3. Graceful degradation | try/catch + 3× error.tsx                  | Pomylenie "pusto" z "błąd DB" — odróżnić jawnie                            |
| 4. Cache CDN / leak     | force-dynamic + headers + revalidatePath  | Weryfikowalne dopiero po deployu (cache CDN nie istnieje lokalnie)         |

**Wymagania wstępne:** Dostęp do deployu Cloudflare do weryfikacji ręcznej Fazy
4; lokalny Supabase do Faz 1–3. **Szacowany nakład pracy:** ~2–3 sesje, 4 fazy;
zmiany skupione, bez migracji.

## Otwarte ryzyka i założenia

- Założenie: `auth()` z adapterem był realnym źródłem zawieszenia. Jeśli po
  Fazie 2 produkcja nadal wisi, główny podejrzany przesuwa się na reuse martwego
  połączenia PgBouncer (rozważyć recykling połączenia / niższy `idle_timeout`).
- Faza 4 weryfikuje się tylko na żywej produkcji — cache CDN nie istnieje
  lokalnie.
- Martwe tabele auth pozostają w schemacie; przyszłe sprzątanie poza tą zmianą.

## Kryteria sukcesu (podsumowanie)

- Pełna sesja diagnostyczna + historia prób przechodzą na produkcji bez
  Error 1101.
- Błąd DB → segmentowy komunikat z ponowieniem, nie strona Cloudflare.
- Brak wycieku stanu logowania: gość widzi navbar gościa; po wylogowaniu stan
  "niezalogowany" także po odświeżeniu i w innych kartach.
