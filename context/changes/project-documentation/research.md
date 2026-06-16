---
date: 2026-06-16T12:00:00+02:00
researcher: Kacper Nadstoga
git_commit: fdf79b3
branch: delete-session
repository: PixelSculptor/osce-traiger
topic:
  'Co powinno zawierać README.md dla rekrutera odwiedzającego repozytorium na
  GitHub'
tags: [research, documentation, readme, portfolio]
status: complete
last_updated: 2026-06-16
last_updated_by: Kacper Nadstoga
---

# Research: README.md jako portfolio dla rekrutera

**Date**: 2026-06-16  
**Researcher**: Kacper Nadstoga  
**Git Commit**: fdf79b3  
**Branch**: delete-session  
**Repository**: PixelSculptor/osce-traiger

## Pytanie badawcze

Co powinno znaleźć się w README.md projektu OSCE Triager, aby był skutecznym
portfolio dla rekrutera odwiedzającego repozytorium na GitHub? Odbiorca:
potencjalny pracodawca / rekruter techniczny. Format wyjściowy: lista sekcji z
uzasadnieniem.

## Podsumowanie

Projekt OSCE Triager to kompletny, wdrożony na produkcję full-stack simulator
diagnostyczny z 45 testami, CI/CD pipeline, dual theme i RODO-compliant account
deletion. README powinno eksponować: problem domenowy (wyróżnik), stack (Next.js
16 + Cloudflare Workers), architekturę (walidator diagnostyczny, Server Actions,
Drizzle schema), zasięg testów oraz kluczowe decyzje techniczne. README jest
puste (`README.md`, 1 linia) — wszystko do zbudowania od zera.

---

## Zalecane sekcje README (z uzasadnieniem)

### 1. Nagłówek: nazwa + jednozdaniowy tagline

**Uzasadnienie:** Rekruter widzi to jako pierwsze. Tagline powinien komunikować
problem i domenę w <15 słowach.

**Proponowana treść:**

> **OSCE Triager** — interaktywny symulator ścieżki diagnostycznej dla studentów
> VI roku medycyny przygotowujących się do egzaminów OSCE.

**Opcjonalnie:** badges CI (GitHub Actions), Deployment (Cloudflare Workers),
TypeScript strict.

---

### 2. Demo / Live URL + screenshot

**Uzasadnienie:** Rekruter bez demo nie może ocenić UI/UX. Aplikacja jest
wdrożona na Cloudflare Workers (`https://osce-triager.kapix007.workers.dev` — z
`wrangler.jsonc:28`). Screenshot lub GIF sesji diagnostycznej (drag-drop
testów + badge walidatora) natychmiast komunikuje funkcjonalność.

**Co pokazać:**

- Strona logowania → dashboard → sesja z timerem → wybór badań → feedback
  „Poprawne/Zbędne" → wynik sesji.
- Dual theme light/dark (token design system).

---

### 3. Problem i kontekst

**Uzasadnienie:** Wyróżnik projektu to głęboki problem domenowy, nie
technologia. Rekruter musi zrozumieć, _dlaczego_ to ciekawe.

**Kluczowe fakty z `prd.md`:**

- Student VI roku medycyny nie ma narzędzia trenującego algorytmy diagnostyczne
  pod presją czasu z natychmiastową informacją zwrotną.
- Bariera wejścia dla twórców: wymagana ekspertyza kliniczna — stąd luka
  rynkowa.
- Walidator ocenia każdy wybór w czasie rzeczywistym:
  critical/optimal/acceptable/unnecessary →
  correct/suboptimal/unnecessary/critical_miss.
- Pominięcie badania ratującego życie → sesja nieodwracalnie negatywna
  (kontynuacja w trybie nauki).

---

### 4. Stack techniczny

**Uzasadnienie:** Rekruter techniczny skanuje stack w ~10 sekund. Lista musi być
zwięzła i precyzyjna — wersje i rola każdej biblioteki.

**Faktyczne wersje z `package.json`:**

| Obszar        | Technologia                         | Wersja                         |
| ------------- | ----------------------------------- | ------------------------------ |
| Framework     | Next.js (App Router)                | 16.2.6                         |
| UI            | React                               | 19.2.4                         |
| Język         | TypeScript                          | 5.x                            |
| Auth          | NextAuth.js (Credentials)           | 5.0.0-beta.31                  |
| ORM           | Drizzle ORM                         | 0.45.2                         |
| Baza danych   | PostgreSQL via Supabase             | —                              |
| Deploy        | Cloudflare Workers (OpenNext)       | @opennextjs/cloudflare 1.19.11 |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable   | 6.3.1 / 10.0.0                 |
| Ikony         | lucide-react                        | 1.18.0                         |
| Dark mode     | next-themes                         | 0.4.6                          |
| Testy unit    | Vitest                              | 3.2.6                          |
| Testy E2E     | Playwright                          | 1.60.0                         |
| CI/CD         | GitHub Actions                      | —                              |
| Stylowanie    | CSS Modules + CSS Custom Properties | —                              |

---

### 5. Kluczowe funkcjonalności

