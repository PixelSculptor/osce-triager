# Naprawa wylogowania — middleware re-wystawia cookie sesji na prod — Krótki plan

> Pełny plan: `context/changes/fix-logout-session-persists/plan.md` Brief
> ramowy: `context/changes/fix-logout-session-persists/frame.md`

## Co i dlaczego

Na produkcji odpowiedź na wylogowanie **re-wystawia ważny token sesji zamiast go
skasować**: middleware Auth.js (`auth()` wrapper) rolling-refresh'uje cookie JWT
na tym samym POST, który wykonuje `signOut`, a na runtime Workers/OpenNext jego
`Set-Cookie` ze świeżym tokenem nadpisuje kasujący `Set-Cookie` z `signOut`.
Przy stateless-JWT wciąż ważny token re-autoryzuje przy odświeżeniu — użytkownik
wraca zalogowany. To defekt bezpieczeństwa w interakcji middleware-refresh ↔
logout.

## Punkt wyjścia

`src/middleware.ts` owija całość w `export default auth((req) => …)`; wrapper
`auth()` jako side-effect rolling-refresh'uje cookie na każdym dopasowanym
żądaniu (matcher łapie też stronę, na którą POST-uje Server Action logout).
Strategia sesji to stateless `jwt`, więc kasowanie cookie jest jedynym
mechanizmem wylogowania. Lokalnie (`next dev`/Node) delecja `signOut` wygrywa;
na prod (workerd) wygrywa świeży token — bug jest **prod-only**.

## Pożądany stan końcowy

Odpowiedź logout na prod niesie **wyłącznie** kasujący `Set-Cookie` (bez
konkurencyjnego świeżego tokenu); po wylogowaniu i odświeżeniu użytkownik
pozostaje wylogowany, a middleware przekierowuje go z tras prywatnych na `/`.
Normalna nawigacja (GET) nadal rolling-refresh'uje sesję i chroni trasy — zero
regresji UX.

## Kluczowe podjęte decyzje

| Decyzja                   | Wybór                                          | Dlaczego (1 zdanie)                                                                                       | Źródło |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| Mechanizm naprawy         | Pominąć `auth()` (refresh) dla non-GET         | Najmniejszy blast radius — rolling i ochrona zostają dla GET, znika tylko konkurencyjny refresh na logout | Plan   |
| Semantyka rolling-session | Zachować rolling dla GET                       | Zero zmiany UX — naprawiamy wyłącznie bug, nie semantykę sesji                                            | Plan   |
| Weryfikacja (prod-only)   | Preview deploy + inspekcja nagłówków           | Reprodukuje warunek prod, gdzie bug żyje; dowód wprost z `Set-Cookie`                                     | Plan   |
| Zakres dokumentacyjny     | Osobna faza na końcu                           | Trzyma oba zakresy z change.md razem, ale rozdziela ryzyko wdrożenia                                      | Plan   |
| Przyczyna źródłowa        | Rolling-refresh ↔ logout (nie atrybuty cookie) | Dwa `Set-Cookie` w jednej odpowiedzi prod obaliły H1/H2/H3/H4/H5                                          | Rama   |

## Zakres

**W zakresie:**

- Przebudowa `src/middleware.ts` — `auth()` tylko dla GET/HEAD, non-GET
  przepuszczany bez refreshu.
- Odświeżenie dokumentacji po refaktorze DB (`getDb()` per-request, pooler
  transaction-mode) — osobna faza.

**Poza zakresem:**

- Atrybuty cookie `__Secure-`/`SameSite`, propagacja `Set-Cookie`,
  `AUTH_SECRET`/nazwy cookie (hipotezy obalone).
- Rezygnacja z rolling-session; server-side session store / rewokacja.
- Logika `check-timer` (serwerowy timeout sesji egzaminu).
- Dedykowana trasa logout / zawężanie matchera po ścieżce.

## Architektura / Podejście

`export default` w `middleware.ts` staje się zwykłą funkcją: dla GET/HEAD
deleguje do zachowanego `auth((req) => {…})` handlera (ta sama logika
`PUBLIC_PATHS` + redirect, więc rolling-refresh i ochrona tras działają jak
dziś), a dla pozostałych metod zwraca `NextResponse.next()` bez wywołania
`auth()`. Dzięki temu na POST-cie logout nie powstaje konkurencyjny `Set-Cookie`
i delecja `signOut` jest autorytatywna. Matcher i `auth.config.ts` bez zmian.

## Fazy w skrócie

| Faza                  | Co dostarcza                                                      | Kluczowe ryzyko                                                          |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Naprawa middleware | Logout kasuje cookie na prod; rolling/ochrona zostają dla GET     | Brak middleware-redirectu dla non-GET (mitygowane auth po stronie akcji) |
| 2. Odświeżenie docs   | README/AGENTS/CLAUDE opisują `getDb()` per-request, nie singleton | Niskie — czysto dokumentacyjne, niblokujące                              |

**Wymagania wstępne:** Dostęp do preview deploy Workers (lub
`npm run preview`/workerd lokalnie) do inspekcji nagłówków. **Szacowany nakład
pracy:** ~1 sesja — mała zmiana kodu + gate weryfikacyjny na preview; faza docs
lekka.

## Otwarte ryzyka i założenia

- Pominięcie `auth()` dla non-GET usuwa middleware-redirect dla POST na trasach
  prywatnych — założenie: Server Actions/route handlery egzekwują auth po
  stronie serwera (ochrona GET zachowana).
- Zakładamy, że workerd lokalnie (`npm run preview`) odtwarza kolejność scalania
  `Set-Cookie` jak prod; jeśli nie — weryfikacja przez preview deploy.

## Kryteria sukcesu (podsumowanie)

- Odpowiedź logout na prod/preview ma **jeden** delete-`Set-Cookie`, bez
  świeżego tokenu.
- Po wylogowaniu + odświeżeniu użytkownik pozostaje wylogowany; trasy prywatne
  redirectują na `/`.
- Rolling-refresh i ochrona tras działają bez regresji dla normalnej (GET)
  nawigacji.
