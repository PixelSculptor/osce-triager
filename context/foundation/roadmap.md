---
project: "OSCE Triager"
version: 1
status: draft
created: 2026-05-25
updated: 2026-06-02
prd_version: 1
main_goal: speed
top_blocker: time
---

# Mapa drogowa: OSCE Triager

> Pochodzi z `context/foundation/prd.md` (v1) + automatycznie zbadana baza kodu (2026-05-25).  
> Edytuj na miejscu; archiwizuj po zastąpieniu.  
> Fragmenty poniżej są wymienione w kolejności zależności. Tabela „W skrócie" to indeks.

## Podsumowanie wizji

Student VI roku medycyny przygotowujący się do egzaminów OSCE nie ma możliwości trenowania algorytmów postępowania pod presją czasu z natychmiastową informacją zwrotną. OSCE Triager to interaktywny symulator ścieżki diagnostycznej, który w czasie rzeczywistym penalizuje pominięcie badania ratującego życie — wypełniając lukę, którą bariera domenowa (wymagana ekspertyza kliniczna do tworzenia scenariuszy) sprawiła, że żaden typowy twórca oprogramowania edukacyjnego nie próbował jej zapełnić.

## Gwiazda przewodnia

**S-02: Pierwsza sesja diagnostyczna z walidatorem** — gwiazda przewodnia (najmniejszy kompletny przepływ od końca do końca, który udowadnia, że symulator działa — umieszczony tak wcześnie, jak pozwalają Wymagania wstępne) polega na tym, że student otwiera scenariusz kliniczny z timerem, klika badania z listy i dostaje natychmiastowy feedback od walidatora (komponent oceniający poprawność każdego wyboru w czasie rzeczywistym), w tym oznaczenie sesji jako nieodwracalnie negatywnej po pominięciu badania ratującego życie. Dopóki ten przepływ nie działa, reszta produktu jest bez znaczenia.

## W skrócie

| ID    | ID zmiany               | Wynik (użytkownik może …)                                                                     | Wymagania wstępne | Odniesienia do PRD                              | Status   |
|-------|-------------------------|-----------------------------------------------------------------------------------------------|-------------------|-------------------------------------------------|----------|
| F-01  | auth-scaffold           | (fundament) Auth.js + e-mail+hasło; sesje użytkownika wydawane i weryfikowane                 | —                 | FR-001, FR-002                                  | done     |
| F-03  | ci-cd-pipeline          | (fundament) GitHub Actions auto-deploy na Cloudflare przy każdym merge                       | —                 | NFR: Chrome/Firefox/Safari                      | done     |
| F-02  | data-schema             | (fundament) Drizzle + Supabase: tabele dziedzinowe + seed hardcoded scenariuszy i listy badań | F-01              | FR-003, FR-004, FR-008                          | done     |
| S-01  | auth-flow               | zalogować się i wylogować z kontem e-mail+hasło                                               | F-01              | FR-001, FR-002                                  | done     |
| S-02  | first-playable-session  | otworzyć scenariusz z timerem, wybrać badania i dostać feedback walidatora ★                 | S-01, F-02        | FR-003, FR-004, FR-005, FR-006, FR-007, US-01   | done     |
| S-03  | session-history-save    | zobaczyć wynik sesji zapisany w swoim koncie po jej zakończeniu                               | S-02              | FR-008, US-01                                   | planned  |
| S-04  | ux-improvements         | korzystać z interfejsu z przemyślaną paletą kolorów, animacjami, stanami ładowania i drag-and-drop | F-01, F-02, F-03 | NFR: UI/UX                                   | done     |
| S-05  | account-deletion        | zażądać usunięcia konta; dane usuwane trwale po 30-dniowym okresie retencji (wymóg RODO)      | F-01, F-02, F-03  | FR-002, sekcja Access Control                   | planned  |

## Strumienie

Pomoc nawigacyjna — grupuje elementy, które dzielą łańcuch Wymagań wstępnych. Kanoniczna kolejność nadal znajduje się w grafie zależności poniżej.

| Strumień | Temat       | Łańcuch                                              | Uwaga                                                                               |
|----------|-------------|------------------------------------------------------|-------------------------------------------------------------------------------------|
| A        | Pętla nauki | `F-01` → `F-02` / `S-01` (równolegle) → `S-02` → `S-03` | Główna ścieżka must-have; cel speed — gwiazda przewodnia S-02 tak wcześnie jak możliwe. |
| B        | Wdrożenie   | `F-03`                                               | Równolegle z F-01 od startu; umożliwia weryfikację deploymentu każdego fragmentu.    |

