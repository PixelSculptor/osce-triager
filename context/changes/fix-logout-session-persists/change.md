---
change_id: fix-logout-session-persists
title: Wylogowanie nie czyści sesji — użytkownik wraca zalogowany po odświeżeniu
status: planned
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