**Uzasadnienie:** Rekruter chce wiedzieć, co aplikacja robi — nie jak jest
zbudowana. Punktorowa lista z fokusem na wartość użytkownika.

**Fakty z `prd.md`, `roadmap.md`, architektury:**

- **Sesja diagnostyczna z timerem** — 2 hardcoded scenariusze kliniczne (ból w
  klatce piersiowej 300s, zaburzenia świadomości 240s) z odliczaniem czasu
  (`session/[sessionId]/page.tsx`)
- **Walidator w czasie rzeczywistym** — 18 badań diagnostycznych, 36
  klasyfikacji (per scenariusz), deterministyczny feedback po każdym wyborze
  (`src/shared/lib/validator.ts`)
- **Drag-and-drop ordering** — zmiana kolejności zleconych badań (@dnd-kit,
  `DraggableTestCard`, `SortableTestCard`)
- **Historia sesji z filtrowaniem** — lista zakończonych sesji z wynikami
  (positive/negative), filtr po stronie klienta (`HistoryFilter`)
- **Usuwanie sesji** — CRUD kompletny z IDOR guardem i potwierdzeniem modalnym
  (`deleteSessionAction`)
- **Dual theme light/dark** — jawnie sterowany przez `data-theme` + next-themes,
  tokeny OKLCH (`globals.css`)
- **Usunięcie konta (RODO)** — soft-delete z 30-dniową retencją, automatyczny
  cleanup cron (`cleanup.yml`)
- **Rejestracja i logowanie** — e-mail + hasło, bcryptjs, walidacja w Server
  Actions

---

### 6. Architektura

**Uzasadnienie:** Senior developer / tech lead chce zobaczyć decyzje
architektoniczne. Krótki opis + diagram lub lista kluczowych wzorców.

**Kluczowe wzorce z kodu:**

**Moduły domenowe** (`src/modules/`):

- `auth/` — rejestracja, logowanie, wylogowanie (Server Actions + NextAuth
  credentials)
- `session/` — start sesji, wybór badań, koniec sesji, usuwanie (Server
  Actions + queries)
- `account/` — żądanie/anulowanie usunięcia konta

**Shared** (`src/shared/`):

- `lib/validator.ts:32-38` — walidator diagnostyczny (czysta funkcja,
  deterministic)
- `lib/schema.ts:1-134` — Drizzle schema: 4 tabele auth + 5 tabel domenowych
- `components/` — Button (4 warianty), Spinner, Nav, ThemeToggle, ConfirmModal

**Kluczowe decyzje (portfolio-worthy):**

1. **Server Actions zamiast REST API** — brak API routes dla operacji
   domenowych, bezpośrednie połączenie formularze → DB
2. **Server-only query modules** — `queries.ts` importowane tylko z Server
   Components (lekcja z `lessons.md`)
3. **Edge-compatible middleware** — `middleware.ts` (Edge runtime) +
   `auth.config.ts` split pattern dla NextAuth na Cloudflare Workers
   (`src/middleware.ts:1-22`)
4. **Design tokens CSS** — 100+ custom properties w `globals.css` (kolory OKLCH,
   spacing 4px grid, typografia Inter + IBM Plex Mono, motion)
5. **IDOR guard w każdym query** — `AND user_id = session.user.id` w każdym DB
   query dla izolacji danych

---

### 7. Schemat bazy danych

**Uzasadnienie:** Pokazuje rozumienie modelowania danych. Wystarczy tabela lub
prosty diagram ERD.

**Fakty z `src/shared/lib/schema.ts:1-134`:**

Auth tables (NextAuth): `user`, `account`, `session`, `verificationToken`

Domain tables:

- `scenario` — scenariusze kliniczne (id, title, description,
  time_limit_seconds)
- `diagnostic_test` — badania diagnostyczne (id, name)
- `test_classification` — klasyfikacja (scenario_id, test_id, classification:
  critical|optimal|acceptable|unnecessary) — PK na parze
- `session_result` — wynik sesji (user_id FK, scenario_id FK, outcome:
  in_progress|positive|negative, is_failed)
- `session_event` — zdarzenia (session_id FK, test_id FK, validator_result:
  correct|suboptimal|unnecessary|critical_miss)

Migracje: `drizzle/migrations/` (3 pliki SQL).

---

### 8. Testy — zakres i strategia

**Uzasadnienie:** 45 testów pokrywających 8 ryzyk biznesowych to mocny sygnał
quality mindset. Warto wymienić konkretne scenariusze.

**Fakty z agenta badającego testy:**

| Kategoria          | Liczba | Narzędzie         |
| ------------------ | ------ | ----------------- |
| Unit / Integration | 35     | Vitest 3.2.6      |
| E2E                | 10     | Playwright 1.60.0 |
| **Łącznie**        | **45** | —                 |

**8 ryzyk biznesowych pokrytych (z `test-plan.md`):**

1. Cichy domyślny wynik "unnecessary" z pustą mapą klasyfikacji —
   `validator.test.ts`
2. Cross-account IDOR (Student B widzi sesje Studenta A) — `queries.test.ts`
3. Cichy błąd zapisu sesji do DB — `actions.test.ts` (hermetic + vi.spyOn)
4. Zepsute DnD dla pierwszego/ostatniego elementu —
   `SessionView.reorder.test.ts`