## Baza

Co już jest na miejscu w bazie kodu na dzień 2026-05-25 (automatycznie zbadane + potwierdzone).
Fundamenty poniżej zakładają, że te elementy są obecne i NIE tworzą ich ponownie.

- **Frontend:** częściowy — Next.js App Router scaffold (`src/app/layout.tsx`, `src/app/page.tsx`), CSS Modules; brak biblioteki komponentów
- **Backend / API:** nieobecna — brak Route Handlers, brak logiki serwera
- **Dane:** częściowa — katalog `supabase/` z `config.toml` istnieje; brak ORM, schematu i migracji SQL
- **Autoryzacja:** nieobecna — brak Auth.js/NextAuth, brak `middleware.ts`
- **Wdrożenie / infra:** częściowa — `wrangler.jsonc` skonfigurowany (Cloudflare Workers + OpenNext); brak `.github/workflows`
- **Obserwowalność:** nieobecna

## Fundamenty

### F-01: Szkielet uwierzytelniania

- **Wynik:** (fundament) Auth.js skonfigurowany z adapterem Drizzle i providerem e-mail+hasło; sesje użytkownika wydawane i weryfikowane w Cloudflare Workers runtime.
- **ID zmiany:** auth-scaffold
- **Odniesienia do PRD:** FR-001, FR-002, sekcja Access Control
- **Odblokowuje:** S-01 (UI przepływu auth), F-02 (struktura tabeli `users` do FK), ścieżka weryfikacji: „student może wejść na chronioną stronę"
- **Wymagania wstępne:** —
- **Równolegle z:** F-03
- **Blokady:** —
- **Niewiadome:** `AUTH_URL` i `AUTH_TRUST_HOST` muszą być jawnie ustawione w Cloudflare Workers runtime — nieoczywisty gotcha udokumentowany szczegółowo w `infrastructure.md`; do zweryfikowania przed pierwszym deployem. Blokada: nie.
- **Ryzyko:** Pominięcie konfiguracji `AUTH_URL` blokuje logowanie na produkcji — `infrastructure.md` opisuje tę pułapkę i sposób jej obejścia; sprawdzić przed deployem S-01.
- **Status:** done — zaimplementowane 2026-05-28 (branch `first-plan-and-implement`, commity `7e7e9df`–`baa18d6`; GitHub issue #7 zamknięte)

---

### F-03: Potok CI/CD

- **Wynik:** (fundament) GitHub Actions auto-deploy na Cloudflare Pages/Workers przy merge do main; każdy fragment weryfikowalny na środowisku produkcyjnym od pierwszego commita.
- **ID zmiany:** ci-cd-pipeline
- **Odniesienia do PRD:** NFR: Chrome/Firefox/Safari (weryfikacja wymaga środowiska produkcyjnego)
- **Odblokowuje:** ścieżka weryfikacji „aplikacja działa poprawnie na produkcji" dla S-01, S-02, S-03; `wrangler tail` dostępny od pierwszego deploy
- **Wymagania wstępne:** —
- **Równolegle z:** F-01
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** Bez CI/CD każdy deploy jest ręczny — akceptowalne przy celu speed na krótki sprint; brak CI/CD to dług techniczny do spłacenia najpóźniej przed S-02 (walidator wymaga weryfikacji na produkcji).
- **Status:** done — zaimplementowane 2026-05-28 (branch `first-plan-and-implement`, commity `444bef7`–`6ac608d`; GitHub issue #8 zamknięte). Kluczowe odkrycia: Next.js 16 `proxy.ts` to Node.js-only — middleware ochrony tras przeniesione do `middleware.ts` (Edge runtime); `auth.config.ts` wydzielone dla Edge-compatible middleware; Node.js bumped do 22 (wrangler wymaga >=22).

---

### F-02: Schemat danych dziedzinowych

- **Wynik:** (fundament) Drizzle + Supabase PostgreSQL: tabele `scenarios`, `diagnostic_tests`, `session_results`, `session_events` skonfigurowane z migracją; dane seed — hardcoded scenariusze kliniczne z klasyfikacją badań (krytyczne/optymalne/akceptowalne/zbędne).
- **ID zmiany:** data-schema
- **Odniesienia do PRD:** FR-003, FR-004, FR-008, sekcja Business Logic (klasyfikacja badań)
- **Odblokowuje:** S-02 (walidator potrzebuje klasyfikacji badań z bazy), S-03 (zapis historii wymaga tabel sesji)
- **Wymagania wstępne:** F-01 (tabela `users` tworzona przez adapter Auth.js — FK w `session_results`)
- **Równolegle z:** S-01
- **Blokady:** —
- **Niewiadome:** rozwiązane — 2 scenariusze kliniczne (ból klatki piersiowej + zaburzenia świadomości/hipoglikemia), 18 badań diagnostycznych z klasyfikacjami w `src/shared/lib/seed.ts`.
- **Ryzyko:** Schemat musi egzekwować izolację danych przez `user_id` w każdym wierszu `session_results`.
- **Status:** done — zaimplementowane 2026-05-28 (branch `first-plan-and-implement`, commity `63de06f`–`fdf0530`; GitHub issue #9 zamknięte). Kluczowe odkrycia: dotenvx v17 ignoruje `override:false` — seed.ts wymaga `DATABASE_URL` w środowisku; Transaction Pooler URL (port 6543) wymagany dla połączeń zewnętrznych.

---

## Fragmenty

### S-01: Przepływ rejestracji i logowania

- **Wynik:** Student może założyć konto e-mail+hasło, zalogować się i wylogować; niezalogowany użytkownik jest przekierowywany z każdej chronionej strony.
- **ID zmiany:** auth-flow
- **Odniesienia do PRD:** FR-001, FR-002, sekcja Access Control
- **Wymagania wstępne:** F-01
- **Równolegle z:** F-02
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** Strony auth to jedyne widoki dostępne bez logowania — niewystarczające middleware przekierowania powoduje wyciek scenariuszy do niezalogowanych użytkowników (naruszenie zasady bezpieczeństwa z PRD: izolacja dostępu).
- **Status:** done — zaimplementowane 2026-05-29 (branch `auth-flow-plan-implement`, commity `49f8b1d`–`a97c82d`; GitHub issue #10 zamknięte). Przeszło impl-review (`reviews/impl-review.md`): F1 (walidacja w `registerUser`), F2 (normalizacja e-maila), F3 (skrypt `typecheck`) naprawione w triage.

---

### S-02: Pierwsza sesja diagnostyczna z walidatorem ★

- **Wynik:** Student może otworzyć hardcoded scenariusz kliniczny z odliczaniem czasu, wybrać badania diagnostyczne z listy i dostać natychmiastowy feedback walidatora — w tym oznaczenie sesji jako nieodwracalnie negatywnej po pominięciu badania ratującego życie.
- **ID zmiany:** first-playable-session
- **Odniesienia do PRD:** FR-003, FR-004, FR-005, FR-006, FR-007, US-01, sekcja Business Logic
- **Wymagania wstępne:** S-01, F-02
- **Równolegle z:** —
- **Blokady:** —
- **Opcjonalne przed startem S-02:** Dodanie kroku `drizzle-kit migrate` do `.github/workflows/deploy.yml` — bez tego każda zmiana schematu wymaga ręcznej migracji produkcyjnej przed deployem. Nie blokuje implementacji S-02, ale upraszcza operacje. Zakres: 2-3 linie w `deploy.yml` + sekret `DATABASE_URL` w GitHub Secrets.
- **Niewiadome:**
  - „Jaka jest klasyfikacja każdego badania diagnostycznego dla każdego hardcoded scenariusza (krytyczne/optymalne/akceptowalne/zbędne)?" — rozwiązane w F-02 (2026-05-28): 18 badań, 2 scenariusze, dane w `src/shared/lib/seed.ts`.
- **Ryzyko:** NFR: walidator musi odpowiadać w <1 s — logika klasyfikacji musi być deterministyczna i wykonywana po stronie serwera; walidacja client-side narusza zasadę determinizmu z PRD.
- **Status:** done — zaimplementowane 2026-06-01 (branch `north-star-first-playable-flow`, commity `fa1c613`–`864c21c`; GitHub issue #11 zamknięte). Kluczowe odkrycia: `session.user.id` wymaga jawnych callbacks jwt/session w auth.ts; `server-only` wymaga instalacji pakietu + `import type` w client components; DB queries w RSC pages przeniesione do `queries.ts` (server-only query module).

---

### S-03: Zapis historii sesji

- **Wynik:** Student widzi wynik ukończonej sesji (pozytywny/negatywny) zapisany w swoim koncie; historia sesji jest izolowana — student A nie widzi sesji studenta B.
- **ID zmiany:** session-history-save
- **Odniesienia do PRD:** FR-008, US-01, NFR (izolacja danych)
- **Wymagania wstępne:** S-02
- **Równolegle z:** —
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** Izolacja danych sesji między kontami musi być egzekwowana na poziomie każdego zapytania DB (RLS w Supabase lub `WHERE user_id = session.user.id` w każdym zapytaniu) — błąd tu to naruszenie zasady prywatności z PRD.
- **Podejście:** 2 fazy — (1) historia listing + Nav link, (2) read-only detail view. Pełny plan: `context/changes/session-history-save/plan.md`.
- **Status:** planned

---

### S-04: Usprawnienia UX

- **Wynik:** Student korzysta z interfejsu z przemyślaną paletą kolorów (zamiast surowego czarno-białego), płynnymi animacjami i przejściami, spójnymi stanami ładowania, gradientami i cieniami; może przeciągać badania diagnostyczne (drag-and-drop) by zmienić ich kolejność na liście w trakcie sesji.
- **ID zmiany:** ux-improvements
- **Odniesienia do PRD:** NFR: UI/UX (estetyka, użyteczność)
- **Wymagania wstępne:** F-01, F-02, F-03
- **Równolegle z:** S-03
- **Blokady:** —
- **Niewiadome:** rozwiązane — `@dnd-kit/core` + `@dnd-kit/sortable` (9 KB, App Router compatible; `SessionView` już `'use client'`). Szczegóły: `context/changes/ux-improvements/drag-n-drop-research.md`.
- **Ryzyko:** Gest drag vs tap na mobile — `PointerSensor` z `activationConstraint: { distance: 8 }` zapobiega przypadkowym przeciągnięciom; zweryfikować na urządzeniu dotykowym. `@dnd-kit/core` v6.3.1 (~rok bez wydania) — akceptowalne dla tego zakresu.
- **Podejście:** 3 fazy — (1) tokeny CSS + przejścia, (2) spinner CSS, (3) DnD cross-container. Pełny plan: `context/changes/ux-improvements/plan.md`.
- **Status:** done — zaimplementowane 2026-06-02 (branch `feature/account-deletion`, commity `b85ad66`–`fc18de2`; GitHub issue #22 zamknięte). Kluczowe odkrycia: Turbopack nie obsługuje compound CSS selectors (`[data-attr]` w CSS Modules) — zamiast tego klasy CSS dla wariantów spinnera; `over` jest null przy pustej SortableContext — `handleDragEnd` wywołuje `handleSelectTest` bezwarunkowo dla source=available (aktywacja 8px już filtruje przypadkowe gesty).

---

### S-05: Usunięcie konta z retencją danych

- **Wynik:** Student może zażądać usunięcia konta; dane są trwale usuwane po 30-dniowym okresie retencji — wymóg RODO (prawo do bycia zapomnianym).
- **ID zmiany:** account-deletion
- **Odniesienia do PRD:** FR-002, sekcja Access Control
- **Wymagania wstępne:** F-01, F-02, F-03
- **Równolegle z:** S-03, S-04
- **Blokady:** —
- **Niewiadome:** mechanizm soft-delete (flaga `deleted_at` + cron job vs. scheduled function w Cloudflare Workers) — do rozstrzygnięcia w `/10x-research`.
- **Ryzyko:** Retencja 30 dni wymaga harmonogramu czyszczenia danych; wyciek danych po upływie retencji to naruszenie RODO.
- **Status:** planned

---

## Przekazanie do backlogu

| ID mapy drogowej | ID zmiany               | Sugerowany tytuł problemu                                        | Gotowe do `/10x-plan` | Uwagi                                                                         |
|------------------|-------------------------|------------------------------------------------------------------|-----------------------|-------------------------------------------------------------------------------|
| F-01             | auth-scaffold           | [F-01] Szkielet Auth.js + e-mail+hasło na Cloudflare Workers    | done                  | Zaimplementowane 2026-05-28; GitHub issue #7 zamknięte                        |
| F-03             | ci-cd-pipeline          | [F-03] GitHub Actions CI/CD → Cloudflare Pages                  | yes                   | Uruchom `/10x-plan ci-cd-pipeline`; można równolegle z F-02/S-01             |
| F-02             | data-schema             | [F-02] Drizzle + Supabase: schemat dziedzinowy + seed scenariuszy | yes                  | F-01 gotowe; rozwiąż Open Question #2 (scenariusze) przed startem            |
| S-01             | auth-flow               | [S-01] UI rejestracji i logowania e-mail+hasło                  | done                  | Zaimplementowane 2026-05-29; GitHub issue #10 zamknięte                        |
| S-02             | first-playable-session  | [S-02] Pierwsza sesja diagnostyczna z walidatorem ★             | yes                   | S-01 + F-02 gotowe; gwiazda przewodnia. Opcjonalnie przed startem: dodać `drizzle-kit migrate` do `deploy.yml` (2-3 linie + sekret DATABASE_URL w GitHub) |
| S-03             | session-history-save    | [S-03] Zapis i wyświetlenie historii sesji w koncie studenta    | yes                   | Plan gotowy (`plan.md`); uruchom `/10x-implement session-history-save phase 1`               |
| S-04             | ux-improvements         | [S-04] Usprawnienia UX: animacje, stany ładowania, drag-and-drop | done                 | Zaimplementowane 2026-06-02; GitHub issue #22 zamknięte                       |
| S-05             | account-deletion        | [S-05] Usunięcie konta z 30-dniową retencją danych (RODO)       | no                   | Uruchom `/10x-research account-deletion`, następnie `/10x-plan account-deletion` |

## Otwarte pytania dotyczące mapy drogowej

1. **Jak zdefiniować "optymalność" diagnostyczną w kontekście OSCE?** — Właściciel: autor (wymaga konsultacji z lekarzem lub literatury OSCE). Blokada: FR-009 (zaparkowane jako nice-to-have) — nie blokuje żadnego must-have elementu.

2. **Które hardcoded scenariusze kliniczne wejdą do MVP i ile ich będzie?** — Właściciel: autor. Blokada: F-02 (`data-schema` seed) — rozwiąż przed implementacją `data-schema`; rekomendacja: ≤ 3 scenariusze przy celu speed.

## Zaparkowane

- **FR-009: Optymalna ścieżka diagnostyczna z uzasadnieniem klinicznym** — Dlaczego zaparkowane: nice-to-have w PRD; zależy od rozwiązania Open Question #1 o "optymalności" diagnostycznej.
- **Dashboard postępu i statystyk długookresowych** — Dlaczego zaparkowane: §Non-Goals PRD.
- **Leaderboard i rywalizacja między studentami** — Dlaczego zaparkowane: §Non-Goals PRD.
- **Integracja z zewnętrznymi systemami medycznymi (MedLine, EHR)** — Dlaczego zaparkowane: §Non-Goals PRD.
- **Dynamiczna baza scenariuszy (CMS dla lekarzy)** — Dlaczego zaparkowane: §Non-Goals PRD; hardcoded warianty wystarczą na MVP.
- **Natywna aplikacja mobilna/desktopowa** — Dlaczego zaparkowane: §Non-Goals PRD.
- **Tryb offline** — Dlaczego zaparkowane: §Non-Goals PRD.
- **Pełna zgodność WCAG-AA** — Dlaczego zaparkowane: §Non-Goals PRD; podstawowa dostępność oczekiwana.
- **Obserwowalność (Sentry/OTEL/Pino)** — Dlaczego zaparkowane: brak w PRD jako NFR; `wrangler tail` wystarczy na MVP.

## Zrobione

| ID   | ID zmiany     | Wynik                                                                  | Data       | Commity              |
|------|---------------|------------------------------------------------------------------------|------------|----------------------|
| F-01 | auth-scaffold | Auth.js v5 + Drizzle + JWT sessions + Credentials + ochrona tras      | 2026-05-28 | `7e7e9df`–`baa18d6` |
| F-03 | ci-cd-pipeline | GitHub Actions → Cloudflare Workers deploy przy push do main; Edge middleware fix | 2026-05-28 | `444bef7`–`6ac608d` |
| F-02 | data-schema | 5 tabel domenowych + migracja + seed (2 scenariusze, 18 badań, 36 klasyfikacji) | 2026-05-28 | `63de06f`–`fdf0530` |
| S-01 | auth-flow | UI logowania/rejestracji, Server Actions, globalny Nav, landing page; impl-review + triage (F1–F3) | 2026-05-29 | `49f8b1d`–`a97c82d` |
| S-02 | first-playable-session | Scenariusze na dashboardzie, sesja z timerem, walidator inline, wynik końcowy; 6 faz (p0–p5) | 2026-06-01 | `fa1c613`–`864c21c` |
| S-04 | ux-improvements | Tokeny CSS + przejścia, spinner CSS, cross-container DnD (@dnd-kit); 3 fazy (p1–p3) | 2026-06-02 | `b85ad66`–`fc18de2` |
