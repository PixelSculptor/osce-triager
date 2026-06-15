---
date: 2026-06-15T10:57:00+0200
researcher: Kacper Nadstoga
git_commit: 26c110d3094b046f11473b7329e902074da5caa5
branch: ui-design-system
repository: osce-traiger
topic:
  'Design system for OSCE Triager — typography, color, icons, motion, radius,
  borders, spacing tokens'
tags:
  [
    research,
    codebase,
    design-system,
    design-tokens,
    color,
    typography,
    motion,
    lucide,
    accessibility,
    dark-mode,
  ]
status: complete
last_updated: 2026-06-15
last_updated_by: Kacper Nadstoga
---

# Research: Design system for OSCE Triager

**Date**: 2026-06-15T10:57:00+0200 **Researcher**: Kacper Nadstoga **Git
Commit**: 26c110d3094b046f11473b7329e902074da5caa5 **Branch**: ui-design-system
**Repository**: osce-traiger

## Research Question

Obecny design jest nieczytelny, mało dostępny, ciemny i ponury, nie ma
tożsamości biznesowej i nie kojarzy się z aplikacją dla studentów medycyny.
Potrzebny jest głęboki research, by zbudować przejrzysty, estetyczny **design
system** obejmujący: typografię, paletę kolorów, zestaw ikon (skłaniamy się ku
**Lucide React**), animacje, przejścia, zaokrąglenia, bordery i spacing — z
odpowiednimi **tokenami**.

**Zatwierdzony kierunek** (AskUserQuestion, 2026-06-15):

- **Tożsamość:** _Clinical & trustworthy_ — medyczny teal/blue, chłodne (cool)
  szarości, spokój, precyzja, „hospital-grade".
- **Tryb ciemny:** **pełny dual light + dark**, oba pierwszoklasowe, pełne
  zestawy tokenów semantycznych, sterowane jawnie (NIE `prefers-color-scheme`
  auto).
- **Output:** research + **gotowe tokeny do wdrożenia** (wartości hex/rem/ms)
  zmapowane na obecną architekturę CSS Modules + CSS custom properties.

## Summary

Obecny stack to **Next.js 16 + CSS Modules + CSS custom properties** (BEZ
Tailwind). W `src/app/globals.css` istnieje już zalążek tokenów (paleta „S-04":
indigo `#6366f1`, error, shadows, badge/outcome, dwa transitiony), ale:

1. **Font** to gołe `Arial, Helvetica, sans-serif` — stąd wrażenie
   „generycznego/nieczytelnego". → Rekomendacja: **Inter** (UI/body) +
   opcjonalnie **IBM Plex Sans** (nagłówki) + **IBM Plex Mono** (dane), przez
   `next/font/google` z **`subsets: ['latin','latin-ext']`** (krytyczne dla
   polskich znaków).
2. **Kolor** to generyczny SaaS-owy indigo bez tożsamości medycznej. → Zmiana
   primary na **medyczny teal** (`teal-600 #009689` light / `teal-400 #00d5be`
   dark) + **sky** jako accent + **slate** (cool-gray) jako neutral. Skala OKLCH
   (Tailwind v4) gotowa do wklejenia.
3. **Dark mode** jest „ponury", bo auto-`prefers-color-scheme` z czystą czernią
   `#0a0a0a` i niskim kontrastem. → Pełny dual theme przez **`[data-theme]`**
   (next-themes lub cookie-SSR), nie-ponure ciemne powierzchnie slate
   (`#020618`→`#314158`, nigdy `#000`), tekst slate-100 (nie czysta biel).
