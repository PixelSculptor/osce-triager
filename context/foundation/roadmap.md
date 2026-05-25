---
project: "OSCE Triager"
version: 1
status: draft
created: 2026-05-25
updated: 2026-05-25
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
| F-01  | auth-scaffold           | (fundament) Auth.js + e-mail+hasło; sesje użytkownika wydawane i weryfikowane                 | —                 | FR-001, FR-002                                  | ready    |
| F-03  | ci-cd-pipeline          | (fundament) GitHub Actions auto-deploy na Cloudflare przy każdym merge                       | —                 | NFR: Chrome/Firefox/Safari                      | ready    |
| F-02  | data-schema             | (fundament) Drizzle + Supabase: tabele dziedzinowe + seed hardcoded scenariuszy i listy badań | F-01              | FR-003, FR-004, FR-008                          | proposed |
| S-01  | auth-flow               | zalogować się i wylogować z kontem e-mail+hasło                                               | F-01              | FR-001, FR-002                                  | proposed |
| S-02  | first-playable-session  | otworzyć scenariusz z timerem, wybrać badania i dostać feedback walidatora ★                 | S-01, F-02        | FR-003, FR-004, FR-005, FR-006, FR-007, US-01   | proposed |
| S-03  | session-history-save    | zobaczyć wynik sesji zapisany w swoim koncie po jej zakończeniu                               | S-02              | FR-008, US-01                                   | proposed |

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
- **Status:** ready

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
- **Status:** ready

---

### F-02: Schemat danych dziedzinowych

- **Wynik:** (fundament) Drizzle + Supabase PostgreSQL: tabele `scenarios`, `diagnostic_tests`, `session_results`, `session_events` skonfigurowane z migracją; dane seed — hardcoded scenariusze kliniczne z klasyfikacją badań (krytyczne/optymalne/akceptowalne/zbędne).
- **ID zmiany:** data-schema
- **Odniesienia do PRD:** FR-003, FR-004, FR-008, sekcja Business Logic (klasyfikacja badań)
- **Odblokowuje:** S-02 (walidator potrzebuje klasyfikacji badań z bazy), S-03 (zapis historii wymaga tabel sesji)
- **Wymagania wstępne:** F-01 (tabela `users` tworzona przez adapter Auth.js — FK w `session_results`)
- **Równolegle z:** S-01
- **Blokady:** —
- **Niewiadome:** „Które hardcoded scenariusze kliniczne wejdą do MVP i ile ich będzie?" — Właściciel: autor (wiedza medyczna VI roku OSCE). Blokada: nie — autor może określić treść scenariuszy przed implementacją; rekomendacja: ≤ 3 scenariusze przy celu speed.
- **Ryzyko:** Więcej niż 3 hardcoded scenariusze = więcej czasu na treść medyczną i seed; przy celu speed trzymać zakres minimalny. Schemat musi egzekwować izolację danych przez `user_id` w każdym wierszu `session_results`.
- **Status:** proposed

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
- **Status:** proposed

---

### S-02: Pierwsza sesja diagnostyczna z walidatorem ★

- **Wynik:** Student może otworzyć hardcoded scenariusz kliniczny z odliczaniem czasu, wybrać badania diagnostyczne z listy i dostać natychmiastowy feedback walidatora — w tym oznaczenie sesji jako nieodwracalnie negatywnej po pominięciu badania ratującego życie.
- **ID zmiany:** first-playable-session
- **Odniesienia do PRD:** FR-003, FR-004, FR-005, FR-006, FR-007, US-01, sekcja Business Logic
- **Wymagania wstępne:** S-01, F-02
- **Równolegle z:** —
- **Blokady:** —
- **Niewiadome:**
  - „Jaka jest klasyfikacja każdego badania diagnostycznego dla każdego hardcoded scenariusza (krytyczne/optymalne/akceptowalne/zbędne)?" — Właściciel: autor (wiedza medyczna VI roku). Blokada: nie — do określenia przed implementacją F-02 seed.
- **Ryzyko:** NFR: walidator musi odpowiadać w <1 s — logika klasyfikacji musi być deterministyczna i wykonywana po stronie serwera; walidacja client-side narusza zasadę determinizmu z PRD.
- **Status:** proposed

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
- **Status:** proposed

---

## Przekazanie do backlogu

| ID mapy drogowej | ID zmiany               | Sugerowany tytuł problemu                                        | Gotowe do `/10x-plan` | Uwagi                                                                         |
|------------------|-------------------------|------------------------------------------------------------------|-----------------------|-------------------------------------------------------------------------------|
| F-01             | auth-scaffold           | [F-01] Szkielet Auth.js + e-mail+hasło na Cloudflare Workers    | yes                   | Uruchom `/10x-plan auth-scaffold`                                             |
| F-03             | ci-cd-pipeline          | [F-03] GitHub Actions CI/CD → Cloudflare Pages                  | yes                   | Uruchom `/10x-plan ci-cd-pipeline`; można równolegle z F-01                  |
| F-02             | data-schema             | [F-02] Drizzle + Supabase: schemat dziedzinowy + seed scenariuszy | no                   | Czeka na F-01; rozwiąż Open Question #2 (scenariusze) przed startem          |
| S-01             | auth-flow               | [S-01] UI rejestracji i logowania e-mail+hasło                  | no                    | Czeka na F-01; może startować równolegle z F-02                               |
| S-02             | first-playable-session  | [S-02] Pierwsza sesja diagnostyczna z walidatorem ★             | no                    | Czeka na S-01 + F-02; gwiazda przewodnia                                      |
| S-03             | session-history-save    | [S-03] Zapis i wyświetlenie historii sesji w koncie studenta    | no                    | Czeka na S-02                                                                 |

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

(Puste przy pierwszym generowaniu. `/10x-archive` dodaje tutaj wpis — i zmienia `Status` tego elementu na `done` — gdy zmiana odpowiadająca elementowi zostanie zarchiwizowana.)
