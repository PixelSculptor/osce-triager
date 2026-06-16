# Project documentation — Plan implementacji

## Przegląd

Napisanie README.md od zera dla projektu OSCE Triager. README ma pełnić rolę
portfolio dla rekruterów technicznych odwiedzających repozytorium na GitHub —
eksponując problem domenowy, stack, architekturę, zasięg testów i kluczowe
decyzje techniczne. Zadanie jest czysto dokumentacyjne: żadnych zmian w kodzie.

## Analiza stanu obecnego

- `README.md` istnieje ale zawiera 1 pustą linię — brak jakiejkolwiek treści
- Cały materiał źródłowy zebrany w
  `context/changes/project-documentation/research.md` (10 sekcji z
  uzasadnieniem, wersje, ścieżki kodu, wzorce architektoniczne)
- Live URL: `https://osce-triager.kapix007.workers.dev` (z `wrangler.jsonc:28`)
  — niezweryfikowana aktywność
- Brak screenshotów w repozytorium

## Pożądany stan końcowy

Repozytorium posiada:

1. `docs/screenshots/` z 3 screenshotami kluczowych ekranów (login, sesja,
   wyniki)
2. `README.md` w języku angielskim z 10 sekcjami zgodnie z `research.md`
3. CI badge GitHub Actions renderujący się poprawnie w nagłówku
4. Klikalny link do deployed aplikacji

Weryfikacja: README wygląda profesjonalnie na stronie GitHub repo — rekruter
widzi demo, stack i kluczowe decyzje bez otwierania kodu źródłowego.

### Kluczowe odkrycia:

- `README.md:1` — plik istnieje, 1 pusta linia
- `context/changes/project-documentation/research.md` — kompletna specyfikacja
  10 sekcji z wersjami (Next.js 16.2.6, React 19.2.4, Drizzle 0.45.2) i
  ścieżkami kodu
- `wrangler.jsonc:28` — live URL: `https://osce-triager.kapix007.workers.dev`
- `.github/workflows/ci.yml` — CI pipeline (trigger: PR → main, 4 jobs
  równoległe)
- `package.json` — wszystkie dokładne wersje stack

## Czego NIE robimy

- Nie tworzymy `.env.local.example` (zwięzła sekcja local setup bez osobnego
  pliku)
- Nie dodajemy badges TypeScript ani Cloudflare — tylko CI status
- Nie tworzymy wiki, docs/ site ani dodatkowej dokumentacji
- Nie refaktoryzujemy kodu — zmiana czysto dokumentacyjna
- Nie dodajemy sekcji CONTRIBUTING, CODE_OF_CONDUCT

## Podejście do implementacji

Dwie fazy sekwencyjne: najpierw visual assets (weryfikacja live URL +
screenshoty), potem pełny README w angielskim oparty na research.md. Screenshoty
muszą istnieć przed pisaniem README — są referencjonowane inline w sekcji Demo.

---

## Faza 1: Visual assets

### Przegląd

Zweryfikowanie live URL i wykonanie 3 screenshotów reprezentatywnych ekranów
aplikacji, zapisanie do `docs/screenshots/`. Screenshoty będą linkowane inline w
README.

### Wymagane zmiany:

#### 1. Katalog `docs/screenshots/` — 3 pliki PNG

**Pliki**:

- `docs/screenshots/login.png` — strona logowania (pierwsze wrażenie, design
  system)
- `docs/screenshots/session.png` — aktywna sesja diagnostyczna (timer, lista
  badań, drag-and-drop, feedback walidatora — najważniejszy screen, pokazuje
  core value prop)
- `docs/screenshots/results.png` — wynik sesji (score, badge positive/negative)

**Cel**: Wizualne potwierdzenie działającej aplikacji — rekruter bez klikania
widzi UI.

**Kontrakt**: Screenshoty wykonane z live URL lub lokalnie (`npm run dev`).
Format PNG, szerokość min. 1200px, rozmiar każdego pliku <1MB. Jeden spójny
motyw (light lub dark). Pliki committed do repo — GitHub renderuje je
bezpośrednio w markdown.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Pliki istnieją:
  `ls docs/screenshots/login.png docs/screenshots/session.png docs/screenshots/results.png`

#### Weryfikacja ręczna:

- Live URL `https://osce-triager.kapix007.workers.dev` otwiera się i renderuje
  aplikację
- Screenshoty widoczne poprawnie po otwarciu pliku lokalnie
- Rozmiar każdego pliku <1MB (weryfikacja: `du -sh docs/screenshots/*.png`)

**Uwaga implementacyjna**: Po zakończeniu fazy i weryfikacji screenshotów
zatrzymaj się na ręcznym potwierdzeniu przed przejściem do Fazy 2.

---

## Faza 2: README.md

### Przegląd

Napisanie kompletnego `README.md` w języku angielskim, 10 sekcji zgodnie z
`context/changes/project-documentation/research.md`. Tłumaczenie i adaptacja
treści z polskiego dokumentu badawczego na angielski.

### Wymagane zmiany:

#### 1. `README.md` — pełna treść (10 sekcji)

**Plik**: `README.md`

**Cel**: Zastąpić pustą linię kompletnym portfolio README. Odbiorca: rekruter
techniczny i senior developer skanujący repo na GitHub. Dokładna treść każdej
sekcji opisana w `context/changes/project-documentation/research.md`.

**Kontrakt — kolejność i zawartość sekcji:**

