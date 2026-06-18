---
change_id: fix-logout-session-persists
title: Wylogowanie nie czyści sesji — użytkownik wraca zalogowany po odświeżeniu
status: implemented
created: 2026-06-18
updated: 2026-06-18
archived_at: null
---

## Notes

Po kliknięciu "Wyloguj" i ręcznym odświeżeniu strony użytkownik jest ponownie
zalogowany. Sesja nie jest faktycznie czyszczona po wylogowaniu (prawdopodobnie
cookie sesji JWT NextAuth nie jest usuwane / nie wygasa, albo signOut nie czyści
stanu na serwerze). Oczekiwane: po wylogowaniu i odświeżeniu użytkownik
pozostaje wylogowany i jest przekierowany do logowania.

## Dlaczego ta zmiana była konieczna (przyczyna źródłowa)

Bug był **prod-only** (Cloudflare Workers / OpenNext), nieodtwarzalny na
`next dev`. Odpowiedź na żądanie wylogowania zawierała **dwa konkurujące
nagłówki `Set-Cookie`** dla `__Secure-authjs.session-token`:

1. **delete** z `signOut()` (`Max-Age=0`) — emitowany przez akcję wylogowania,
2. **świeży, ważny token** — emitowany jako _side-effect_ wrappera `auth()` w
   middleware (rolling-refresh sesji Auth.js).

Delete był pierwszy, refresh drugi. Na runtime workerd kolejność scalania
nagłówków powoduje, że przeglądarka stosuje regułę „ostatni wygrywa" i zachowuje
**ważny token**. Przy strategii sesji **JWT (stateless)** skasowanie cookie to
jedyny mechanizm wylogowania (brak rewokacji po stronie serwera) — więc po
odświeżeniu strony sesja wracała.

Kluczowe: rolling-refresh jest side-effectem samego wrappera `auth()`, którego
inner-callback **nie może pominąć**. Server Action logout POST-uje na bieżącą
(chronioną) ścieżkę, więc nie dało się go wykluczyć po `pathname`. Stabilnym
sygnałem rozróżniającym nawigację od mutacji sesji jest **metoda HTTP**.

**Naprawa**: middleware uruchamia `auth()` (i jego rolling-refresh + redirect
ochronny) **tylko dla żądań GET/HEAD**. Żądania mutujące (POST / Server Action,
w tym logout) są przepuszczane przez `NextResponse.next()` bez wywołania
`auth()`, dzięki czemu kasujący `Set-Cookie` z `signOut` jest jedynym,
autorytatywnym nagłówkiem cookie. Rolling-session i ochrona tras dla normalnej
nawigacji (GET) pozostają bez zmian — brak regresji UX.

**Weryfikacja**: potwierdzone na preview (workerd) — odpowiedź logout niesie
dokładnie jeden `Set-Cookie` (delete, `Max-Age=0`); po wylogowaniu + odświeżeniu
użytkownik pozostaje wylogowany; trasy prywatne redirectują na `/`; ponowne
logowanie i rolling-refresh dla GET działają.

### Dodatkowy zakres: aktualizacja dokumentacji po zmianach architektonicznych

W ramach tego change należy też **odświeżyć dokumentację** po ostatnim
refaktorze warstwy DB (change `fix-db-issue`, commity
`a541269`/`e7933c7`/`465fca1`):

- Klient DB nie jest już module-level singletonem (`export const db`) — jedyny
  dostęp to **fabryka per-request `getDb()`** (React `cache()`), z hardeningiem
  połączenia
  (`max:3, prepare:false, fetch_types:false, connect_timeout:10, idle_timeout:20`).
- NextAuth używa **lazy config factory** `NextAuth(() => ({…}))`; adapter i
  `authorize` pobierają `getDb()` per-request — istotne przy diagnozie sesji/
  wylogowania w tym change.
- Pooler Supabase: dla Workers właściwy jest **transaction mode (port 6543)**;
  `prepare:false` jest pod niego.

Do przejrzenia/aktualizacji m.in.: `CLAUDE.md`/`AGENTS.md` (jeśli wspominają
`import { db }`), README, komentarze i wszelkie docs/odniesienia do starego
singletonu. Cel: dokumentacja nie opisuje już nieistniejącego wzorca.