4. **Dostępność** („mało dostępny") — brak gwarancji kontrastu WCAG. →
   Dwuwarstwowa architektura tokenów (primitives → semantic aliases) z parami
   spełniającymi 4.5:1 (tekst) / 3:1 (UI), weryfikacja w CI.
5. **Spacing / radius / borders** są **hardcodowane** w 13 plikach
   `*.module.css` (15 różnych wartości spacing, 10 font-size, 5 radius, ~28
   kolorów, w tym powtarzane `rgba(128,128,128,*)`). → Pełne skale tokenów:
   `--space-*` (siatka 4/8px), `--radius-*` (baza 8px), `--border-*`,
   `--shadow-xs…xl` (osobne dla light/dark), focus-ring.
6. **Motion** — dwa tokeny (`--transition-fast/base`) łączą duration+easing. →
   Rozbić na primitives: `--duration-*` (100–400ms) + `--ease-*` (cubic-bezier
   M3), `prefers-reduced-motion` globalnie, subtelne micro-interakcje, wsparcie
   dla @dnd-kit.
7. **Ikony** — brak biblioteki. → **Lucide React** zwalidowane: v1.18.0 wspiera
   React 19, `optimizePackageImports`, kategoria Medical (42 ikony pokrywają
   OSCE/triage), `currentColor` idealne dla CSS vars.

## Detailed Findings

### 1. Kolor & dual-theme tokens

**Color science (clinical/healthcare):** Niebieski to najczęstszy kolor w
aplikacjach zdrowotnych (~60%) — kojarzony z zaufaniem, spokojem,
profesjonalizmem. Teal/cyan czyta się jako „czyste światło w gabinecie" —
wyraźnie _medyczny_, w odróżnieniu od generycznego indigo. Zieleń =
zdrowie/pozytyw (success). **Unikać czerwieni** poza błędami/alertami (w
kontekście klinicznym = nagły wypadek/lęk) oraz neonowych, mocno nasyconych
wypełnień (zmęczenie wzroku). Cool-tinted neutrals (slate) wzmacniają
„hospital-grade".

**Podejście:** perceptualnie-jednorodne skale **OKLCH** (Tailwind v4, zgodne z
W3C Design Tokens v1, stabilne X 2025). Mapowanie:

- **Primary = Teal** · **Accent/secondary = Sky** · **Neutral = Slate** ·
  **Success = Emerald, Warning = Amber, Danger = Red, Info = Sky**.

Pełne skale hex (50→950) — gotowe primitives:

| Step | Teal (primary) | Sky (accent) | Slate (neutral) |
| ---- | -------------- | ------------ | --------------- |
| 50   | `#f0fdfa`      | `#f0f9ff`    | `#f8fafc`       |
| 100  | `#cbfbf1`      | `#e0f2fe`    | `#f1f5f9`       |
| 200  | `#96f7e4`      | `#b8e6fe`    | `#e2e8f0`       |
| 300  | `#46ecd5`      | `#74d4ff`    | `#cad5e2`       |
| 400  | `#00d5be`      | `#00bcff`    | `#90a1b9`       |
| 500  | `#00bba7`      | `#00a6f4`    | `#62748e`       |
| 600  | `#009689`      | `#0084d1`    | `#45556c`       |
| 700  | `#00786f`      | `#0069a8`    | `#314158`       |
| 800  | `#005f5a`      | `#00598a`    | `#1d293d`       |
| 900  | `#0b4f4a`      | `#024a70`    | `#0f172b`       |
| 950  | `#022f2e`      | `#052f4a`    | `#020618`       |

Semantyczne źródła: Emerald (50 `#ecfdf5`, 500 `#00bc7d`, 600 `#009966`, 700
`#007a55`, 900 `#0d4f3c`), Amber (100 `#fef3c6`, 500 `#fe9a00`, 600 `#e17100`,
700 `#bb4d00`, 900 `#7b3306`), Red (100 `#ffe2e2`, 500 `#fb2c36`, 600 `#e7000b`,
700 `#c10007`, 900 `#82181a`), Info = Sky.

**Architektura dwuwarstwowa (primitives → semantic aliases):** komponenty
referują TYLKO aliasy; przełączanie motywu remapuje aliasy, nigdy primitives.
Rekomendowane nazwy:
`--color-bg-page / -surface / -surface-raised / -surface-overlay / -subtle`,
`--color-text-primary / -secondary / -muted / -on-interactive / -link`,
`--color-border-default / -subtle / -strong / -focus`,
`--color-interactive-primary(-hover/-active) / -secondary`,
`--color-{success|warning|danger|info}-{fg|bg|border}`.

**Light:** bg-page `slate-50`, surface `#fff`, text-primary `slate-900`,
text-secondary `slate-600`, border-default `slate-200`, interactive-primary
`teal-600`, on-interactive `#fff`. **Dark:** bg-page `slate-950 #020618`,
surface `slate-900 #0f172b`, surface-raised `slate-800 #1d293d`, surface-overlay
`slate-700 #314158`, text-primary `slate-100`, text-secondary `slate-400`,
border-default `slate-700`, interactive-primary **`teal-400`**
(jaśniejszy/odsycony krok), on-interactive `slate-950`. **Reguła:** odwracaj
krok marki zależnie od motywu (teal-600 na light, teal-400 na dark).

**Przełączanie motywu w Next.js App Router (bez FOUC):** rekomendowane
**`next-themes`** (`attribute="data-theme"`, `suppressHydrationWarning` na
`<html>`), albo **cookie-based SSR** (zero zależności — czytaj cookie w root
`layout.tsx`, renderuj `<html data-theme={...}>` na serwerze). NIE używać
auto-`prefers-color-scheme`.

**Dostępność (WCAG 2.2 AA):** tekst 4.5:1, large (≥24px / ≥18.66px bold) 3:1,
elementy nie-tekstowe (bordery, focus, ikony znaczące) 3:1. Bezpieczne pary:
slate-900/#fff (~17:1), slate-600/#fff (~7:1), teal-700/#fff (~5.5:1,
marka/linki na light), #fff/teal-600 (~3.4:1 — tylko 16px+ semibold), w dark:
slate-100/slate-950 (~17:1), teal-400/slate-900. Weryfikować w CI
(jest-axe/pa11y/Lighthouse); APCA tylko do fine-tuningu, compliance wg WCAG 2.2.