5. Soft-deleted konto przeżywa 30-dni okno retencji — `cleanup.test.mjs`
6. Middleware cicho przepuszcza nieuwierzytelniony dostęp —
   `auth-boundary.spec.ts`
7. Główny flow diagnostyczny niepokryty E2E — `session-flow.spec.ts`
8. auth.setup.ts ładuje saved-state zamiast wypełniać formularz —
   `login-form.spec.ts`

---

### 9. CI/CD pipeline

**Uzasadnienie:** Pokazuje dojrzałość procesu wytwarzania. Rekruter techniczny
zwróci na to uwagę.

**Fakty z `.github/workflows/`:**

**`ci.yml`** (trigger: PR → main, 4 równoległe jobs):

1. `lint-typecheck` — ESLint 9 + `tsc --noEmit`
2. `unit-tests` — Vitest (potrzebuje: lint-typecheck)
3. `integration-tests` — Vitest z lokalnym Supabase + `drizzle-kit push`
   (potrzebuje: lint-typecheck)
4. `e2e-tests` — Playwright + seed data + `npm run build` (potrzebuje:
   lint-typecheck)

**`deploy.yml`** (trigger: push → main):

1. `drizzle-kit migrate` na produkcyjnym DB
2. lint + typecheck
3. `npm run deploy` → Cloudflare Workers (OpenNext)

**`cleanup.yml`** (trigger: cron `0 2 * * *`):

- Usuwa konta z `deletion_requested_at < NOW() - 30 days` + cascade +
  verificationToken

---

### 10. Lokalne uruchomienie

**Uzasadnienie:** Profesjonalny README ma tę sekcję — sygnał że projekt nie jest
"tylko portfolio demo" ale rzeczywiście działa lokalnie. Można umieścić na końcu
lub schować za `<details>`.

**Wymagania:**

- Node.js ≥22 (wrangler requirement)
- Supabase CLI
- Konto Cloudflare (dla deploy)

**Kluczowe komendy z `package.json`:**

```bash
npm install
# ustaw zmienne środowiskowe w .env.local (DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, AUTH_URL)
npx supabase start
npx drizzle-kit push
npm run seed
npm run dev        # http://localhost:3000
npm run test       # Vitest unit + integration
npm run test:e2e   # Playwright E2E
```

---

## Referencje do kodu

- `package.json` — dependencies, devDependencies, scripts
- `wrangler.jsonc:4-29` — konfiguracja Cloudflare Workers
- `src/shared/lib/validator.ts:1-49` — walidator diagnostyczny
- `src/shared/lib/schema.ts:1-134` — Drizzle schema
- `src/middleware.ts:1-22` — ochrona tras (Edge runtime)
- `src/modules/session/actions.ts:1-236` — Server Actions sesji
- `src/app/globals.css:1-376` — design tokens CSS
- `.github/workflows/ci.yml` — CI pipeline
- `.github/workflows/deploy.yml` — deploy pipeline
- `.github/workflows/cleanup.yml` — RODO cron
- `scripts/cleanup-expired-accounts.mjs` — logika retencji 30 dni
- `context/foundation/prd.md` — problem statement
- `context/foundation/roadmap.md` — status features (wszystkie done)

---

## Architektoniczne wnioski

1. **Pełny stack od bazy do deployu** — projekt pokonuje cały path: Drizzle
   migracje → Server Actions → Server Components → Cloudflare Workers. Dla
   rekrutera to signal, że autor rozumie cały łańcuch.

2. **Walidator jako core domain logic** — `validator.ts` to 49 linii czystej
   logiki domenowej bez zależności. Wyróżnik techniczny.

3. **RODO jako feature, nie afterthought** — cleanup cron z boundary testami to
   unusual dla portfolio projektu. Warto to eksponować.

4. **Test-driven mindset** — 8 ryzyk → 8 pokrytych testami, nie coverage for
   coverage's sake.

5. **Cloudflare Workers gotcha** — `middleware.ts` / `auth.config.ts` split dla
   Edge runtime to nieoczywista decyzja. Warto ją opisać jako "key technical
   decision".

---

## Kontekst historyczny

- `context/foundation/prd.md` — problem statement i user stories
- `context/foundation/roadmap.md` — 16 tasków (F-01..T-06), wszystkie done
- `context/foundation/infrastructure.md` — decyzja Cloudflare vs Vercel (5/5
  kryteriów)
- `context/changes/auth-flow/reviews/impl-review.md` — impl review F1-F3 fix
- `context/foundation/test-plan.md` — strategia testów (fazy T-01..T-06)

---

## Otwarte pytania

1. Czy jest już live URL do eksponowania w README? (wrangler.jsonc wskazuje
   `https://osce-triager.kapix007.workers.dev` — warto zweryfikować czy aktywny)
2. Czy są screenshoty / GIF aplikacji? Warto nagrać przed pisaniem README —
   demo > opis.
3. Czy sekcja "Lokalne uruchomienie" ma mieć pełny setup z `.env.local.example`?
   Można dodać plik przykładowy.
