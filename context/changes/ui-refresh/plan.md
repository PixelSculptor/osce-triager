# UI Refresh — Plan implementacji

## Przegląd

Modernizacja warstwy UI nadbudowana na design systemie S-06 (`ui-design-system`,
done). Design system dostarczył komplet tokenów; ta zmiana **wykorzystuje je w
pełni** w warstwie komponentów: naprawa dark mode na poziomie tokenów statusu,
spójny system przycisków, gładsze animacje hover (CSS-first), responsywne
siatki, filtr historii, stepper „kolejnych badań", odświeżony navbar / settings
/ homepage. Wszystko **bez zaburzania flow ani testów E2E** — z jawnym,
sprzężonym sekwencjonowaniem jedynej zmiany łamiącej testy (usunięcie linków
auth z navbara).

Obejmuje 12 punktów z briefu użytkownika (numeracja oryginalna, brak punktu 8),
podzielonych na 6 faz w kolejności zależności: tokeny → przyciski → karty/siatki
→ filtr/stepper → navbar/settings → homepage.

## Analiza stanu obecnego

Pełna mapa w `context/changes/ui-refresh/research.md`. Najważniejsze fakty:

- **Dark mode niedokończony na poziomie tokenów.** `[data-theme='dark']`
  (`globals.css:207-237`) **nie nadpisuje**
  `--color-success/-warning/-danger/-info-*` ani `--color-text-muted`. Skutek:
  badge sukcesu renderuje się jasnym `--emerald-50` (#ecfdf5) tłem +
  `--emerald-700` (#007a55) tekstem na slate-900 → „szaro-zielony placek";
  podpisy muted (`--slate-500` #62748e) znikają. To pojedyncza przyczyna
  źródłowa punktów 2 i 4.
- **Tokeny motion istnieją, ale są niedoużyte.** `--duration-moderate` (300ms),
  `--ease-out/-in/-in-out` nieużywane; `--transition-fast` =
  `--duration-instant` = **100ms** (za szybkie → skokowość). Wiele przycisków ma
  `cursor: pointer` bez `:hover` (homepage CTA, settings, details „Wróć");
  `SessionView .backLink` i `.endButton:hover` mają martwe przejścia.
- **Brak media queries w jakimkolwiek CSS stron.** Dashboard i historia to
  `flex-column` jednokolumnowy na `<ul>/<li>`. `SessionView .columns` to sztywny
  grid `1fr 1fr`.
- **Sortowanie historii już poprawne** (`getUserSessions` → `desc(completedAt)`,
  `queries.ts:85`); filtrów brak (ani UI, ani query).
- **`critical_miss` niespójny** — label „Krytyczny brak" tylko w details
  (`details/page.tsx:11`); `TestCard.BADGE_LABELS` (`TestCard.tsx:14-18`) go
  pomija.
- **Przyciski:** wszystkie `border-radius: var(--radius-sm)` (4px), brak
  wspólnej klasy — każdy komponent definiuje własny. `Nav .logoutButton` ma
  border `--color-border-default` = w dark `rgba(255,255,255,0.1)` → ledwo
  widoczny.
- **Homepage** (`page.tsx`) — brak hero/SVG; CTA `.primaryBtn`/`.secondaryBtn`
  bez hover. Navbar (`Nav.tsx`) — brak linku do `/dashboard`, ThemeToggle na
  końcu, linki auth dla gościa.

## Pożądany stan końcowy

Po zakończeniu planu:

- W dark mode wszystkie badge/outcome mają czytelne, dostępne kolory (WCAG AA:
  tekst ≥4.5:1, UI/obwódka ≥3:1) — sprawdzone wizualnie w obu motywach.
- Wszystkie przyciski w aplikacji używają jednego systemu wariantów (spójny
  radius, hover, focus-ring) — żaden nie ma „martwego" hovera.
- Hover/interakcje są gładkie (transform/opacity, ~200ms, `ease-out`), z
  poszanowaniem `prefers-reduced-motion`.
- `/dashboard` i `/dashboard/history` wyświetlają wyniki jako responsywną siatkę
  (1 kol. mobile / 2 tablet / 3 laptop+); historia ma filtr pozytywne/negatywne/
  wszystkie i pozostaje sortowana od najnowszych.
- Szczegóły sesji prezentują „kolejne badania" jako stepper z linią-kropką,
  czytelny na ciemnym tle, z semantyką listy i kolorem węzła wg wyniku.
- Navbar ma widoczny link do Pulpitu, ThemeToggle między Ustawieniami a Wyloguj,
  brak linków auth dla gościa; homepage ma hero z animowanym tłem SVG i mocnym
  CTA.
- **Wszystkie testy E2E (`npm run test:e2e`) przechodzą** — kotwice zachowane,
  testy `auth-boundary`/`seed` zaktualizowane razem ze zmianą navbara.

### Kluczowe odkrycia

- Root cause dark mode: brak nadpisań statusów w `globals.css:207-237`.
- Tokeny motion gotowe do użycia: `--duration-*`, `--ease-out`
  (`globals.css:79-91`).
- Kotwice E2E (research §E2E Impact): nagłówki „Panel studenta"/„Dostępne
  badania"/ „Sesja zakończona"; przyciski „Zaloguj się"/„Rozpocznij
  sesję"/„Zleć"/„Zakończ sesję"; `<nav aria-label="Nawigacja główna">`; wzorce
  `Przeciągnij: {nazwa}` / `Zmień kolejność: {nazwa}`; semantyka `listitem`;
  redirect → `/`.
- Lekcje (`lessons.md`): strony używają CSS Modules — nigdy inline styles; ikony
  z `lucide-react` z `aria-hidden` — nigdy glify Unicode.

## Czego NIE robimy

- **Bez View Transitions API / Framer Motion** — animacje wyłącznie CSS-first.
- **Bez pełnego hero z sekcjami feature/jak-to-działa** — osobny pomysł na
  później (`/10x-new`, change `homepage-landing`). Tu tylko hero gradient mesh.
- **Bez zmiany logiki walidatora ani schematu DB** — `critical_miss` to tylko
  dodanie labela/koloru w warstwie prezentacji.
- **Bez zmiany sortowania historii** (już poprawne) ani filtrowania po stronie
  serwera (filtr po stronie klienta).
- **Bez zmiany tekstów/ról kotwic E2E** poza jawną, sprzężoną aktualizacją
  `auth-boundary.spec.ts` i `seed.spec.ts` w Fazie 5.
- **Bez przeprojektowania flow sesji** (`SessionView` w toku) — tylko polish
  przycisków/responsywności, nie zmiana mechaniki DnD.

## Podejście do implementacji

Kolejność faz minimalizuje ryzyko: najpierw fundament tokenów (zero ryzyka E2E,
najwyższy zwrot a11y), potem wspólny system przycisków (na którym opierają się
wszystkie kolejne fazy), następnie karty/siatki/filtry, a na końcu „chrome"
(navbar/settings) i homepage. Jedyna zmiana łamiąca testy (usunięcie linków auth
z navbara) jest **sprzężona w jednej fazie** z aktualizacją dotkniętych specs.

Każda faza kończy się weryfikacją automatyczną (typecheck/lint/build) + ręczną
weryfikacją wizualną w obu motywach przed przejściem dalej.

## Krytyczne szczegóły implementacji

- **Sekwencjonowanie E2E (Faza 5):** usunięcie linków auth z `Nav.tsx` i
  aktualizacja `auth-boundary.spec.ts` + `seed.spec.ts` MUSZĄ wejść w tym samym
  commicie. Edycja testów wcześniej → dwa „Zaloguj się" na `/` → strict-mode
  violation. Usunięcie z nav bez edycji testów → lokator zawężony do `<nav>`
  zwraca 0 → fail. Gotowe diffy: research §„Follow-up Research 2026-06-15".
- **Specyfikacja UX (Faza 3, siatki):** siatkę CSS nakładamy na ISTNIEJĄCE
  `<ul>`/`<li>` — nie wolno zamieniać na `<div>`, bo
  `session-flow.spec.ts:16,78` używa `getByRole('listitem')`. Filtr historii
  (Faza 4) domyślnie pokazuje WSZYSTKIE wyniki — test historii oczekuje wpisu
  „Pozytywny" widocznego od razu.
- **Reduced motion:** każda nowa animacja (hero, hover, stepper, pulse węzła)
  pod `@media (prefers-reduced-motion: reduce)` — globalny blok istnieje już w
  `globals.css:304-312`, ale animacje na `transform` w tle hero wymagają jawnego
  wyłączenia (globalny blok zeruje tylko `animation`/`transition`, nie statyczny
  `transform`).

---

## Faza 1: Fundament tokenów — dark mode statusy + motion

### Przegląd

Naprawia przyczynę źródłową punktów 2 i 4 oraz dodaje brakujące tokeny motion
dla punktów 1/12. Czysto w `globals.css` — zero zmian w komponentach, zero
ryzyka E2E.

### Wymagane zmiany

#### 1. Nadpisania tokenów statusu w dark mode

**Plik**: `src/app/globals.css` (blok `[data-theme='dark']`, ~:207-237)

**Cel**: W dark mode badge i wyniki mają być czytelne i dostępne. Dodać
nadpisania tokenów statusu wzorcem „tinted" (ciemne, półprzezroczyste tło z
rodziny koloru + jasny tekst tej samej rodziny + obwódka dla kształtu), zamiast
jasnych wartości z `:root`.

**Kontrakt**: W bloku `[data-theme='dark']` dodać nadpisania dla:
`--color-success-fg/-bg/-border`, `--color-warning-fg/-bg/-border`,
`--color-danger-fg/-bg/-border`, `--color-info-fg/-bg/-border`. Wzorzec per
status: `-fg` = jasny odcień rodziny (np. emerald/amber/red/sky ~300-400), `-bg`
= `color-mix(in srgb, <fg> 15%, transparent)`, `-border` =
`color-mix(in srgb, <fg> 35%, transparent)`. Wartości startowe (zweryfikować
kontrast po nałożeniu na `--color-bg-surface` dark = slate-900 #0f172b):
success-fg `#4ade80`, warning-fg `#fbbf24`, danger-fg `#f87171`, info-fg
`#7dd3fc`. Wymaga dodania potrzebnych prymitywów (np. `--emerald-300/-400`,
`--red-300/-400`, `--amber-300/-400`, `--sky-300/-400`) do sekcji PRIMITIVES,
jeśli nie istnieją.

#### 2. Podbicie `--color-text-muted` w dark mode

**Plik**: `src/app/globals.css` (blok `[data-theme='dark']`, sekcja Text)

**Cel**: Podpisy w skali szarości na ciemnym tle są za ciemne (`--slate-500`
#62748e na slate-900). Podbić jasność muted, zachowując hierarchię względem
`--color-text-secondary`.

**Kontrakt**: W dark `--color-text-muted` ustawić na `--slate-400` (#90a1b9) lub
jaśniejszy; upewnić się, że `--color-text-secondary` pozostaje wyraźnie
jaśniejszy od muted (rozważyć secondary → slate-300). Zweryfikować ≥4.5:1 dla
tekstu muted na slate-900.

#### 3. Nowe tokeny motion dla gładkich interakcji

**Plik**: `src/app/globals.css` (sekcja MIGRATION ALIAS LAYER lub nowa sekcja
motion aliasów, ~:254-255)

**Cel**: Dać komponentom gotowe, semantyczne aliasy dla gładkich hoverów
(~200ms, `ease-out`), bez ruszania istniejącego `--transition-fast` (100ms)
używanego przez mikro-interakcje.

**Kontrakt**: Dodać aliasy:
`--transition-hover: var(--duration-base) var(--ease-out)` (200ms),
`--transition-card: var(--duration-moderate) var(--ease-out)` (300ms). Nie
zmieniać `--transition-fast` ani `--transition-base`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Build przechodzi: `npm run build`
- Lint przechodzi: `npm run lint`
- Format zgodny: `npm run format:check`

#### Weryfikacja ręczna

- W dark mode badge „Pozytywny" w historii jest wyraźnie zielony (nie szary),
  tekst czytelny; „Negatywny" wyraźnie czerwony.
- Podpisy meta/muted w szczegółach sesji czytelne na ciemnym tle.
- W light mode badge i podpisy bez regresji.
- Kontrast zweryfikowany w checkerze (tekst ≥4.5:1, obwódka ≥3:1) w obu
  motywach.

**Uwaga implementacyjna**: Po przejściu weryfikacji automatycznej zatrzymaj się
na ręczne potwierdzenie wizualne (oba motywy) przed Fazą 2.

---

## Faza 2: Wspólny system przycisków + polish hover

### Przegląd

Punkty 5, 9 (przyciski), 12 (hover). Jedno źródło prawdy dla przycisków z
wariantami, większym radius i spójnym hover/focus; migracja wszystkich miejsc
użycia; usunięcie martwych hoverów. Korzysta z tokenów motion z Fazy 1.

### Wymagane zmiany

#### 1. Wspólny moduł przycisków

**Plik**: `src/shared/components/Button/Button.module.css` (nowy) +
`src/shared/components/Button/Button.tsx` (nowy)

**Cel**: Dostarczyć komponent `Button` z wariantami i spójnym wyglądem
(radius-lg, widoczne tło/obwódka, gładki hover na `--transition-hover`,
focus-ring z tokenów), działający w obu motywach. Wspiera renderowanie jako
`<button>` i jako link (`asChild`/`as` lub osobny wariant dla `<Link>`).

**Kontrakt**: Warianty: `primary` (tło `--color-interactive-primary`, hover
`-hover`), `secondary` (tło surface, border `--color-border-strong`), `ghost`
(przezroczysty, hover `--color-bg-subtle`, border widoczny w dark —
`--color-border-strong`), `danger` (tło `--color-danger-fg`/odpowiednik, hover
ciemniejszy). Rozmiary: `sm`/`md`. Wszystkie: `border-radius: var(--radius-lg)`,
`transition: background-color var(--transition-hover), border-color var(--transition-hover), transform var(--transition-hover)`,
hover `transform: translateY(-1px)`, `:focus-visible` z `--focus-ring-*`,
`:disabled` stan, `@media (prefers-reduced-motion: reduce)` zeruje transform.
Props: `variant`, `size`, standardowe atrybuty button + opcjonalny tryb linku.
Komponent współpracuje z istniejącymi server actions (`formAction`) — nie może
wymuszać `'use client'` tam, gdzie używany w formularzach RSC (czysty `<button>`
z przekazaniem props).

#### 2. Migracja istniejących przycisków na `Button`

**Pliki**: `src/modules/session/components/TestCard.tsx` (+`.module.css`),
`ScenarioCard.tsx`, `SessionView.tsx` (`.endButton`, `.backLink`),
`src/shared/components/Nav/Nav.tsx` (`.logoutButton`), `src/app/page.tsx`
(`.primaryBtn`/`.secondaryBtn`),
`src/app/account/settings/DeleteAccountSection.tsx` (`.submitButton`),
`CancelDeletionSection.tsx` (`.cancelButton`),
`src/modules/auth/components/SubmitButton.tsx`

**Cel**: Zastąpić lokalne style przycisków komponentem `Button` z odpowiednim
wariantem, zachowując **dokładne teksty i role** (kotwice E2E). Usunąć martwe
hovery (`backLink` bez `:hover`, `endButton:hover` na ten sam kolor).

**Kontrakt**: Mapowanie wariantów: „Rozpocznij sesję"/„Zleć"/auth submit →
`primary`; „Zakończ sesję" → `danger`; „Wróć do panelu"/„Wróć do historii" →
`secondary` lub `ghost`; „Wyloguj" → `ghost` (z widoczną obwódką w dark);
homepage „Zaloguj się" → `primary`, „Zarejestruj się" → `secondary`; settings
„Usuń konto" → `danger`, „Anuluj usunięcie" → `ghost`. **Niezmienne:** tekst
przycisków, zachowanie `formAction`/`onClick`, stany `disabled`/loading
(`<Spinner>`), `aria-label`. Lokalne klasy `.button`/`.endButton` itp. usuwane
po migracji. „Wróć do historii"/„Wróć do panelu" pozostają linkami (`<Link>`) ze
stylem wariantu — zachować `href`.

#### 3. Naprawa hoverów linków nawigacyjnych

**Pliki**: `src/modules/session/components/HistoryCard.module.css`
(`.detailsLink`), `details/page.module.css` (`.back`)

**Cel**: Linki „Szczegóły"/„Wróć do historii" mają gładki hover (kolor/underline
z transition), nie skokowy.

**Kontrakt**: Dodać `transition` na właściwości hovera
(color/text-decoration-color) z `--transition-hover`; zachować teksty i `href`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Typecheck przechodzi: `npm run typecheck`
- Build przechodzi: `npm run build`
- Lint przechodzi: `npm run lint`
- Testy jednostkowe/integracyjne przechodzą: `npm run test`

#### Weryfikacja ręczna

- Wszystkie przyciski mają widoczny, gładki hover (zmiana tła + lekki lift) w
  obu motywach; „Wyloguj" ma widoczną obwódkę w dark.
- Brak regresji w stanach loading (spinner w „Rozpocznij sesję"/„Zakończ
  sesję").
- `prefers-reduced-motion` wyłącza lift.
- Teksty wszystkich przycisków niezmienione (kontrola kotwic).

**Uwaga implementacyjna**: zatrzymaj się na ręczne potwierdzenie przed Fazą 3.

---

## Faza 3: Karty, badge i responsywne siatki

### Przegląd

Punkty 6 (siatka), 9 (siatki dashboard), 2/7 (badge na nowych tokenach),
ujednolicenie `critical_miss`. Siatki CSS na istniejącej semantyce `<ul>/<li>`.

### Wymagane zmiany

#### 1. Responsywna siatka listy scenariuszy (dashboard)

**Plik**: `src/app/dashboard/page.module.css` (`.list`)

**Cel**: Lista testów do przerobienia ma być siatką 1/2/3 kolumny zamiast
jednokolumnowej (punkt 9).

**Kontrakt**: `.list` →
`display: grid; gap: var(--space-4); align-items: start; grid-template-columns: 1fr;` +
media queries: `@media (min-width: 640px)` → `repeat(2, 1fr)`,
`@media (min-width: 1024px)` → `repeat(3, 1fr)`. **Nie zmieniać** `<ul>`/`<li>`
w `page.tsx`/`ScenarioCard.tsx` (semantyka `listitem`).

#### 2. Responsywna siatka historii

**Plik**: `src/app/dashboard/history/page.module.css` (`.list`)

**Cel**: Historia jako siatka 1/2/3 kol. wykorzystująca pełną szerokość (punkt
6).

**Kontrakt**: jak wyżej (grid + breakpointy 640/1024). Zachować `<ul>`/`<li>`.

#### 3. HistoryCard — hover + spójność z ScenarioCard

**Plik**: `src/modules/session/components/HistoryCard.module.css` (`.card`)

**Cel**: Karta historii ma hover (lift + cień) jak ScenarioCard.

**Kontrakt**: dodać `.card:hover` → `box-shadow var(--shadow-card-hover)` +
`transform: translateY(-1px)`, `transition` z `--transition-card`;
reduced-motion zeruje transform.

#### 4. Redesign badge na nowych tokenach + ujednolicenie critical_miss

**Pliki**: `src/modules/session/components/TestCard.tsx` (`BADGE_LABELS`,
`.module.css`), `HistoryCard.module.css`, `details/page.module.css`

**Cel**: Badge korzystają z naprawionych tokenów dark (Faza 1) i wzorca „tinted"
(tło + tekst + obwódka). Dodać `critical_miss` do `TestCard` dla spójności
(punkt z researchu).

**Kontrakt**: Badge: stosować `-bg` + `-fg` + `border: 1px solid <-border>`,
`border-radius: var(--radius-full)` lub `--radius-sm` (spójnie). W `TestCard`
dodać do `BADGE_LABELS` wpis `critical_miss: 'Krytyczny brak'` + styl
`[data-result='critical_miss']` na tokenach danger. Zweryfikować, że typ wyniku
walidatora przekazywany do `TestCard` może przyjąć `critical_miss` (jeśli nie
jest przekazywany w widoku sesji — dodać tylko label+styl, bez zmiany logiki).
**Niezmienne teksty kotwic:** „Poprawne" (badge walidatora), „Pozytywny"/
„Negatywny".

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Lint: `npm run lint`
- Testy: `npm run test`

#### Weryfikacja ręczna

- `/dashboard` i `/dashboard/history` pokazują siatkę: 1 kol. na mobile, 2 na
  tablecie, 3 na laptopie+ (sprawdzić resize).
- Badge czytelne i spójne w obu motywach; `critical_miss` pokazuje „Krytyczny
  brak".
- Karty historii mają hover; semantyka listy zachowana (DevTools:
  `<ul>`/`<li>`).

**Uwaga implementacyjna**: zatrzymaj się na ręczne potwierdzenie przed Fazą 4.

---

## Faza 4: Filtr historii + stepper szczegółów sesji

### Przegląd

Punkt 6 (filtr), punkt 4 (stepper „kolejnych badań"). Filtr po stronie klienta
(URL searchParam); stepper czystym CSS z semantyką a11y.

### Wymagane zmiany

#### 1. Filtr historii (client component)

**Pliki**: `src/app/dashboard/history/page.tsx`,
`src/modules/session/components/HistoryFilter.tsx` (nowy, `'use client'`) +
`.module.css`

**Cel**: User filtruje listę: wszystkie / pozytywne / negatywne. Domyślnie
wszystkie. Lista zawsze sortowana od najnowszych (już zapewnione przez query).

**Kontrakt**: `HistoryFilter` renderuje grupę przycisków/segmentów (rola `group`
lub `radiogroup`, dostępne etykiety: „Wszystkie"/„Pozytywne"/„Negatywne"), czyta
i ustawia `?filter=` przez `useSearchParams`/`useRouter` (lub lokalny `useState`
z filtrowaniem przekazanej listy). Strona `page.tsx` pozostaje RSC: pobiera
pełną listę z `getUserSessions`, przekazuje do client-componentu, który filtruje
wg wybranego outcome. Domyślny stan = wszystkie (test E2E widzi „Pozytywny" od
razu). Filtrowanie po polu outcome obecnym w danych sesji. **Nie zmieniać**
query ani sortowania.

#### 2. Stepper „kolejnych badań" (linia-kropka)

**Plik**: `src/app/dashboard/session/[sessionId]/details/page.tsx` +
`page.module.css` (`.eventList`, `.eventItem`, `.eventOrder`)

**Cel**: „Kolejne badania" prezentowane jak roadmap — kolejne węzły łączone
linią z kropką (punkt 4), czytelne na ciemnym tle, z kolorem węzła wg wyniku.

**Kontrakt**: Na istniejącym `<ol class=eventList>` dodać `role="list"`.
Connector pionowy CSS przez pseudo-element (`.eventItem::before` lub
`.eventOrder::after`): linia
`border-left: var(--border-width-2) dotted var(--color-border-strong)` łącząca
węzły, ukryta dla ostatniego elementu (`:last-child`). Węzeł (`.eventOrder`)
koloruje się wg wyniku badania: success/warning/danger token z Fazy 1 (mapowanie
jak `.resultCorrect/.resultSuboptimal/.resultUnnecessary/ .resultCriticalMiss`).
Linia musi mieć kontrast ≥3:1. Zachować numerację i nazwy badań. Zachować
nagłówek h2 „Wybrane badania" i link „Wróć do historii" (kotwice).
Reduced-motion: brak animacji (jeśli dodany pulse węzła aktywnego — wyłączyć).

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Lint: `npm run lint`
- Testy: `npm run test`

#### Weryfikacja ręczna

- Filtr przełącza listę (wszystkie/pozytywne/negatywne); domyślnie wszystkie;
  sortowanie od najnowszych zachowane; działa po odświeżeniu (jeśli URL param).
- Szczegóły sesji pokazują stepper z linią-kropką łączącą badania; węzły
  kolorowane wg wyniku; czytelne w obu motywach.
- Czytnik ekranu ogłasza listę (role=list) i kolejne elementy.

**Uwaga implementacyjna**: zatrzymaj się na ręczne potwierdzenie przed Fazą 5.

---

## Faza 5: Navbar + settings + sprzężona aktualizacja E2E

### Przegląd

Punkty 3, 9 (toggle), 10 (navbar), 7 (settings), 11 (usunięcie auth z navbara).
**Faza zawiera jedyną zmianę łamiącą testy** — usunięcie linków auth z navbara —
sprzężoną z aktualizacją `auth-boundary.spec.ts` i `seed.spec.ts` w tym samym
commicie.

### Wymagane zmiany

#### 1. Refaktor navbara

**Plik**: `src/shared/components/Nav/Nav.tsx` + `Nav.module.css`

**Cel**: Navbar nowoczesny i intuicyjny: widoczny link do Pulpitu (`/dashboard`)
i homepage (`/` — logo), ThemeToggle przeniesiony między „Ustawienia" a
„Wyloguj", aktywny stan linku, gładkie hovery; dla gościa **bez linków auth**
(są na homepage).

**Kontrakt**: Stan zalogowany — kolejność w `.links`: link „Pulpit" →
`/dashboard` (NOWY), „Historia" → `/dashboard/history`, „Ustawienia" →
`/account/settings`, `<ThemeToggle/>` (przeniesiony tu), „Wyloguj" (ghost Button
z Fazy 2). Stan niezalogowany — **usunąć** linki „Zaloguj się"/„Zarejestruj
się"; zostaje logo + `<ThemeToggle/>`. Aktywny link: `aria-current="page"`
wyliczany z `usePathname()` (wydzielić minimalny client component dla linków,
lub oznaczyć aktywny serwerowo jeśli prostsze) + styl `[aria-current="page"]`
(animowany underline `::after` scaleX). **Niezmienne:**
`<nav aria-label="Nawigacja główna">` (kotwica E2E + strict-mode), tekst
„Wyloguj", `formAction={logoutAction}`, ThemeToggle `role='switch'`. Hover
linków przez `--transition-hover`.

#### 2. Sprzężona aktualizacja testów E2E

**Pliki**: `src/__tests__/e2e/auth-boundary.spec.ts` (linie 16-20 i 33-37),
`src/__tests__/e2e/seed.spec.ts` (linie 51-58)

**Cel**: Po usunięciu linku „Zaloguj się" z navbara testy muszą celować w CTA
homepage (jedyny „Zaloguj się" na `/`).

**Kontrakt**: W obu wystąpieniach `auth-boundary` i w `seed` zamienić lokator
zawężony do nav na page-level:
`page.getByRole('link', { name: 'Zaloguj się' })`. Zaktualizować komentarz w
`seed.spec.ts` (wzorzec referencyjny) by nie uczył nieaktualnego scope-do-nav.
Asercje negatywne („Panel studenta" `.not.toBeVisible()`) i redirect → `/` bez
zmian. **Ta zmiana wchodzi w tym samym commicie co usunięcie linków z
`Nav.tsx`.** Dokładne diffy: research §„Follow-up Research 2026-06-15".

#### 3. Modernizacja strony ustawień

**Pliki**: `src/app/account/settings/page.module.css`,
`DeleteAccountSection.module.css`, `CancelDeletionSection.module.css`

**Cel**: `/account/settings` wygląda nowocześnie i spójnie (punkt 7): czytelne
sekcje (karty/surface, border, spacing z tokenów), przyciski z systemu Fazy 2,
warning banner wyrazisty w obu motywach.

**Kontrakt**: Opakować sekcje w surface z `--color-bg-surface`, `border`,
`--radius-lg`, `--shadow-card`; spójny spacing z tokenów; input z lepszym focus.
Przyciski już zmigrowane w Fazie 2 — tu tylko layout/sekcje. **Niezmienne:**
`getByLabel` inputu („Wpisz DELETE…"), teksty przycisków „Usuń konto"/„Anuluj
usunięcie", komunikaty sukcesu/błędu, `htmlFor`/`id` powiązania.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Lint: `npm run lint`
- Testy jednostkowe: `npm run test`
- Testy E2E przechodzą (wymaga buildu — webServer używa `npm run start`):
  `npm run test:e2e`

#### Weryfikacja ręczna

- Navbar (zalogowany): widoczny „Pulpit"→/dashboard, aktywny link podświetlony,
  ThemeToggle między Ustawieniami a Wyloguj, gładkie hovery.
- Navbar (gość): brak linków auth, jest logo + ThemeToggle; `<nav>` zachowany.
- `/account/settings` wygląda nowocześnie w obu motywach.
- E2E `auth-boundary` i `seed` zielone (lokator page-level, brak strict-mode).

**Uwaga implementacyjna**: zatrzymaj się na ręczne potwierdzenie przed Fazą 6.

---

## Faza 6: Homepage hero

### Przegląd

Punkt 11 (homepage). Hero z animowanym tłem SVG (gradient mesh) i mocnym CTA;
teksty linków CTA zachowane (kotwice E2E po Fazie 5).

### Wymagane zmiany

#### 1. Hero z gradient mesh + animacja CSS

**Plik**: `src/app/page.tsx` + `page.module.css`

**Cel**: Strona główna „wychodzi z MVP" — przyciąga uwagę: animowane tło SVG/
gradient mesh, wyraźna hierarchia, mocne CTA. Lekkie, dostępne, zostaje w RSC.

**Kontrakt**: Dodać dekoracyjne tło: inline SVG lub warstwy gradientu w `.page`
(`position: absolute; inset: 0; z-index: -1; pointer-events: none; aria-hidden="true"`).
Powolna animacja CSS `@keyframes` wyłącznie na `transform`/`opacity` warstw;
budżet < 80KB. Tekst nad tłem z gwarantowanym kontrastem (≥4.5:1 — w razie
potrzeby półprzezroczysta warstwa surface pod treścią). CTA przez Button z Fazy
2 (primary „Zaloguj się"→/login, secondary „Zarejestruj się"→/register;
zalogowany: primary „Przejdź do Pulpitu"→/dashboard). **Niezmienne teksty CTA**
(kotwice E2E). `@media (prefers-reduced-motion: reduce)` zatrzymuje animację tła
(jawne `animation: none` na warstwach — globalny blok nie wystarcza dla
statycznego transformu). Bez `'use client'` (czysty CSS/markup).

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Lint: `npm run lint`
- Testy E2E przechodzą: `npm run test:e2e`

#### Weryfikacja ręczna

- Homepage (gość) ma atrakcyjne hero z animowanym tłem; CTA „Zaloguj się"/
  „Zarejestruj się" wyraziste; kontrast tekstu OK w obu motywach.
- Homepage (zalogowany) ma „Przejdź do Pulpitu".
- `prefers-reduced-motion` zatrzymuje animację tła.
- Wydajność: brak zauważalnego jank; tło nie blokuje interakcji.

**Uwaga implementacyjna**: po Fazie 6 uruchom pełny `npm run test:e2e` i zamknij
zmianę.

---

## Strategia testowania

### Testy jednostkowe

- Bez nowej logiki domenowej — istniejące testy walidatora/akcji nie powinny
  ulec zmianie. Uruchamiać `npm run test` po każdej fazie jako regresję.

### Testy integracyjne / E2E

- Kotwice E2E zachowane przez fazy 1-4 i 6; jedyna zmiana w testach to Faza 5
  (sprzężona z navbarem).
- Po Fazie 5 i 6: pełny `npm run test:e2e` (wymaga `npm run build`, bo webServer
  używa `npm run start`).

### Kroki testowania ręcznego

1. Po Fazie 1: przełącz motyw light/dark, sprawdź badge w historii i podpisy w
   szczegółach sesji — kontrast.
2. Po Fazie 2: najedź na każdy przycisk w obu motywach — gładki hover, brak
   martwych stanów; „Wyloguj" widoczny w dark.
3. Po Fazie 3: resize okna na `/dashboard` i `/dashboard/history` — siatka 1/2/3
   kol.; `critical_miss` label.
4. Po Fazie 4: przełącz filtr historii; obejrzyj stepper w szczegółach sesji.
5. Po Fazie 5: navbar zalogowany/gość; `/account/settings`; `npm run test:e2e`.
6. Po Fazie 6: homepage gość/zalogowany; reduced-motion.

## Uwagi dotyczące wydajności

- Animacje wyłącznie `transform`/`opacity` (GPU, brak reflow). Tło hero < 80KB,
  inline SVG/CSS — bez dodatkowych żądań sieciowych.
- Brak nowych zależności runtime (bez View Transitions/Framer Motion).

## Uwagi dotyczące migracji

- Brak migracji danych. Migracja wizualna: stare lokalne style przycisków
  usuwane po przejściu na `Button` (Faza 2) — sprawdzić brak osieroconych klas
  CSS.

## Referencje

- Powiązane badania: `context/changes/ui-refresh/research.md` (w tym §E2E Impact
  i §Follow-up Research 2026-06-15 z gotowymi diffami testów).
- Design system: `context/changes/ui-design-system/plan.md`,
  `context/changes/ui-design-system/research.md`.
- Lekcje: `context/foundation/lessons.md` (CSS Modules, lucide-react).
- Tokeny: `src/app/globals.css`.

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Fundament tokenów — dark mode statusy + motion

#### Automatyczne

- [x] 1.1 Build przechodzi: `npm run build` — 74b1985
- [x] 1.2 Lint przechodzi: `npm run lint` — 74b1985
- [x] 1.3 Format zgodny: `npm run format:check` — 74b1985

#### Ręczne

- [ ] 1.4 Badge „Pozytywny"/„Negatywny" czytelne w dark mode
- [ ] 1.5 Podpisy muted czytelne na ciemnym tle
- [ ] 1.6 Brak regresji w light mode
- [ ] 1.7 Kontrast zweryfikowany (≥4.5:1 tekst, ≥3:1 obwódka) w obu motywach

### Faza 2: Wspólny system przycisków + polish hover

#### Automatyczne

- [x] 2.1 Typecheck: `npm run typecheck` — 5195804
- [x] 2.2 Build: `npm run build` — 5195804
- [x] 2.3 Lint: `npm run lint` — 5195804
- [x] 2.4 Testy: `npm run test` — 5195804

#### Ręczne

- [x] 2.5 Wszystkie przyciski mają gładki hover w obu motywach; „Wyloguj"
      widoczny w dark
- [x] 2.6 Brak regresji w stanach loading (spinner)
- [x] 2.7 `prefers-reduced-motion` wyłącza lift
- [x] 2.8 Teksty przycisków niezmienione (kontrola kotwic E2E)

### Faza 3: Karty, badge i responsywne siatki

#### Automatyczne

- [x] 3.1 Typecheck: `npm run typecheck` — 228eef8
- [x] 3.2 Build: `npm run build` — 228eef8
- [x] 3.3 Lint: `npm run lint` — 228eef8
- [x] 3.4 Testy: `npm run test` — 228eef8

#### Ręczne

- [ ] 3.5 Siatka 1/2/3 kol. na `/dashboard` i `/dashboard/history`
- [ ] 3.6 Badge czytelne i spójne; `critical_miss` = „Krytyczny brak"
- [ ] 3.7 HistoryCard ma hover; semantyka `<ul>`/`<li>` zachowana

### Faza 4: Filtr historii + stepper szczegółów sesji

#### Automatyczne

- [ ] 4.1 Typecheck: `npm run typecheck`
- [ ] 4.2 Build: `npm run build`
- [ ] 4.3 Lint: `npm run lint`
- [ ] 4.4 Testy: `npm run test`

#### Ręczne

- [ ] 4.5 Filtr przełącza listę; domyślnie wszystkie; sortowanie od najnowszych
- [ ] 4.6 Stepper z linią-kropką; węzły kolorowane wg wyniku; czytelne w obu
      motywach
- [ ] 4.7 Czytnik ekranu ogłasza listę (role=list)

### Faza 5: Navbar + settings + sprzężona aktualizacja E2E

#### Automatyczne

- [ ] 5.1 Typecheck: `npm run typecheck`
- [ ] 5.2 Build: `npm run build`
- [ ] 5.3 Lint: `npm run lint`
- [ ] 5.4 Testy jednostkowe: `npm run test`
- [ ] 5.5 Testy E2E: `npm run test:e2e`

#### Ręczne

- [ ] 5.6 Navbar zalogowany: „Pulpit", aktywny link, ThemeToggle między
      Ustawieniami a Wyloguj
- [ ] 5.7 Navbar gość: brak linków auth, jest logo + ThemeToggle; `<nav>`
      zachowany
- [ ] 5.8 `/account/settings` nowoczesny w obu motywach
- [ ] 5.9 E2E `auth-boundary` i `seed` zielone (brak strict-mode)

### Faza 6: Homepage hero

#### Automatyczne

- [ ] 6.1 Typecheck: `npm run typecheck`
- [ ] 6.2 Build: `npm run build`
- [ ] 6.3 Lint: `npm run lint`
- [ ] 6.4 Testy E2E: `npm run test:e2e`

#### Ręczne

- [ ] 6.5 Homepage gość: hero z animowanym tłem, CTA wyraziste, kontrast OK
- [ ] 6.6 Homepage zalogowany: „Przejdź do Pulpitu"
- [ ] 6.7 `prefers-reduced-motion` zatrzymuje animację tła
- [ ] 6.8 Brak janku; tło nie blokuje interakcji