**Nie-ponury dark mode:** nigdy `#000` (halacja) → slate-tinted base
`#020618`/`#0f172b`; nigdy czysta biel tekstu → `slate-100 #f1f5f9`; elewacja =
**jaśniejsza powierzchnia**, nie cień; odsycaj markę/akcenty (kroki 300/400).

### 2. Typografia

**Fonty (wszystkie pokrywają Latin Extended-A = pełne polskie diakrytyki ą ć ę ł
ń ó ś ź ż):**

- **Inter** — rekomendacja na UI/body. Zaprojektowany pod ekran (wysoki
  x-height, otwarte aperture), neutralny, „trustworthy", świetny przy małych
  rozmiarach i długim czytaniu, dobre tabular figures.
- **IBM Plex Sans** (opcjonalnie nagłówki) — humanistyczny, odrobina charakteru,
  spójna rodzina Sans+Mono+Serif.
- **IBM Plex Mono** (dane/score/ID) lub **Atkinson Hyperlegible Mono** (max
  rozróżnialność cyfr — istotne przy dawkach/ID).

Minimalny stack: **Inter + IBM Plex Mono**. Bogatszy: **Inter + IBM Plex Sans +
IBM Plex Mono**.

**next/font (App Router):** import w `layout.tsx`,
`subsets: ['latin','latin-ext']` (KRYTYCZNE — samo `'latin'` NIE pokrywa
ą/ę/ł/ś/ż → layout shift), `display: 'swap'`, `variable: '--font-sans'`,
podpięcie zmiennych na `<html className={...}>`, a w `globals.css` alias
`--font-family-sans: var(--font-sans), system-ui, …`. Variable font (Inter) =
jeden plik, brak CLS (Next dolicza `size-adjust` fallbacku).

**Skala typu (modular 1.25, baza 16px; alternatywa 1.2 dla spokojniejszej
hierarchii):**

| Token              | rem    | px  | Użycie               | line-height | weight  |
| ------------------ | ------ | --- | -------------------- | ----------- | ------- |
| `--font-size-xs`   | 0.75   | 12  | captions/labels      | 1.4         | 400     |
| `--font-size-sm`   | 0.875  | 14  | secondary UI, tabele | 1.5         | 400     |
| `--font-size-base` | 1      | 16  | **body**             | 1.6         | 400     |
| `--font-size-md`   | 1.25   | 20  | lead                 | 1.6         | 400     |
| `--font-size-lg`   | 1.5625 | 25  | H4 / card title      | 1.5         | 500/600 |
| `--font-size-xl`   | 1.953  | 31  | H3                   | 1.3         | 600     |
| `--font-size-2xl`  | 2.441  | 39  | H2                   | 1.2         | 600/700 |
| `--font-size-3xl`  | 3.052  | 49  | H1                   | 1.15        | 700     |

