---
date: 2026-06-15T14:21:50+0200
researcher: Kacper Nadstoga
git_commit: 5c69b218ff3af7870f7f557f4f1c46dcc2cfccb5
branch: ui-refresh
repository: osce-traiger
topic:
  'Odświeżenie UI po wdrożeniu design systemu — animacje, badge a11y w dark
  mode, navbar, layouty dashboard/history/details/settings, system przycisków,
  strona główna'
tags:
  [
    research,
    codebase,
    ui,
    design-system,
    dark-mode,
    a11y,
    navbar,
    dashboard,
    e2e-safety,
    animations,
  ]
status: complete
last_updated: 2026-06-15
last_updated_by: Kacper Nadstoga
last_updated_note:
  'Rozstrzygnięto Open Question #1 (punkt 11): usunąć linki auth z navbara,
  zaktualizować auth-boundary.spec.ts i seed.spec.ts na lokator homepage CTA'
---

# Research: Odświeżenie UI po wdrożeniu design systemu (ui-refresh)

**Date**: 2026-06-15T14:21:50+0200 **Researcher**: Kacper Nadstoga **Git
Commit**: 5c69b218ff3af7870f7f557f4f1c46dcc2cfccb5 **Branch**: ui-refresh
**Repository**: osce-traiger

## Research Question

Po wdrożeniu design systemu (`ui-design-system`, status done) UI jest
funkcjonalny, ale "surowy". Zmiana `ui-refresh` ma go zmodernizować — **bez
zaburzania flow ani testów E2E**. 12 punktów do zbadania:

1. UI surowy — brak przejść/animacji.
2. Badge wyniku w dark mode słabo widoczne (szare zamiast zielonych) + podpisy w
   skali szarości na ciemnym tle za ciemne → łamie a11y.
3. Navbar przestarzały, mało interaktywny, brak widocznego linku do `/dashboard`
   i `/`.
4. Szczegóły sesji na ciemnym tle nieczytelne; "kolejne badania" powinny być
   łączone linią z kropką (roadmap stepper).
5. Przyciski akcji na hover nie animują się ani nie zmieniają koloru (tylko
   `cursor: pointer`).
6. Historia badań — długa jednokolumnowa lista zajmuje tylko lewą część;
   przepisać na siatkę (1/2/3 kolumny), dodać filtry
   (pozytywne/negatywne/wszystkie), sortować zawsze od najnowszych.
7. `/account/settings` wygląda staro.
8. Redesign komponentów: przyciski słabo widoczne, prawie niezaokrąglone;
   "Wyloguj" ma za słabą obwódkę w dark; ThemeToggle przenieść między
   "Ustawienia" a "Wyloguj"; "Przejdź do Pulpitu" niespójny; lista testów na
   `/dashboard` w siatkę jak historia.
9. Navbar nieintuicyjny.
10. Strona główna toporna — wyjście z MVP, hero z SVG w tle, lepsze CTA; dla
    niezalogowanego usunąć przyciski auth z navbara (są na planszy głównej).
11. Animacje hover skokowe — mają być gładsze.

(Brak punktu 8 w briefie użytkownika — numeracja oryginalna zachowana.)

## Summary

**Diagnoza jednozdaniowa:** design system dostarczył komplet tokenów (kolory,
spacing, radius, **motion**, typografia), ale warstwa komponentów wykorzystuje
je tylko częściowo — stąd "surowość". Trzy klasy problemów:

1. **Dark mode jest niedokończony na poziomie tokenów statusu.** Blok
   `[data-theme='dark']` w `globals.css:207-237` **nie nadpisuje**
   `--color-success-*`, `--color-warning-*`, `--color-danger-*`,
   `--color-info-*` ani `--color-text-muted` (pozostaje `--slate-500` #62748e).
   To pojedyncza przyczyna źródłowa punktów 2 i 4: badge sukcesu renderuje się
   jasnym `--emerald-50` (#ecfdf5) tłem + `--emerald-700` (#007a55) tekstem na
   ciemnym surface (slate-900 #0f172b) → "szaro-zielony placek", a podpisy muted
   znikają. **To poprawka tokenowa — najwyższy zwrot z najmniejszym ryzykiem dla
   E2E.**

2. **Tokeny motion istnieją, ale komponenty ich nie używają lub używają
   martwo.** `--duration-moderate`, `--ease-out/-in/-in-out` są **nieużywane**;
   `--transition-fast` = `--duration-instant` = **100ms** (zbyt szybkie →
   wrażenie skokowości, punkt 12). Wiele przycisków ma `cursor: pointer` bez
   żadnego `:hover` (homepage CTA, settings, details "Wróć"), a
   `SessionView .backLink` i `.endButton:hover` mają **martwe** przejścia
   (transition bez zmiany / hover na ten sam kolor).

3. **Layouty nie są responsywne i nie skalują się na szerokość.** **Żaden**
   przeanalizowany plik CSS stron nie ma media queries; historia i lista
   scenariuszy to `flex-column` jednokolumnowy. Filtrów historii brak (ani UI,
   ani query). Sortowanie historii **już jest** poprawne po stronie serwera
   (`desc(completedAt)`). "Kolejne badania" to `<ol>` ponumerowanych kart bez
   connectora.

**Bezpieczeństwo E2E:** refaktor jest wykonalny bez zmian w testach, pod
warunkiem zachowania zestawu "wrażliwych kotwic" (sekcja
[E2E Impact](#e2e-impact--mapa-lokatorów-i-bezpieczeństwo)). Najwrażliwszy plik
to `session-flow.spec.ts`. Kluczowe niezmienniki: teksty nagłówków/przycisków,
`aria-label="Nawigacja główna"`, wzorce aria-label kart (`Przeciągnij: {nazwa}`,
`Zmień kolejność: {nazwa}`), semantyka `<li>`/`listitem`, oraz cel redirectu
nieautoryzowanego = `/` (nie `/login`).

## Detailed Findings

### Fundament — tokeny i ich (nie)wykorzystanie

- Tokeny motion: `globals.css:79-91` — duration
  `instant 100ms / fast 150ms / base 200ms / moderate 300ms / slow 400ms`;
  easing M3 `--ease-standard / -out / -in / -in-out / -linear`.
- Aliasy złożone: `--transition-fast = instant(100ms) + ease-standard`
  (`globals.css:254`), `--transition-base = base(200ms) + ease-standard`
  (`globals.css:255`).
- **Stan wykorzystania:** `--transition-fast` dominuje (TestCard, ScenarioCard,
  SessionView, Nav, auth). `--transition-base` użyte tylko w
  `ThemeToggle .track`. `--duration-moderate` (300ms) i `--ease-out/-in/-in-out`
  **nieużywane nigdzie** w `*.module.css`. Jedyny `@keyframes` w całym kodzie:
  `Spinner.module.css:1-4` (`spin`).
- **Wniosek dla punktu 12:** "skokowość" wynika z 100ms (instant) na hoverach i
  animowania właściwości layoutowych/`box-shadow`. Web-research (sekcja
  Architecture Insights) zaleca 150–300ms, `ease-out`, animację wyłącznie
  `transform`/`opacity`.

### Punkt 2 + 4 (dark mode, badge a11y) — przyczyna źródłowa w tokenach

Łańcuch tokenów (potwierdzony, [globals.css:37-39](), [:172-173](),
[:256-257]()):

- `--color-badge-correct-bg → --color-success-bg → --emerald-50 = #ecfdf5`
- `--color-badge-correct-text → --color-success-fg → --emerald-700 = #007a55`

| Stan                      | tło                     | tekst                   | Uwaga                             |
| ------------------------- | ----------------------- | ----------------------- | --------------------------------- |
| LIGHT correct/positive    | #ecfdf5                 | #007a55                 | OK                                |
| **DARK** correct/positive | #ecfdf5 (**bez zmian**) | #007a55 (**bez zmian**) | Jasny placek na slate-900 #0f172b |
| DARK suboptimal           | #fef3c6 (amber-100)     | #bb4d00 (amber-700)     | jw.                               |
| DARK unnecessary/negative | #ffe2e2 (red-100)       | #c10007 (red-700)       | jw.                               |

Komponenty zużywające te tokeny (wszystkie dziedziczą problem):

- `TestCard.module.css:63-76` —
  `.badge[data-result='correct'|'suboptimal'|'unnecessary']`.
- `HistoryCard.module.css:36-44` — `.positive` (success), `.negative` (danger).
- `details/page.module.css:36-44` — `.badgePositive`/`.badgeNegative`; `:98-116`
  — `.resultCorrect/.resultSuboptimal/.resultUnnecessary/.resultCriticalMiss`.
- `SessionView.module.css:115-121` — `.outcome[data-positive]`.

Podpisy w skali szarości na ciemnym tle (punkt 4):

- `--color-text-muted` w dark = `--slate-500` #62748e na slate-900 → niski
  kontrast. Użyte w: `details/page.module.css:24` (`.meta`), `:57`
  (`.orderHint`), `:108-111` (`.resultUnnecessary`).
- `--color-text-secondary` w dark = `--slate-400` #90a1b9
  (`details .eventOrder:87`).
- `HistoryCard.module.css:25` `.meta` dodatkowo `opacity:0.8`;
  `SessionView .column h2` `opacity:0.7`.

**Niespójność do naprawienia przy okazji:** `critical_miss` ma label+kolor TYLKO
w szczegółach sesji (`details/page.tsx:11`, `.resultCriticalMiss`); `TestCard`
`BADGE_LABELS` (`TestCard.tsx:14-18`) go pomija — w widoku sesji się nie
renderuje.

### Punkty 3, 9 (toggle), 10, 11 — Navbar, ThemeToggle, Layout, Homepage

**Navbar** — `Nav.tsx` (server component, `await auth()`), `Nav.module.css`:

- Logo `<Link href='/'>` "OSCE Triager" (`Nav.tsx:12-14`) — jedyny link do `/`,
  **bez hover**.
- Zalogowany (`:18-31`): email span, `Historia`→`/dashboard/history`,
  `Ustawienia`→`/account/settings`, `Wyloguj` (form
  `formAction={logoutAction}`). **Brak linku do `/dashboard`** (pulpit) —
  punkt 3.
- Niezalogowany (`:33-36`): linki `Zaloguj się`→`/login`,
  `Zarejestruj się`→`/register`. Punkt 11 chce je usunąć (są na homepage).
- ThemeToggle renderowany **na końcu** `.links`, zawsze (`Nav.tsx:38`). Punkt 9:
  przenieść między "Ustawienia" a "Wyloguj".
- `.logoutButton` (`Nav.module.css:49-62`):
  `border: 1px solid var(--color-border-default)` — w dark
  `--color-border-default = rgba(255,255,255,0.1)` (`globals.css:225`) → ledwo
  widoczna obwódka (punkt 9). Ma hover (`background var(--color-bg-subtle)`).
- `.links a` hover = tylko `text-decoration: underline` (`:27-30`) — mało
  nowoczesne (punkty 3/10).

**ThemeToggle** — `ThemeToggle.tsx` (`'use client'`, next-themes): pill switch,
`role='switch'`, dynamiczny `aria-label`, `aria-checked`, ikony `Moon`/`Sun`
(lucide). `mounted` gate przeciw FOUC. **Brak `data-testid`** → lokator
`getByRole('switch')`.

**Layout** — `layout.tsx`: fonty `Inter` + `IBM_Plex_Mono` (next/font),
`ThemeProvider attribute='data-theme' defaultTheme='system' enableSystem`,
`<Nav/>` przed `{children}`.

**Homepage** — `page.tsx` (server, `await auth()`), `page.module.css`:

- **Brak hero/SVG/tła** — tylko `<h1>` + `<p>` + CTA, wyśrodkowane (punkt 11).
- Niezalogowany (`:28-37`): `.primaryBtn` "Zaloguj się"→`/login`,
  `.secondaryBtn` "Zarejestruj się"→`/register`.
- Zalogowany (`:17-27`): `.primaryBtn` "Przejdź do Pulpitu"→`/dashboard` (jedyny
  link do `/dashboard` w całej apce).
- `.primaryBtn` (`:35-46`): `background var(--foreground)` (inwersja),
  `radius-sm`, **brak `:hover`, brak transition**. `.secondaryBtn` (`:48-59`):
  jw. + border. Punkty 9/11/5/12.

### Punkty 4, 6, 7, 9 (grids) — Layouty stron

**Dashboard** — `dashboard/page.tsx` + `page.module.css`:

- Lista scenariuszy = `flex-column` jednokolumnowy (`.list:5-11`), `<ul>` z
  `ScenarioCard` (`<li>`). **Brak grid, brak media queries.** Punkt 9: przerobić
  na siatkę.
- `<h1>Panel studenta</h1>` (`:15`) — **kotwica E2E**.
- `ScenarioCard`: ma hover (`.card:hover translateY(-1px)`,
  `ScenarioCard.module.css:16-19`) + `.button` "Rozpocznij sesję" (kotwica E2E;
  zamienia się na `<Spinner>` przy `loading`).

**History** — `dashboard/history/page.tsx` + `HistoryCard`:

- `<h1>Historia sesji</h1>` (`:15`), lista = `flex-column` jednokolumnowy
  (`page.module.css:14-20`), **bez max-width / grid / media queries** → rozciąga
  się full-width, prawa strona pusta wizualnie przy wąskich kartach (punkt 6).
- **Filtry: BRAK** (ani UI, ani query). **Sortowanie: JUŻ OK** —
  `getUserSessions` → `orderBy desc(sessionResults.completedAt)`
  (`queries.ts:85`), najnowsze pierwsze. Filtruje tylko
  `ne(outcome,'in_progress')`.
- `HistoryCard`: `<li>` z `<h3>` (title — kotwica), badge `Pozytywny/Negatywny`,
  `Link` "Szczegóły"→`/dashboard/session/{id}/details`. **Brak hover na karcie**
  (w przeciwieństwie do ScenarioCard); `.detailsLink:hover` = underline **bez
  transition** (skokowo).
- Dane: `getUserSessions(userId)` przyjmuje tylko `userId` — filtr trzeba dodać
  client-side lub rozszerzyć query.

**Session details** — `details/page.tsx` + `page.module.css`:

- "Kolejne badania" = `<ol class=eventList>` flex-column, każdy `<li>` z
  `.eventOrder` (numer w kółku `radius-full`) + nazwa + label wyniku (`:74-87`).
  **Brak connectora/linii/timeline** — punkt 4 chce roadmap stepper z
  linią-kropką.
- `<h1>` scenarioTitle, `<h2>Wybrane badania`, link "Wróć do
  historii"→`/dashboard/history` (**kotwice E2E**; "Wróć do historii" = `<a>`
  **bez hover/transition**).
- `max-width: 800px`. Tła własnego brak (globalne). Problem ciemnego tła =
  tokeny muted/secondary (sekcja punkt 2/4).

**Settings** — `account/settings/page.tsx`:

- `<h1>Ustawienia konta</h1>`, `max-width:600px`, `padding space-8`. Minimalny,
  **bez grid/media queries** (punkt 7).
- `DeleteAccountSection` (client): `<h2>Usuń konto`, `getByLabel` input ("Wpisz
  DELETE..."), button "Usuń konto" (disabled aż input = "DELETE").
  `.submitButtonActive` **brak hover/transition** (punkt 5).
- `CancelDeletionSection`: `.warningBanner` + button "Anuluj usunięcie" (**brak
  hover/transition**).

**SessionView** — `SessionView.tsx` + `.module.css`:

- W toku: `.columns` = **GRID `1fr 1fr` bez media queries** (`:56-61`) → na
  wąskim ekranie wciąż 2 kolumny. Nagłówki h2 "Dostępne badania (N)" / "Zlecone
  badania (N)" — **kotwice E2E** (uwaga: licznik dynamiczny w nawiasie).
  `.endButton:hover` → `--color-error-hover` = ten sam `--color-danger-fg`
  (**martwy hover**, `globals.css:250-251`). `.testList` ma działające feedbacki
  drag.
- Zakończona: `<h1>Sesja zakończona`, `.outcome` "Wynik: Pozytywny ✓/Negatywny
  ✗" (**kotwice E2E**), `.backLink` "Wróć do panelu"→`/dashboard` (**transition:
  opacity zadeklarowana, brak `:hover` → martwa**).

### Punkty 5, 9 — System przycisków (inwentarz)

Wszystkie przyciski: `border-radius: var(--radius-sm)` = **4px** (punkt 9:
"prawie niezaokrąglone"). Brak wspólnej klasy `.btn` — każdy komponent definiuje
własny.

Przyciski z `cursor: pointer` **bez żadnego hover** (martwe wizualnie):

- homepage `.primaryBtn`, `.secondaryBtn` (`page.module.css:35-59`)
- settings `.submitButtonActive` (`DeleteAccountSection.module.css:48-52`),
  `.cancelButton` (`CancelDeletionSection.module.css:23-30`)
- details `.back` (`<a>` "Wróć do historii")

Hover/transition martwe (no-op):

- `SessionView .endButton:hover` → kolor bez zmiany (`globals.css:250-251`).
- `SessionView .backLink` → `transition: opacity` bez reguły `:hover`.
- `HistoryCard .detailsLink:hover` → underline bez transition (skokowo).

Przyciski **z poprawnym** hover/transition (wzorzec do ujednolicenia):
`TestCard .button`, `ScenarioCard .button`/`.card`, auth `.submit button`,
`Nav .logoutButton`.

## Code References

- `src/app/globals.css:79-91` — tokeny motion (duration/easing); część
  nieużywana.
- `src/app/globals.css:172-189` — `--color-success/-warning/-danger/-info-*`
  (tylko light).
- `src/app/globals.css:207-237` — blok `[data-theme='dark']`: **brak nadpisań
  statusów i muted** (root cause punktów 2/4).
- `src/app/globals.css:254-255` — `--transition-fast` (100ms) /
  `--transition-base` (200ms).
- `src/shared/components/Nav/Nav.tsx:11-38` — struktura navbara; brak linku
  `/dashboard`; pozycja ThemeToggle.
- `src/shared/components/Nav/Nav.module.css:49-62` — `.logoutButton` (słaba
  obwódka w dark).
- `src/shared/components/ThemeToggle/ThemeToggle.tsx` — `role='switch'`, lokator
  E2E.
- `src/app/page.tsx:17-37` + `page.module.css:35-59` — homepage CTA bez
  hero/hover.
- `src/app/dashboard/page.module.css:5-11` — lista scenariuszy jednokolumnowa.
- `src/app/dashboard/history/page.module.css:14-20` — lista historii
  jednokolumnowa; brak filtrów.
- `src/modules/session/queries.ts:85` — sortowanie historii `desc(completedAt)`
  (już poprawne); brak filtra outcome.
- `src/modules/session/components/HistoryCard.module.css:36-58` — badge +
  `.detailsLink` (brak hover karty).
- `src/app/dashboard/session/[sessionId]/details/page.tsx:74-87` — `<ol>`
  "kolejne badania" bez connectora.
- `src/app/dashboard/session/[sessionId]/details/page.module.css:24,57,98-116` —
  muted/secondary + wyniki.
- `src/modules/session/components/SessionView.module.css:56-61,115-147` — grid
  `1fr 1fr`, martwe hovery.
- `src/modules/session/components/TestCard.module.css:63-76` — badge
  data-result.
- `src/app/account/settings/DeleteAccountSection.module.css:48-58` — submit bez
  hover.

## Architecture Insights

Wzorce zastane (do uszanowania w planie):

- **CSS Modules + companion per page** — lekcja w `lessons.md` ("Pages use CSS
  Modules — never inline styles"). Każda zmiana stylu idzie do `*.module.css`,
  nigdy inline.
- **Tokeny semantyczne, nie prymitywy** — komponenty używają `--color-*`
  semantycznych; poprawki kolorów dark mode robić w warstwie semantycznej/dark
  override w `globals.css`, nie hardkodować hex w komponentach.
- **lucide-react z `aria-hidden` i rozmiarem z tokenów** — lekcja w
  `lessons.md`; żadnych glifów Unicode. Ikony statusu
  (CheckCircle/AlertTriangle/XCircle) i stepper node powinny iść tym wzorcem.
- **RSC-first** — strony i Nav są server components; interaktywność
  (ThemeToggle, filtry, dnd) izolowana na liściach `'use client'`. Filtry
  historii → mały Client Component, reszta strony RSC.
- **Query modules dla danych** (`server-only`, `lessons.md`) — jeśli filtr
  historii ma iść po stronie serwera, rozszerzyć `getUserSessions`, nie tworzyć
  REST route.

Best-practices web (research zewnętrzny — wskazówki techniczne dla planu):

- **CSS-first dla ~90% potrzeb** (hover, focus, fade/slide, underline, grid,
  stepper, gradient hero) — zero bundle, zero `'use client'`. Biblioteki tylko
  punktowo: View Transitions API (natywne w React 19.2/Next 16, ~3KB) dla
  przejść nawigacyjnych; Framer Motion/`motion` tylko dla exit-animations/gestów
  na liściach.
- **Gładkie hovery (punkt 12):** animować **wyłącznie `transform`/`opacity`**
  (GPU, brak reflow), **150–300ms**, `ease-out`, konkretne właściwości (nie
  `transition: all`), zawsze `@media (prefers-reduced-motion: reduce)`. Karta:
  `translateY(-4px)` + warstwa cienia przez `opacity` zamiast animowania
  `box-shadow`. → podbić `--transition-fast` z 100ms lub używać
  `--transition-base`/`--duration-moderate` + `--ease-out`.
- **Badge dark mode (punkt 2):** wzorzec "tinted" —
  `background: color-mix(in srgb, var(--success) 15%, transparent)` + jasny
  tekst (odcień 200–300) + `border` 35% dla kształtu. Progi WCAG AA: tekst
  **4.5:1**, duży/bold **3:1**, UI/ikona/obwódka/linia steppera **3:1**; mierzyć
  **po zblendowaniu alfy** na realnym surface. Osobne tokeny per motyw. Nie
  polegać tylko na kolorze → dodać ikonę statusu.
- **Stepper z linią-kropką (punkt 4):** `<ol role="list">` +
  `aria-current="step"`; węzeł `::before` (kropka), linia `::after`
  `border-style: dotted/dashed` (`border-top` poziomo, lub absolutny `::before`
  2px pionowo). Stany przez `data-status` + kolor tokenowy; linia musi mieć 3:1.
- **Grid 1/2/3 (punkty 6, 9):** explicit media queries (`1fr` → `repeat(2,1fr)`
  @640px → `repeat(3,1fr)` @1024px), `gap`, `align-items: start`. (Alternatywa
  `auto-fill minmax(min(18rem,100%),1fr)` nie daje twardego limitu 3 kolumn.)
- **Hero (punkt 11):** inline SVG/gradient mesh statyczny lub wolny, animacja
  CSS `@keyframes` na `transform`/`opacity`, `aria-hidden`,
  `position:absolute; pointer-events:none; z-index:-1`, budżet < 80KB; zostaje w
  RSC.
- **Navbar (punkty 3,10):** `aria-current="page"` z `usePathname()` (mały Client
  Component) na aktywnym linku; animowany underline `::after scaleX(0→1)`; dodać
  widoczny link do `/dashboard` (Pulpit) i utrzymać link `/` (logo).

## E2E Impact — mapa lokatorów i bezpieczeństwo

**Config:** `playwright.config.ts` — `testDir: ./src/__tests__/e2e`,
`baseURL: http://localhost:3000`, `webServer: npm run start` (**produkcyjny
build — UI musi się zbudować przed testem**), projekt `setup` (auth.setup.ts) →
`chromium` z `storageState: playwright/.auth/user.json`. `.env.local` ładowany w
configu (`:9`, zgodnie z lekcją w `lessons.md`).

**Logowanie (auth.setup.ts):** `goto('/login')` → `getByLabel('Adres email')` →
`getByLabel('Hasło')` → `getByRole('button',{name:'Zaloguj się'})` →
`waitForURL('/dashboard')`.

### WRAŻLIWE KOTWICE — refaktor NIE MOŻE ich zmienić bez aktualizacji testów

**URL-e:** `/login`, `/dashboard`, `/` (cel redirectu nieautoryzowanego —
**nie** `/login`), `/dashboard/session/[uuid]` (regex
`/\/dashboard\/session\//`), `/dashboard/history`.

**Nagłówki (role `heading`):** "Panel studenta" (dashboard), "Dostępne badania"
(regex, sesja), "Sesja zakończona".

**Przyciski (role `button`):** "Zaloguj się" (login), "Rozpocznij sesję"
(ScenarioCard), "Zleć" (TestCard), "Zakończ sesję" (SessionView).

**Nawigacja / linki:** `<nav aria-label="Nawigacja główna">` (rola `navigation`,
name dokładnie "Nawigacja główna") — **podwójnie krytyczny**: a11y + rozstrzyga
strict-mode (na stronie gościa "Zaloguj się" istnieje jako link w nav **i** jako
element na homepage; scope nav rozwiązuje kolizję). Link "Zaloguj się"
**wewnątrz** nav.

**Labelki formularza (`getByLabel`):** "Adres email", "Hasło".

**aria-label kart badań (wzorce dynamiczne — dokładny format!):**
`Przeciągnij: {nazwa}` (DraggableTestCard), `Zmień kolejność: {nazwa}`
(SortableTestCard). Np. "Przeciągnij: EKG 12-odprowadzeniowe".

**Teksty domenowe (`getByText`/`filter`):** "Poprawne" (badge walidatora),
"Pozytywny" (regex; wynik + wpis historii), tytuł scenariusza seed "Ostry ból w
klatce piersiowej", nazwy badań "EKG 12-odprowadzeniowe", "Troponiny sercowe".

**Semantyka:** karty scenariuszy i wpisy historii **muszą** renderować się jako
`listitem` (`<li>` w `<ul>`/`<ol>` lub `role="list"`) —
`session-flow.spec.ts:16,78` używa `getByRole('listitem').filter(...)`. **Zmiana
siatki (punkty 6/9) musi zachować `<ul>`/`<li>`** — siatkę robić CSS-em na
istniejącym `<ul>`/`<li>`, nie zamieniać na `<div>`.

### Implikacje per punkt zmiany

| Punkt                                    | Ryzyko E2E                   | Warunek bezpieczeństwa                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 5, 12 (animacje/hover)                | **Niskie**                   | Czysto wizualne; nie zmieniać tekstu/roli/struktury. Uwaga: dodawanie animacji wejścia (mount) nie może opóźniać widoczności kotwic ponad domyślny timeout.                                                                                                                                                                                                                                                         |
| 2, 4 (dark tokeny/badge)                 | **Bardzo niskie**            | Zmiana w `globals.css`/CSS; teksty badge ("Poprawne", "Pozytywny") bez zmian.                                                                                                                                                                                                                                                                                                                                       |
| 3, 10 (navbar)                           | **Średnie**                  | Zachować `aria-label="Nawigacja główna"` i link "Zaloguj się" w nav. Dodanie linku "Pulpit"→`/dashboard` jest bezpieczne (nowy element).                                                                                                                                                                                                                                                                            |
| 6, 9 (siatka history/dashboard)          | **Średnie**                  | Zachować `<ul>`/`<li>` (`listitem`), tytuły (`h2`/`h3`), "Szczegóły", "Rozpocznij sesję". Siatka = CSS na istniejącej semantyce.                                                                                                                                                                                                                                                                                    |
| 6 (filtry/sort)                          | **Niskie–średnie**           | Sort już OK (nie ruszać). Filtr: domyślnie pokazywać wszystko (test historii oczekuje wpisu "Pozytywny" widocznego od razu — filtr nie może go domyślnie ukrywać).                                                                                                                                                                                                                                                  |
| 7 (settings)                             | **Niskie**                   | Brak testów na settings; zachować `getByLabel` i teksty przycisków, jeśli dojdą testy.                                                                                                                                                                                                                                                                                                                              |
| 11 (homepage/hero, usunięcie auth z nav) | **WYSOKIE — ROZSTRZYGNIĘTE** | **Decyzja (2026-06-15):** usunąć linki auth z navbara, zostawić CTA na homepage, **zaktualizować** `auth-boundary.spec.ts` i `seed.spec.ts`. Zmiana **sprzężona** — usunięcie z nav i edycja testów muszą wejść razem (inaczej strict-mode). Po usunięciu z nav na `/` jest **jeden** "Zaloguj się" → lokator page-level bez scope nav. Szczegóły: [Follow-up Research 2026-06-15](#follow-up-research-2026-06-15). |

## Historical Context (from prior changes)

- `context/changes/ui-design-system/research.md` + `plan.md` — pełny design
  system (4 fazy): token foundation w `globals.css`, `next/font` (Inter + IBM
  Plex Mono), `next-themes` + `ThemeToggle`, `lucide-react`, migracja 11 modułów
  CSS. `ui-refresh` buduje **na** tym fundamencie.
- `context/changes/ui-design-system/change.md` — dark mode i token system
  zostały dostarczone, ale weryfikacja **ręczna/wizualna** (kroki 4.4–4.9)
  "pozostaje do potwierdzenia w przeglądarce". Problemy z punktów 2/4 to
  dokładnie to, czego nie wychwyciła weryfikacja automatyczna.
- `context/foundation/lessons.md`:
  - "Pages use CSS Modules — never inline styles" — obowiązuje każdy nowy styl.
  - "Nigdy nie używaj glifów Unicode/emoji jako ikon — używaj lucide-react" —
    dotyczy ikon statusu i stepper.
  - "Załaduj .env.local w playwright.config.ts" — już zastosowane; istotne przy
    lokalnym uruchamianiu E2E po refaktorze.
- `context/changes/ux-improvements/` oraz
  `context/changes/session-history-save/` — wcześniejsze zmiany dotykające
  historii/details (kontekst dla layoutu historii).

## Related Research

- `context/changes/ui-design-system/research.md` — bezpośredni poprzednik
  (tokeny, theming, typografia).

## Open Questions

1. ~~**Punkt 11 vs E2E:** usunięcie przycisków auth z navbara dla gościa złamie
   `auth-boundary.spec.ts` i `seed.spec.ts`.~~ **ROZSTRZYGNIĘTE 2026-06-15 →
   opcja (a):** usuwamy linki auth z navbara, zostawiamy CTA na homepage,
   aktualizujemy oba specs na lokator homepage CTA. Szczegóły i diffy:
   [Follow-up Research 2026-06-15](#follow-up-research-2026-06-15).
2. **Filtr historii — serwer czy klient?** Sort już serwerowy. Filtr outcome:
   client-side (prostsze, RSC zostaje) czy rozszerzyć `getUserSessions` o
   parametr (zgodnie z lekcją o query modules)? Liczba sesji prawdopodobnie mała
   → client-side wystarczy, ale to do potwierdzenia.
3. **Skala zmian motion:** czy przedefiniować `--transition-fast` (100ms→~200ms)
   globalnie (ryzyko: dotyka wszystkich istniejących hoverów naraz), czy
   wprowadzić nowy alias i migrować komponenty świadomie?
4. **Stepper details — zakres:** czy connector linia-kropka ma być wyłącznie
   wizualny (CSS na istniejącym `<ol>`), czy zmienić też semantykę na
   `aria-current`/statusy? Wpływ na ewentualne przyszłe testy details (obecnie
   brak).
5. **`critical_miss` w TestCard:** czy przy okazji ujednolicić badge (dodać
   label "Krytyczny brak" do `BADGE_LABELS`), czy zostawić poza zakresem
   ui-refresh?
6. **Nowa zależność (View Transitions):** czy wprowadzać przejścia nawigacyjne w
   tej iteracji, czy ograniczyć się do CSS-first i odłożyć VT na później?

## Follow-up Research 2026-06-15

**Decyzja użytkownika (punkt 11, rozstrzygnięcie Open Question #1):** usunąć
przyciski logowania/rejestracji z navbara dla niezalogowanego użytkownika,
pozostawić CTA na stronie głównej, i zaktualizować testy E2E
(`auth-boundary.spec.ts`, `seed.spec.ts`) tak, by celowały w przyciski auth na
planszy głównej zamiast w link wewnątrz navbara.

### Dlaczego to zmiana SPRZĘŻONA (kolejność dla implementacji)

Obecnie na `/` dla gościa istnieją **dwa** linki "Zaloguj się": jeden w `<nav>`
(`Nav.tsx:34`), jeden jako CTA homepage (`page.tsx:30-32`). Dlatego testy
zawężają lokator do landmarku `navigation` (komentarz `seed.spec.ts:51-53`
wprost to tłumaczy). Konsekwencje:

- **Nie wolno** edytować samych testów na lokator page-level, dopóki navbar
  wciąż renderuje "Zaloguj się" — wtedy
  `getByRole('link', {name:'Zaloguj się'})` zwróci 2 elementy → strict-mode
  violation → czerwony test.
- **Nie wolno** usunąć linków z navbara bez aktualizacji testów — obecny
  `.getByRole('navigation', …).getByRole('link', {name:'Zaloguj się'})` zwróci 0
  elementów → `toBeVisible()` fail.
- **Obie zmiany muszą wejść w tym samym commicie/fazie.** Po usunięciu z nav na
  `/` zostaje dokładnie jeden "Zaloguj się" → lokator page-level jest
  jednoznaczny (homepage nie ma landmarku `<main>` — `page.tsx:9` to `<div>` —
  więc scope do `main` nie jest dostępny; lokator page-level wystarcza).

### Zmiana w komponencie (do wykonania w fazie implementacji)

`src/shared/components/Nav/Nav.tsx:33-36` — gałąź niezalogowana. Usunąć linki
"Zaloguj się" / "Zarejestruj się". Po zmianie dla gościa navbar pokazuje
praktycznie tylko logo (+ ThemeToggle, który jest renderowany zawsze poza
ternary, `Nav.tsx:38`). Zachować `<nav aria-label="Nawigacja główna">` (kotwica
E2E + a11y).

### Diff testów — `auth-boundary.spec.ts`

Dwa wystąpienia (linie 16-20 oraz 33-37), oba identyczne. Zmiana w każdym:

```diff
-    await expect(
-      page
-        .getByRole('navigation', { name: 'Nawigacja główna' })
-        .getByRole('link', { name: 'Zaloguj się' }),
-    ).toBeVisible();
+    await expect(
+      page.getByRole('link', { name: 'Zaloguj się' }),
+    ).toBeVisible();
```

Asercja negatywna ("Panel studenta" `.not.toBeVisible()`) bez zmian — to rdzeń
Risk #6.

### Diff testów — `seed.spec.ts` (linie 54-58)

```diff
-    // There are two "Zaloguj się" links on this page (nav + CTA).
-    // Scope to the navigation landmark to avoid a strict-mode violation.
-    // The aria-label="Nawigacja główna" on <nav> makes this unambiguous.
-    await expect(
-      page
-        .getByRole('navigation', { name: 'Nawigacja główna' })
-        .getByRole('link', { name: 'Zaloguj się' }),
-    ).toBeVisible();
+    // Po usunięciu linków auth z navbara (ui-refresh, punkt 11) na stronie
+    // głównej jest dokładnie jeden link "Zaloguj się" — CTA homepage.
+    // Lokator page-level jest jednoznaczny; scope do landmarku nie jest już potrzebny.
+    await expect(
+      page.getByRole('link', { name: 'Zaloguj się' }),
+    ).toBeVisible();
```

`seed.spec.ts` jest "wzorcem referencyjnym" (Pattern 1-4) — komentarz
aktualizujemy, by nie uczył nieaktualnego wzorca scope-do-nav.

### Pozostałe kotwice po zmianie (niezmienne)

- `<nav aria-label="Nawigacja główna">` zostaje (inne testy + a11y; po prostu
  nie zawiera już linku auth dla gościa).
- Redirect nieautoryzowany → `/` (nie `/login`) — bez zmian
  (`auth-boundary.spec.ts:14,31`, `seed.spec.ts:44`).
- Homepage CTA "Zaloguj się" → `/login` i "Zarejestruj się" → `/register` —
  zachować teksty (stają się jedynymi kotwicami auth na `/`).
- `auth.setup.ts` i `login-form.spec.ts` celują w `/login` (formularz) — **nie
  dotknięte** tą zmianą.

### Weryfikacja po implementacji

Uruchomić oba dotknięte projekty E2E (wymaga `npm run build` — `webServer` używa
`npm run start`): `npx playwright test auth-boundary seed`. Oczekiwane: zielone,
brak strict-mode violations.