1. **Header** — `# OSCE Triager` + jednozdaniowy tagline EN (≤15 słów: "An
   interactive diagnostic pathway simulator for 6th-year medical students
   preparing for OSCE exams")
   - CI badge:

   ```markdown
   [![CI](https://github.com/PixelSculptor/osce-traiger/actions/workflows/ci.yml/badge.svg)](https://github.com/PixelSculptor/osce-traiger/actions/workflows/ci.yml)
   ```

2. **Demo** — Live URL + 3 screenshoty inline:

   ```markdown
   ## Demo

   **Live**: https://osce-triager.kapix007.workers.dev
   ![Login](docs/screenshots/login.png) ![Session](docs/screenshots/session.png)
   ![Results](docs/screenshots/results.png)
   ```

3. **Problem & Context** — problem domenowy z `research.md §3`: brak narzędzia
   treningowego dla studentów medycyny, bariera wejścia (ekspertyza kliniczna),
   walidator w czasie rzeczywistym (4 klasyfikacje → feedback), pominięcie
   badania krytycznego → sesja nieodwracalnie negatywna

4. **Tech Stack** — tabela z `research.md §4`: 14 wierszy (Framework, UI,
   Language, Auth, ORM, Database, Deploy, Drag-and-drop, Icons, Dark mode, Unit
   tests, E2E, CI/CD, Styling) z dokładnymi wersjami

5. **Key Features** — 8 punktorów z `research.md §5`: Diagnostic session timer,
   Real-time validator, Drag-and-drop ordering, Session history with filtering,
   Session deletion (IDOR guard), Dual light/dark theme, GDPR account deletion
   (30-day retention + cron), Authentication (email + password)

6. **Architecture** — moduły domenowe (`auth/`, `session/`, `account/`) + shared
   (`validator.ts`, `schema.ts`, `components/`) + 5 kluczowych decyzji z
   `research.md §6`: Server Actions vs REST, server-only query modules, Edge
   middleware split, CSS design tokens, IDOR guard pattern

7. **Database Schema** — 9 tabel z `research.md §7`: 4 auth (NextAuth) + 5
   domenowych (scenario, diagnostic_test, test_classification, session_result,
   session_event) z opisem relacji i enumów

8. **Testing** — tabela coverage z `research.md §8` (35 unit/integration
   Vitest + 10 E2E Playwright = 45 łącznie) + lista 8 pokrytych ryzyk
   biznesowych

9. **CI/CD Pipeline** — 3 workflows z `research.md §9`: ci.yml (4 jobs
   równoległe), deploy.yml (migrate → lint → deploy), cleanup.yml (cron 02:00
   UTC)

10. **Local Development** — 6 komend z `research.md §10` + lista wymaganych
    zmiennych środowiskowych: `DATABASE_URL`, `AUTH_SECRET`,
    `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_URL`;
    wymagania: Node.js ≥22, Supabase CLI

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Plik istnieje i nie jest pusty: `wc -l README.md` (wynik ≥ 80 linii)
- Wszystkie sekcje obecne: `grep -c "^##" README.md` (wynik ≥ 10)
- Screenshoty referencjonowane: `grep -c "docs/screenshots" README.md` (wynik
  ≥ 3)
- CI badge obecny: `grep -c "badge.svg" README.md` (wynik ≥ 1)

#### Weryfikacja ręczna:

- README renderuje się poprawnie na GitHub (brak broken markdown, tabele
  wyrównane)
- CI badge wyświetla status (zielony/żółty — nie broken image icon)
- Screenshoty widoczne inline w sekcji Demo
- Live URL link klikalny i prowadzi do działającej aplikacji
- README czytelne jako pierwsze wrażenie — hero + demo widoczne bez głębokiego
  scrollowania

---

## Strategia testowania

### Kroki testowania ręcznego:

1. Otwórz `https://github.com/PixelSculptor/osce-traiger` po pushu na branch —
   sprawdź rendering README na stronie repo
2. Kliknij live URL w sekcji Demo — weryfikacja aktywności
3. Kliknij CI badge — link prowadzi do GitHub Actions `ci.yml`
4. Sprawdź screenshoty — wyświetlają się inline, nie są broken images
5. Scroll przez cały README — każda sekcja czytelna i kompletna
6. Otwórz na urządzeniu mobilnym (GitHub mobile) — check czytelności tabel

## Referencje

- Badania: `context/changes/project-documentation/research.md`
- Live URL: `https://osce-triager.kapix007.workers.dev` (`wrangler.jsonc:28`)
- CI workflow: `.github/workflows/ci.yml`
- Tech stack: `package.json`
- DB schema: `src/shared/lib/schema.ts:1-134`

---

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku.

### Faza 1: Visual assets

#### Automatyczne

- [ ] 1.1 Pliki istnieją:
      `ls docs/screenshots/login.png docs/screenshots/session.png docs/screenshots/results.png`

#### Ręczne

- [ ] 1.2 Live URL `https://osce-triager.kapix007.workers.dev` aktywny i
      renderuje aplikację
- [ ] 1.3 Screenshoty poprawnie otwierają się, rozmiar <1MB każdy
      (`du -sh docs/screenshots/*.png`)

### Faza 2: README.md

#### Automatyczne

- [ ] 2.1 README nie jest pusty: `wc -l README.md` (min. 80 linii)
- [ ] 2.2 Wszystkie sekcje obecne: `grep -c "^##" README.md` (≥ 10)
- [ ] 2.3 Screenshoty referencjonowane: `grep -c "docs/screenshots" README.md`
      (≥ 3)
- [ ] 2.4 CI badge obecny: `grep -c "badge.svg" README.md` (≥ 1)

#### Ręczne

- [ ] 2.5 README renderuje się poprawnie na GitHub (brak broken markdown)
- [ ] 2.6 CI badge wyświetla status (nie broken image)
- [ ] 2.7 Screenshoty inline widoczne w sekcji Demo
- [ ] 2.8 Live URL link klikalny i prowadzi do aplikacji