line-height (unitless): tight 1.15, snug 1.3, normal 1.5, relaxed 1.6. weight:
normal 400, medium 500, semibold 600, bold 700. letter-spacing: tight `-0.02em`
(duże nagłówki), normal `0`, wide `0.02em` (caps).

**Czytelność:** measure 60–75ch (`--measure: 70ch`), body line-height 1.5–1.6,
nagłówki 1.15–1.3, body weight 400 (nie <400 — cienkie kroje szkodzą), min 16px
dla tekstu czytanego, `clamp()` tylko na nagłówkach (z członem `rem`, by zoom
działał — WCAG 1.4.4), nie justować body, przetrwać user text-spacing (WCAG
1.4.12: do 0.12em letter / 1.5 line).

### 3. Spacing, radius, borders, elevation

**Spacing — siatka 4px (baza) / 8px (rytm), rem:** `--space-0`…`--space-24`
(`--space-1`=0.25rem/4px, `--space-2`=8, `--space-3`=12, `--space-4`=16
_default_, `--space-5`=20, `--space-6`=24, `--space-8`=32, `--space-10`=40,
`--space-12`=48, `--space-16`=64, `--space-20`=80, `--space-24`=96; sufiks =
px÷4, jak Tailwind). Wnętrza komponentów `--space-2..6`, layout `--space-8..24`.
Preferuj `gap` nad marginesami.

**Radius — baza 8px** (moderate = „profesjonalny, ale przyjazny"): `--radius-xs`
2px, `--radius-sm` 4px, `--radius-md` 6px (buttony, inputy), `--radius-lg` 8px
(karty _default_), `--radius-xl` 12px (modale), `--radius-2xl` 16px,
`--radius-full` 9999px (avatary, dots, pill). Zasada proporcjonalności: większa
powierzchnia = większy radius; nested < parent.

**Borders:** width tokens `--border-width-hairline` 1px (default), `2px`
(focus/selected), `4px` (accent bar). Kolory przez semantic aliasy powiązane z
rampą neutral. **Light:** 1px solid `slate-200/300`. **Dark:** solidne ciemne
bordery znikają → użyj **low-opacity white** `rgba(255,255,255,0.08–0.14)`.
Border = ten sam poziom (dividery, inputy); shadow = uniesienie (karty,
dropdowny, modale); nie dublować mocno obu.

**Elevation / shadow:** **Light** — warstwowe niskie-alpha czarne cienie:
`--shadow-xs` `0 1px 2px rgba(0,0,0,.05)`, `--shadow-sm` (≈ obecny
`--shadow-card`), `--shadow-md` (≈ `--shadow-card-hover`), `--shadow-lg`,
`--shadow-xl`. **Dark** — wyższa alpha, mniejszy spread; głębię niesie
**jaśniejsza powierzchnia** (`--surface-base/raised/overlay`). Migracja bez
breakage: `--shadow-card: var(--shadow-sm)`,
`--shadow-card-hover: var(--shadow-md)` (6 konsumentów: `auth.module.css`,
`HistoryCard`, `ScenarioCard`, `TestCard`, `SessionView`). Hierarchia: page 0 →
card `sm` → hover `md` → dropdown `lg` → modal `xl`.

**Focus ring (kluczowa interakcja tokenów; WCAG 2.4.7/2.4.13: ≥2px, ≥3:1):**
warstwa `outline: 2px solid transparent` (fallback forced-colors) + `box-shadow`
ring w kolorze marki, sterowane `:focus-visible`. Reuse `--color-primary` +
`--color-primary-muted`. Box-shadow (nie border) → brak reflow. Error → ring w
`--color-danger`.

### 4. Motion (animacje & przejścia)

**Duration (semantyczne, ≤400ms — spokój = szybkość):** `--duration-instant`
100ms (hover/focus/press/tint), `--duration-fast` 150ms (toggle/badge/tooltip —
zastępuje obecne 120ms), `--duration-base` 200ms
(dropdown/accordion/card-hover/drag — default), `--duration-moderate` 300ms
(modal/toast/panel), `--duration-slow` 400ms (drawer/page — sufit).

**Easing (M3, wg kierunku ruchu):** `--ease-standard` `cubic-bezier(0.2,0,0,1)`
(default, ruch on-screen), `--ease-out` `cubic-bezier(0,0,0,1)` (**wejście** —
pojawianie/rozwijanie), `--ease-in` `cubic-bezier(0.3,0,1,1)` (**wyjście** —
znikanie), `--ease-in-out` `cubic-bezier(0.4,0,0.2,1)` (symetryczne A→B),
`--ease-linear` (opacity/kolor, spinner). **Unikać** emphasized/spring/bounce
(kłóci się z „nigdy flashy").

**`prefers-reduced-motion` (WCAG 2.3.3 — istotne dla audytorium medycznego):**
globalny reset na górze `globals.css`
(`animation/transition-duration: 0.01ms !important` — `0.01ms`, nie `0`, by
`*end` eventy odpalały) + opt-in
`@media (prefers-reduced-motion: no-preference)` dla nowych animacji.

**Micro-interakcje (tylko `transform/opacity/bg/border/shadow`; nigdy
`width/height/top/left`):** button hover = `background-color` instant; press =
`scale(0.98)`; focus = `box-shadow` instant; card hover = `translateY(-2px)` +
shadow base; badge = fade + `scale(0.9→1)` fast; toast = enter slide+fade
moderate ease-out, exit fast ease-in (asymetryczne); modal = backdrop opacity +
panel `scale(0.96→1)` ease-out; spinner = `spin 1s linear infinite` (>1s →
skeleton). **@dnd-kit (triage):** sortable
`transition: transform var(--duration-base) var(--ease-standard)`; lift =
`scale(1.02)` + większy shadow; `DragOverlay` zawsze zamontowany (renderuj
warunkowo _dzieci_), `dropAnimation` krótka; `will-change: transform` tylko na
ciągniętym; reduced-motion → instant.

**Kompozycja:** trzymaj duration+easing jako primitives, potem intent-named
shorthandy (`--transition-enter: var(--duration-base) var(--ease-out)` itd.), a
komponent dostarcza `transition-property`. Migracja: obecne
`--transition-fast/base` łączą duration+easing — rozbić.

### 5. Lucide React — ikony (ZWALIDOWANE)

- **Instalacja:** `npm install lucide-react` (v1.18.0+; React 19 oficjalnie w
  peer deps — bez flag). Named imports PascalCase (`heart-pulse` →
  `HeartPulse`).
- **Tree-shaking:** `next.config` →
  `experimental: { optimizePackageImports: ['lucide-react'] }` (stabilne w Next
  16, superseduje `modularizeImports`). NIE używać deep-importów ani string-name
  registry (psują tree-shaking).
- **Rozmiar/stroke:** default 24px / strokeWidth 2 / `color="currentColor"`.
  Tokeny: `--icon-xs` 14, `--icon-sm` 16, `--icon-md` 20 (default), `--icon-lg`
  24, `--icon-xl` 32 (px); kolor przez `currentColor` + CSS vars. Cienki wrapper
  `<Icon icon={Component} size label/>` (przyjmuje komponent, nie string —
  zachowuje tree-shaking + centralizuje a11y).
- **Dostępność:** ikony domyślnie `aria-hidden` (dekoracyjne); znaczące
  standalone → `role="img"` + `aria-label`; icon-button → label na _buttonie_;
  cel dotykowy 44×44 (tablet przy łóżku, WCAG 2.5.5); nie kodować stanu triage
  samym kolorem.
- **Pokrycie medyczne (kategoria Medical, 42 ikony — zweryfikowane):**
  `stethoscope`, `heart-pulse`, `activity`, `square-activity`, `scan-heart`,
  `thermometer(-snowflake)`, `pill`, `pill-bottle`, `tablets`, `syringe`,
  `microscope`, `test-tube(s)`, `bandage`, `brain(-circuit)`, `bone`, `ear`,
  `eye`, `dna`, `hospital`, `ambulance`, `cross`, `bed`, `droplet(s)`,
  `clipboard-list/-plus/-check/-pen`, `notebook-pen`, `file-text`,
  `scan(-line)`, `accessibility`. **Luki:** `lungs` (brak → użyj `stethoscope`),
  `wheelchair` (brak → `accessibility`), `activity-square` (→
  `square-activity`). Głębsza anatomia: uzupełnić **Healthicons** (SVGR) lub
  **@lucide/lab**.

## Code References

- `src/app/globals.css:1-25` — obecne tokeny light (`:root`): indigo primary,
  error, shadow-card/-hover, transition-fast/base, badge, outcome
- `src/app/globals.css:28-43` — tokeny dark
  (`@media prefers-color-scheme: dark`) — do zastąpienia jawnym `[data-theme]`
- `src/app/globals.css:62` — `font-family: Arial, Helvetica, sans-serif`
  (hardcoded — do tokenizacji + next/font)
- `src/app/globals.css:80` — `color-scheme` w `html`
- `src/app/layout.tsx:16` — `<html lang="pl">` (brak next/font, brak `className`
  ze zmiennymi fontów)
- `src/modules/session/components/TestCard.module.css` — hardcoded
  gap/padding/radius (3px,4px)/font-size, `rgba(128,128,128,0.3)`, `#fff`
- `src/modules/session/components/ScenarioCard.module.css` — radius 6px/4px,
  `rgba(128,128,128,0.4)`, opacity 0.8/0.6
- `src/modules/session/components/SessionView.module.css` — padding/gap,
  letter-spacing, `rgba(99,102,241,0.35)`, dashed dropzone, radius 6/4px
- `src/modules/session/components/HistoryCard.module.css` —
  `rgba(34,197,94,0.15)`, `#166534`/`#991b1b`, radius 6/4px
- `src/modules/auth/components/{Login,Register}Form.module.css` — outline
  `rgba(99,102,241,0.6)`, border `rgba(128,128,128,0.4)`, radius 4px (niemal
  identyczne — kandydat do współdzielenia)
- `src/app/(auth)/auth.module.css:15` — radius 8px, `var(--shadow-card)`
- `src/app/dashboard/session/[sessionId]/details/page.module.css` — najwięcej
  hardcoded hexów
  (`#666`,`#6b7280`,`#065f46`,`#92400e`,`#991b1b`,`#d1fae5`,`#fee2e2`,`#e5e7eb`),
  radius 4/6px/50%
- `src/shared/components/Spinner/Spinner.module.css:14` —
  `animation: spin 0.7s linear infinite` (hardcoded)
- `src/shared/components/Nav/Nav.module.css` — `rgba(128,128,128,*)`
  bordery/tła, radius 4px, używa `var(--transition-fast)` ✓
- `src/app/dashboard/page.tsx` (13,15), `src/app/account/settings/page.tsx`
  (5-6), `DeleteAccountSection.tsx` (14-49), `CancelDeletionSection.tsx` (10-28)
  — **inline styles** (łamią lesson „page.tsx → CSS Modules"; do migracji na
  tokeny)

## Architecture Insights

- **Stack: CSS Modules + CSS custom properties, BEZ Tailwind.** Cały design
  system należy dostarczyć jako CSS variables w `globals.css` — żadnej migracji
  do Tailwind. To pasuje do istniejącego wzorca i lessonów.
- **Istniejący zalążek tokenów („S-04")** dowodzi, że konwencja CSS-vars jest
  już przyjęta — rozszerzamy ją, nie wprowadzamy nowego mechanizmu.
- **Dług hardcodowania:** 15 wartości spacing, 10 font-size, 5 radius, ~28
  kolorów (w tym powtarzane `rgba(128,128,128,*)` o różnych alpha zamiast rampy
  neutral); niespójności (TestCard 4px vs button 3px; ScenarioCard 6px vs 4px).
  Tokeny semantyczne usuną tę niespójność jednym swapem rampy w dark mode.
- **Dwuwarstwowość (primitives → semantic aliases)** to oś całego systemu:
  light/dark, dostępność i spójność wynikają z tego, że komponenty referują
  tylko aliasy.
- **Lessony do uszanowania przy wdrożeniu:** `page.tsx` musi mieć `*.module.css`
  (nie inline styles — naruszane w settings/dashboard); każdy `npm run <script>`
  z kryteriów planu musi istnieć w `package.json` przed odhaczeniem.
- **Migracje bez breakage:** alias `--shadow-card/-hover` → nowa skala;
  istniejące `var(--transition-fast)` można przemapować na nowe primitives bez
  ruszania konsumentów.

## Historical Context (from prior changes)

- `context/changes/ui-design-system/change.md` — identity tej zmiany (status
  `new` → zaktualizowany na `preparing`, `updated: 2026-06-15`).
- `context/changes/ux-improvements/` — wcześniejsze prace nad UX (potencjalne
  źródło decyzji „S-04" tokenów w `globals.css`); warto sprawdzić przy
  planowaniu, by nie cofnąć ustaleń.
- Memory: `project-test-plan-session`, `project-osce-overview` — Solo MVP,
  Next.js App Router + Supabase + Cloudflare; design system to warstwa
  prezentacji nad istniejącym przepływem session/triage.

## Related Research

- Brak wcześniejszych `research.md` dot. designu w `context/changes/**` /
  `context/archive/**` — to pierwszy research design-systemowy dla projektu.

## Open Questions

1. **Jeden font czy dwa?** Inter-only (prościej, szybciej, jeden plik) vs
   Inter + IBM Plex Sans na nagłówki (więcej charakteru). Rekomendacja MVP:
   zacząć Inter-only, dołożyć Plex Sans później jeśli potrzeba.
2. **Ratio skali typu:** 1.25 (Major Third, energiczniejsza hierarchia) vs 1.2
   (Minor Third, spokojniejsza, lepsza do gęstego czytania klinicznego). Do
   decyzji w planie.
3. **Mechanizm przełącznika motywu:** `next-themes` (standard, +1 dep) vs
   cookie-SSR (zero dep, pełna kontrola). Wymaga wyboru przed implementacją
   toggle UI.
4. **Badge/outcome tokeny** — obecna paleta badge (green/yellow/orange) jest OK
   pod „suboptimal/unnecessary", ale warto przemapować na semantic
   success/warning/danger ze spójnej rampy zamiast standalone hexów.
5. **Inline styles w settings/dashboard** — czy migrować je na CSS Modules +
   tokeny w ramach tej zmiany, czy osobno? (Naruszają lesson „page.tsx → CSS
   Modules".)
6. **Zakres pierwszego PR:** tylko warstwa tokenów (globals.css + next/font +
   theme switch) vs także refaktor wszystkich 13 modułów na tokeny.
   Rekomendacja: tokeny + theme infra najpierw, migracja modułów iteracyjnie.

---

### Źródła (web research, 2025–2026)

**Kolor/theming:**
[Tailwind Colors (OKLCH)](https://tailwindcss.com/docs/colors) ·
[Radix Colors](https://www.radix-ui.com/colors) ·
[Leonardo by Adobe](https://leonardocolor.io/) ·
[next-themes](https://github.com/pacocoursey/next-themes) ·
[Evil Martians — OKLCH](https://evilmartians.com/chronicles/better-dynamic-themes-in-tailwind-with-oklch-color-magic)
· [Material dark theme](https://m2.material.io/design/color/dark-theme.html) ·
[UXmatters — color in health UX](https://www.uxmatters.com/mt/archives/2024/07/leveraging-the-psychology-of-color-in-ux-design-for-health-and-wellness-apps.php)
**Typografia:**
[Next.js Fonts](https://nextjs.org/docs/app/getting-started/fonts) ·
[Inter](https://rsms.me/inter/) · [IBM Plex](https://github.com/IBM/plex) ·
[Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) ·
[WCAG 1.4.8](https://www.w3.org/WAI/WCAG21/Understanding/visual-presentation.html)
· [Baymard — line length](https://baymard.com/blog/line-length-readability)
**Spacing/radius/elevation:**
[Tailwind Box Shadow](https://tailwindcss.com/docs/box-shadow) ·
[Carbon Spacing](https://carbondesignsystem.com/elements/spacing/overview/) ·
[Atlassian Elevation](https://atlassian.design/foundations/elevation) ·
[Sara Soueidan — focus indicators](https://www.sarasoueidan.com/blog/focus-indicators/)
·
[parker.mov — dark mode shadows](https://www.parker.mov/notes/good-dark-mode-shadows)
**Motion:**
[Material 3 — easing & duration](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)
· [Carbon Motion](https://carbondesignsystem.com/elements/motion/overview/) ·
[MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
·
[@dnd-kit DragOverlay](https://docs.dndkit.com/api-documentation/draggable/drag-overlay)
**Ikony:** [Lucide React](https://lucide.dev/guide/packages/lucide-react) ·
[Lucide a11y](https://lucide.dev/guide/advanced/accessibility) ·
[Lucide icons](https://lucide.dev/icons/) ·
[Vercel — optimizePackageImports](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
· [Healthicons](https://healthicons.org)
