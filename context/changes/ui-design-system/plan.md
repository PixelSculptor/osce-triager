# UI Design System — Plan implementacji

## Przegląd

Budujemy kompletny design system dla OSCE Triager: pełna warstwa tokenów CSS
(kolory dual-theme, typografia, spacing, radius, motion, ikony), ładowanie
fontów przez `next/font`, przełącznik motywu przez `next-themes`, instalacja
`lucide-react` oraz migracja wszystkich 13 plików `*.module.css` i 4 komponentów
z inline styles na tokeny.

## Analiza stanu obecnego

`globals.css` ma 83 linie: paleta S-04 (indigo `#6366f1`),
`@media prefers-color-scheme: dark` (do usunięcia), brak tokenów
spacing/radius/motion/typografii. Czcionka to hardkodowane
`Arial, Helvetica, sans-serif`. `layout.tsx` nie ładuje żadnych fontów przez
`next/font`. 13 plików `*.module.css` zawiera hardkodowane wartości (15 różnych
spacing, ~28 kolorów, 5 wartości radius, m.in. powtarzające się
`rgba(128,128,128,*)` o różnych alpha). 4 pliki `page.tsx`/komponenty mają
inline `style={{}}` łamiące lekcję CSS Modules.

### Kluczowe odkrycia:

- `globals.css:28-43` — `@media prefers-color-scheme: dark` do zastąpienia przez
  `[data-theme='dark']` na `<html>`
- `globals.css:62` — `font-family: Arial` (hardkodowane; do zastąpienia przez
  `var(--font-family-sans)`)
- `layout.tsx:16` — `<html lang="pl">` bez `className` (brak zmiennych fontów),
  bez `suppressHydrationWarning`
- `next.config.ts:3` — pusta konfiguracja; brak `optimizePackageImports` dla
  Lucide
- `TestCard.module.css:9` — `border-radius: 4px`, `rgba(128,128,128,0.3)`; już
  używa `var(--shadow-card)` ✓
- `SessionView.module.css:82` — `rgba(99,102,241,0.35)` (hardkodowany indigo
  zamiast tokenu focus/primary)
- `HistoryCard.module.css:36-38` — standalone `#166534`/`#991b1b` bez tokenów
- `details/page.module.css` — 8+ standalone hexów (`#666`, `#6b7280`, `#065f46`,
  `#92400e`, `#991b1b`, `#d1fae5`, `#fee2e2`, `#e5e7eb`)
- `dashboard/page.tsx:13-15`, `settings/page.tsx:14`,
  `DeleteAccountSection.tsx`, `CancelDeletionSection.tsx` — inline styles
  (naruszenie lekcji)
- `Nav.tsx` jest `async` server component — `ThemeToggle` musi być
  `"use client"` importowanym do Nav
- `npm run lint | typecheck | build` — wszystkie 3 skrypty istnieją w
  `package.json` ✓

## Pożądany stan końcowy

Po zakończeniu: przełączanie motywu działa przez UI (light/dark/system),
`globals.css` zawiera kompletny dwuwarstwowy design system (primitives →
semantic aliases), wszystkie 13 modułów CSS i 4 komponenty z inline styles
używają tokenów semantycznych, czcionka to Inter (UI) + IBM Plex Mono
(dane/kod), ikony z Lucide React są dostępne do użycia w nowych komponentach.

Weryfikacja: aplikacja działa wizualnie poprawnie w obydwu motywach, przełącznik
motywu nie powoduje FOUC, `npm run typecheck && npm run lint && npm run build`
przechodzą bez błędów.

## Czego NIE robimy

- Tailwind CSS — zostajemy przy CSS Modules + CSS custom properties
- Zmiana struktury komponentów poza usunięciem inline styles
- Budowanie komponentów UI (Button, Input, Card) — to kolejny PR
- Wdrażanie Healthicons/@lucide/lab — samo `lucide-react` wystarczy na MVP
- Migracja `var(--transition-fast/base)` w modułach CSS — zostają jako
  działające aliasy
- Zmiana schematów bazy danych ani logiki biznesowej

## Podejście do implementacji

Fazy są sekwencyjne: każda kolejna polega na tokenach z poprzedniej. Faza 1
ustanawia cały system tokenów jako CSS variables; migracja modułów w Fazie 4 to
mechaniczne podstawienie wartości. Tokeny semantyczne z Fazy 1 działają jako
migration alias layer — istniejące `var(--background)`, `var(--color-primary)`,
`var(--shadow-card)` pozostają w `:root` jako aliasy do nowych tokenów
semantycznych, więc moduły CSS które ich używają działają bez zmian aż do Fazy 4
(gdzie je i tak migrujemy).

## Krytyczne szczegóły implementacji

**Architektura `[data-theme]`:** `:root` zawiera primitives + semantyczne aliasy
domyślne (wartości light). `[data-theme='dark']` na elemencie `html` nadpisuje
wyłącznie semantyczne aliasy do wartości dark. Nie tworzymy
`[data-theme='light']` — defaults w `:root` pełnią tę rolę. Selektory
`[data-theme='dark']` muszą być na `html`, nie na `:root`, aby CSS custom
properties kaskadowały poprawnie do dzieci.

**`suppressHydrationWarning` na `<html>` jest wymagane** przez next-themes —
next-themes mutuje atrybut `data-theme` po stronie klienta, co powoduje mismatch
hydratacji bez tego atrybutu. Bez niego React wyrzuca warning w konsoli.

**Migration alias layer:** `--background: var(--color-bg-surface)`,
`--background-page: var(--color-bg-page)`,
`--foreground: var(--color-text-primary)`,
`--color-primary: var(--color-interactive-primary)`,
`--color-primary-hover: var(--color-interactive-primary-hover)`,
`--color-primary-muted: color-mix(in srgb, var(--color-interactive-primary) 10%, transparent)`,
`--color-error: var(--color-danger-fg)`,
`--color-error-hover: var(--color-danger-fg)`,
`--shadow-card: var(--shadow-sm)`, `--shadow-card-hover: var(--shadow-md)`,
badge/outcome → semantic. Dzięki temu Phase 4 moduły "działają" już po Fazie 1
nawet przed ich indywidualną migracją.

---

## Faza 1: Token foundation (`globals.css`)

### Przegląd

Pełna wymiana `globals.css`: primitives kolorów, semantyczne aliasy dla
dual-theme, tokeny spacing/radius/border/shadow/motion/typografii/ikon,
migration aliases, reset `prefers-reduced-motion`. Plik rośnie z ~83 do ~350
linii.

### Wymagane zmiany:

#### 1. `src/app/globals.css` — sekcja primitives (`:root`)

**Plik**: `src/app/globals.css`

**Cel**: Zdefiniować niezmienne prymitywy — referencyjne wartości kolorów (hex),
spacing, radius, border-width, motion. Komponenty NIGDY nie referują prymitywów
bezpośrednio — tylko przez aliasy semantyczne.

**Kontrakt**:

Kolory — kluczowe wartości z rampy (pełna tabela w `research.md §1`). Teal:
`-50 #f0fdfa` → `-600 #009689` → `-950 #022f2e`. Sky: `-50 #f0f9ff` →
`-600 #0084d1`. Slate: `-50 #f8fafc` → `-700 #314158` → `-950 #020618`. Emerald
success: `500 #00bc7d`, `600 #009966`, `700 #007a55`. Amber warning:
`500 #fe9a00`, `700 #bb4d00`. Red danger: `500 #fb2c36`, `600 #e7000b`,
`700 #c10007`. Nazwy custom properties: `--teal-600: #009689` itd. Tylko
potrzebne kroki (nie wszystkie 11).

Spacing: `--space-1: 0.25rem` (4px), `--space-2: 0.5rem`, `--space-3: 0.75rem`,
`--space-4: 1rem`, `--space-5: 1.25rem`, `--space-6: 1.5rem`, `--space-8: 2rem`,
`--space-10: 2.5rem`, `--space-12: 3rem`, `--space-16: 4rem`,
`--space-20: 5rem`, `--space-24: 6rem`.

Radius: `--radius-xs: 2px`, `--radius-sm: 4px`, `--radius-md: 6px`,
`--radius-lg: 8px`, `--radius-xl: 12px`, `--radius-2xl: 16px`,
`--radius-full: 9999px`.

Border-width: `--border-width-1: 1px`, `--border-width-2: 2px`,
`--border-width-4: 4px`.

Motion — duration: `--duration-instant: 100ms`, `--duration-fast: 150ms`,
`--duration-base: 200ms`, `--duration-moderate: 300ms`,
`--duration-slow: 400ms`. Easing (M3):
`--ease-standard: cubic-bezier(0.2,0,0,1)`, `--ease-out: cubic-bezier(0,0,0,1)`,
`--ease-in: cubic-bezier(0.3,0,1,1)`,
`--ease-in-out: cubic-bezier(0.4,0,0.2,1)`, `--ease-linear: linear`.

Icon size: `--icon-xs: 14px`, `--icon-sm: 16px`, `--icon-md: 20px`,
`--icon-lg: 24px`, `--icon-xl: 32px`.

#### 2. `src/app/globals.css` — semantyczne aliasy (`:root` = light defaults)

**Cel**: Zdefiniować semantyczne nazwy referujące prymitywy. Wartości domyślne
to light theme. `[data-theme='dark']` nadpisze te same nazwy do wartości dark.

**Kontrakt** — pełne zestawy semantycznych aliasów:

Tła: `--color-bg-page`, `--color-bg-surface`, `--color-bg-surface-raised`,
`--color-bg-surface-overlay`, `--color-bg-subtle`.

Tekst: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`,
`--color-text-on-interactive`, `--color-text-link`.

Bordery: `--color-border-default`, `--color-border-subtle`,
`--color-border-strong`, `--color-border-focus`.

Interakcja: `--color-interactive-primary`, `--color-interactive-primary-hover`,
`--color-interactive-primary-active`, `--color-interactive-primary-muted`.

Status: `--color-success-fg`, `--color-success-bg`, `--color-success-border`,
`--color-warning-fg`, `--color-warning-bg`, `--color-warning-border`,
`--color-danger-fg`, `--color-danger-bg`, `--color-danger-border`,
`--color-info-fg`, `--color-info-bg`, `--color-info-border`.

Shadow (light): `--shadow-xs: 0 1px 2px rgba(0,0,0,.05)`,
`--shadow-sm: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)` (≈ obecny
`--shadow-card`),
`--shadow-md: 0 4px 8px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)` (≈
`--shadow-card-hover`), `--shadow-lg: 0 8px 24px rgba(0,0,0,0.12)`,
`--shadow-xl: 0 16px 48px rgba(0,0,0,0.14)`.

Focus ring: `--focus-ring-width: 2px`,
`--focus-ring-color: var(--color-interactive-primary)`,
`--focus-ring-offset: 2px`.

Light values (`:root`): bg-page=`var(--slate-50)`, bg-surface=`#ffffff`,
bg-surface-raised=`var(--slate-50)`, bg-subtle=`var(--slate-100)`,
text-primary=`var(--slate-900)`, text-secondary=`var(--slate-600)`,
text-muted=`var(--slate-500)`, text-on-interactive=`#ffffff`,
text-link=`var(--teal-700)`, border-default=`var(--slate-200)`,
border-subtle=`var(--slate-100)`, border-strong=`var(--slate-300)`,
border-focus=`var(--teal-600)`, interactive-primary=`var(--teal-600)`,
interactive-primary-hover=`var(--teal-700)`,
interactive-primary-active=`var(--teal-800)`, success-fg=`var(--emerald-700)`,
success-bg=`var(--emerald-50)`, warning-fg=`var(--amber-700)`,
warning-bg=`var(--amber-100)`, danger-fg=`var(--red-700)`,
danger-bg=`var(--red-100)`, info-fg=`var(--sky-700)`, info-bg=`var(--sky-100)`.

#### 3. `src/app/globals.css` — dark theme override (`[data-theme='dark']` na `html`)

**Cel**: Nadpisać wyłącznie semantyczne aliasy do wartości dark. Primitives
pozostają niezmienione.

**Kontrakt**: Selektor `html[data-theme='dark']` (lub `[data-theme='dark']` gdy
stosowany na `<html>`). Dark values: bg-page=`var(--slate-950)` (`#020618`),
bg-surface=`var(--slate-900)` (`#0f172b`), bg-surface-raised=`var(--slate-800)`,
bg-surface-overlay=`var(--slate-700)`, bg-subtle=`var(--slate-800)`,
text-primary=`var(--slate-100)`, text-secondary=`var(--slate-400)`,
text-muted=`var(--slate-500)`, text-on-interactive=`var(--slate-950)`,
text-link=`var(--teal-400)`, border-default=`rgba(255,255,255,0.10)`,
border-subtle=`rgba(255,255,255,0.06)`, border-strong=`rgba(255,255,255,0.18)`,
border-focus=`var(--teal-400)`, interactive-primary=`var(--teal-400)`,
interactive-primary-hover=`var(--teal-300)`. Shadow dark: wyższe alpha, mniejszy
spread — `--shadow-sm: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)`,
`--shadow-md: 0 4px 8px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.25)`.

#### 4. `src/app/globals.css` — migration alias layer (`:root`)

**Cel**: Zachować stare nazwy custom properties jako aliasy do semantycznych —
istniejące konsumenty w `*.module.css` działają bez zmian w Fazie 4.

**Kontrakt**: `--background: var(--color-bg-surface)`,
`--background-page: var(--color-bg-page)`,
`--foreground: var(--color-text-primary)`,
`--color-primary: var(--color-interactive-primary)`,
`--color-primary-hover: var(--color-interactive-primary-hover)`,
`--color-primary-muted: var(--color-interactive-primary-muted)`,
`--color-error: var(--color-danger-fg)`,
`--color-error-hover: var(--color-danger-fg)`,
`--shadow-card: var(--shadow-sm)`, `--shadow-card-hover: var(--shadow-md)`,
`--transition-fast: var(--duration-instant) var(--ease-standard)`,
`--transition-base: var(--duration-base) var(--ease-standard)`,
`--color-badge-correct-bg: var(--color-success-bg)`,
`--color-badge-correct-text: var(--color-success-fg)`,
`--color-badge-suboptimal-bg: var(--color-warning-bg)`,
`--color-badge-suboptimal-text: var(--color-warning-fg)`,
`--color-badge-unnecessary-bg: var(--color-danger-bg)`,
`--color-badge-unnecessary-text: var(--color-danger-fg)`,
`--color-outcome-positive: var(--color-success-fg)`,
`--color-outcome-negative: var(--color-danger-fg)`.

#### 5. `src/app/globals.css` — typografia (`:root`)

**Cel**: Zdefiniować tokeny typograficzne. Skala 1.2 (Minor Third), baza 16px,
remowe wartości. Czcionka body będzie podpięta w Fazie 2 po załadowaniu
next/font.

**Kontrakt** — font-size (ratio 1.2 × baza 16px): `--font-size-xs: 0.75rem`,
`--font-size-sm: 0.875rem`, `--font-size-base: 1rem`, `--font-size-md: 1.2rem`,
`--font-size-lg: 1.44rem`, `--font-size-xl: 1.728rem`,
`--font-size-2xl: 2.074rem`, `--font-size-3xl: 2.488rem`. Line-height:
`--leading-tight: 1.15`, `--leading-snug: 1.3`, `--leading-normal: 1.5`,
`--leading-relaxed: 1.6`. Font-weight: `--font-weight-normal: 400`,
`--font-weight-medium: 500`, `--font-weight-semibold: 600`,
`--font-weight-bold: 700`. Letter-spacing: `--tracking-tight: -0.02em`,
`--tracking-normal: 0`, `--tracking-wide: 0.02em`. Font-family placeholders
(zastąpione w Fazie 2): `--font-family-sans: system-ui, sans-serif`,
`--font-family-mono: ui-monospace, monospace`. Measure: `--measure: 70ch`.

#### 6. `src/app/globals.css` — `body` font + `prefers-reduced-motion`

**Cel**: Zaktualizować deklarację `body` by używała tokenu zamiast `Arial`.
Dodać globalny reset motion dla dostępności (WCAG 2.3.3).

**Kontrakt**: `body { font-family: var(--font-family-sans); }` — zastąpienie
`Arial, Helvetica, sans-serif`. Reset
`@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }`
— `0.01ms` (nie `0`) aby `animationend`/`transitionend` events odpalały. Usunąć
dotychczasowy `@media (prefers-color-scheme: dark)` blok (zastąpiony przez
`[data-theme='dark']`).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run typecheck` przechodzi bez błędów
- `npm run lint` przechodzi bez błędów
- `npm run build` kończy się bez błędów

#### Weryfikacja ręczna:

- Otwórz aplikację: background strony to slate-50 (jasny off-white), primary
  color to teal (nie indigo)
- Sprawdź że `body` tekst widoczny jako Teal interactive button na LoginForm
- Sprawdź że badge "correct"/"suboptimal"/"unnecessary" renderują się poprawnie
  (zielony/żółty/czerwony)
- DevTools → Elements: `<html>` ma `data-theme` brakujący lub ustawiony przez
  next-themes

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne
potwierdzenie.

---

## Faza 2: Typografia + tooling setup

### Przegląd

Instalacja `lucide-react`, konfiguracja `next.config.ts` (tree-shaking),
załadowanie fontów Inter + IBM Plex Mono przez `next/font/google`, podpięcie
zmiennych CSS fontów w `layout.tsx`, podmiana placeholder `--font-family-*`
tokenów w `globals.css` na zmienne next/font.

### Wymagane zmiany:

#### 1. Instalacja `lucide-react`

**Plik**: `package.json` (przez CLI)

**Cel**: Udostępnić bibliotekę ikon Lucide dla przyszłych komponentów.

**Kontrakt**: `npm install lucide-react` — dodaje do `dependencies`. Wersja
v1.18.0+. Nie wymaga zmian w kodzie aż do użycia konkretnej ikony.

#### 2. `next.config.ts` — `optimizePackageImports`

**Plik**: `next.config.ts`

**Cel**: Włączyć automatyczny tree-shaking dla named importów z `lucide-react`,
eliminując pobieranie nieużywanych ikon.

**Kontrakt**: Do obiektu `nextConfig` dodać
`experimental: { optimizePackageImports: ['lucide-react'] }`. Stabilne w
Next.js 16. Nie używać `modularizeImports` (deprecated w favor of
optimizePackageImports).

#### 3. `src/app/layout.tsx` — `next/font` + font variables na `<html>`

**Plik**: `src/app/layout.tsx`

**Cel**: Załadować Inter i IBM Plex Mono jako self-hosted variable fonts z
pełnym pokryciem polskich znaków. Podpiąć CSS variables na `<html>`.

**Kontrakt**:

```ts
import { Inter, IBM_Plex_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono',
});
```

`<html>` musi mieć `className={`${inter.variable} ${ibmPlexMono.variable}`}` i
`suppressHydrationWarning` (wymagane przez next-themes w Fazie 3 — dodajemy już
teraz). Zachować `lang="pl"`.

#### 4. `src/app/globals.css` — podmiana font-family placeholder tokenów

**Plik**: `src/app/globals.css`

**Cel**: Zastąpić tymczasowe wartości `system-ui` tokenów z Fazy 1 realnymi
zmiennymi next/font.

**Kontrakt**: `--font-family-sans: var(--font-sans), system-ui, sans-serif` i
`--font-family-mono: var(--font-mono), ui-monospace, monospace`. Fallbacki
`system-ui` i `ui-monospace` są konieczne na wypadek braku załadowania fontu (CI
build, pierwszy render SSR).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run typecheck` przechodzi
- `npm run build` przechodzi (next/font pobiera font pliki w build time)

#### Weryfikacja ręczna:

- Otwórz aplikację: tekst renderowany Inter (nie Arial) — widoczna różnica w
  kształcie liter
- DevTools → Network: żadnych zewnętrznych requestów do fonts.googleapis.com
  (fonty self-hosted przez next/font)
- DevTools → Elements → `<html>`: atrybuty `class` zawierają klasy z
  `--font-sans` i `--font-mono`

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu weryfikacji,
zatrzymaj się.

---

## Faza 3: Theme infrastructure

### Przegląd

Instalacja `next-themes`, `ThemeProvider` w `layout.tsx`, nowy komponent
`ThemeToggle` (`"use client"`), wpięcie do `Nav`.

### Wymagane zmiany:

#### 1. Instalacja `next-themes`

**Plik**: `package.json` (przez CLI)

**Cel**: Dostarczyć `ThemeProvider` i `useTheme()` hook — zarządzają
`data-theme` atrybutem na `<html>` z persystencją w `localStorage` i SSR-safe
hydratacją.

**Kontrakt**: `npm install next-themes`.

#### 2. `src/app/layout.tsx` — `ThemeProvider` wrapper

**Plik**: `src/app/layout.tsx`

**Cel**: Owinąć treść layoutu w `ThemeProvider`, by `useTheme()` był dostępny w
całym drzewie komponentów.

**Kontrakt**: Import `ThemeProvider` z `'next-themes'`. Wrapping:
`<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>`.
`ThemeProvider` jest client component — działa jako client boundary w Server
Component layout.

#### 3. `src/shared/components/ThemeToggle/ThemeToggle.tsx` (nowy plik)

**Plik**: `src/shared/components/ThemeToggle/ThemeToggle.tsx`

**Cel**: Przycisk cyklujący przez motywy light → dark → system. Client
component.

**Kontrakt**: Dyrektywa `"use client"` na górze. Używa `useTheme()` z
`next-themes` → `theme` (aktualny) i `setTheme()`. Cykl: `light` → `dark` →
`system` → `light`. Renderuje `<button>` z `aria-label` opisującym aktualny
motyw (np. `"Motyw: jasny — przełącz na ciemny"`). Implementacja ikony
opcjonalna (można użyć tekstu lub Lucide `Sun`/`Moon`/`Monitor`). Wymaga
`ThemeToggle.module.css` jako companion.

#### 4. `src/shared/components/ThemeToggle/index.ts` (nowy plik)

**Plik**: `src/shared/components/ThemeToggle/index.ts`

**Cel**: Eksport barrel.

**Kontrakt**: `export { ThemeToggle } from './ThemeToggle'`.

#### 5. `src/shared/components/Nav/Nav.tsx` — dodanie ThemeToggle

**Plik**: `src/shared/components/Nav/Nav.tsx`

**Cel**: Wyświetlić `ThemeToggle` w nawigacji. Nav jest server component —
importowanie client component `ThemeToggle` jest poprawne.

**Kontrakt**: Import `ThemeToggle` i renderowanie w
`<div className={styles.links}>` przed/po linkami (ustalić pozycję wizualną).
Brak zmian w `Nav.module.css` — ThemeToggle ma własne style.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run typecheck` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna:

- Przycisk `ThemeToggle` widoczny w nawigacji
- Kliknięcie przełącza motyw: tło strony zmienia się między slate-50 (light) a
  `#020618` (dark)
- Brak FOUC przy refresh strony (motyw ładowany z localStorage przez next-themes
  SSR)
- DevTools → Elements: `<html data-theme="light|dark">` zmienia się po
  kliknięciu
- W dark mode: tekst jest slate-100 (nie pure white), background slate-900/950
  (nie `#0a0a0a`)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu weryfikacji,
zatrzymaj się.

---

## Faza 4: Migracja CSS modules

### Przegląd

Podstawienie hardkodowanych wartości na tokeny semantyczne w 11 istniejących
`*.module.css` oraz stworzenie 4 companion modułów dla komponentów z inline
styles. Zmiana czysto mechaniczna — bez zmian HTML/JSX poza usunięciem
`style={{}}`.

### Wymagane zmiany:

#### 1. `src/modules/session/components/TestCard.module.css`

**Cel**: Zastąpić hardkodowane spacing/radius/kolory tokenami.

**Kontrakt**: `rgba(128,128,128,0.3)` → `var(--color-border-default)`.
`rgba(128,128,128,0.15)` → `var(--color-border-subtle)`.
`rgba(128,128,128,0.04)` → `var(--color-bg-subtle)`. `border-radius: 4px` →
`var(--radius-sm)`. `border-radius: 3px` → `var(--radius-sm)`.
`font-size: 0.9375rem` → `var(--font-size-base)`. `font-size: 0.875rem` →
`var(--font-size-sm)`. `font-size: 0.8125rem` → `var(--font-size-xs)`.
`color: #fff` na button → `var(--color-text-on-interactive)`. `gap: 0.75rem` →
`var(--space-3)`. `padding: 0.625rem 0.875rem` → `var(--space-2) var(--space-3)`
(closest). `padding: 0.3125rem 0.75rem` → `var(--space-1) var(--space-3)`.
`padding: 0.25rem 0.625rem` → `var(--space-1) var(--space-2)`. Tokeny badge
(`var(--color-badge-*)`) zostają — są już aliasami po Fazie 1.

#### 2. `src/modules/session/components/SessionView.module.css`

**Cel**: Usunąć hardkodowany kolor indigo z dropzone i zamienić spacing/radius.

**Kontrakt**: `rgba(128,128,128,0.3)` → `var(--color-border-default)`.
`rgba(99,102,241,0.35)` (dropzone border) → `var(--color-border-focus)`.
`border-radius: 6px` → `var(--radius-md)`. `border-radius: 4px` →
`var(--radius-sm)`. `font-size: 1.75rem` → `var(--font-size-2xl)`.
`font-size: 1rem` → `var(--font-size-base)`. `font-size: 0.9375rem` →
`var(--font-size-base)`. `font-size: 0.875rem` → `var(--font-size-sm)`.
`padding: 1.5rem 2rem` → `var(--space-6) var(--space-8)`.
`padding: 0.75rem 1rem` → `var(--space-3) var(--space-4)`.
`padding: 0.5rem 1rem` → `var(--space-2) var(--space-4)`. `gap: 1.5rem` →
`var(--space-6)`. `gap: 2rem` → `var(--space-8)`. `gap: 0.5rem` →
`var(--space-2)`. `color: #fff` na backLink/endButton →
`var(--color-text-on-interactive)`. `--color-outcome-positive/negative` zostają
— aliasy po Fazie 1. `letter-spacing: 0.04em` → `var(--tracking-wide)`.

#### 3. `src/modules/session/components/HistoryCard.module.css`

**Cel**: Zastąpić standalone hexadecymalne kolory tokenami semantycznymi.

**Kontrakt**: `rgba(128,128,128,0.4)` → `var(--color-border-default)`.
`rgba(34,197,94,0.15)` → `var(--color-success-bg)`. `rgba(239,68,68,0.15)` →
`var(--color-danger-bg)`. `color: #166534` → `var(--color-success-fg)`.
`color: #991b1b` → `var(--color-danger-fg)`. `border-radius: 6px` →
`var(--radius-md)`. `border-radius: 4px` → `var(--radius-sm)`.
`font-size: 1.125rem` → `var(--font-size-md)`. `font-size: 0.875rem` →
`var(--font-size-sm)`. `font-size: 0.8125rem` → `var(--font-size-xs)`.
`gap: 0.75rem` → `var(--space-3)`. `padding: 1.25rem` → `var(--space-5)`.

#### 4. `src/modules/session/components/ScenarioCard.module.css`

**Cel**: Zastąpić border i radius tokenami.

**Kontrakt**: `rgba(128,128,128,0.4)` → `var(--color-border-default)`.
`border-radius: 6px` → `var(--radius-md)`. `border-radius: 4px` →
`var(--radius-sm)`. `color: #fff` na button →
`var(--color-text-on-interactive)`. `font-size: 1.25rem` →
`var(--font-size-md)`. `font-size: 0.9375rem` → `var(--font-size-base)`.
`font-size: 0.875rem` → `var(--font-size-sm)`. `gap: 0.75rem` →
`var(--space-3)`. `padding: 1.25rem` → `var(--space-5)`.
`padding: 0.625rem 1rem` → `var(--space-2) var(--space-4)`.

#### 5. `src/modules/session/components/DraggableTestCard.module.css`

**Cel**: Brak hardkodowanych wartości — plik pozostaje bez zmian (sprawdzić
tylko czy nie ma ukrytych hexów).

**Kontrakt**: Tylko weryfikacja — plik zawiera tylko `cursor` i `opacity` bez
hardkodowanych kolorów/radius. Jeśli czysto, bez zmian.

#### 6. `src/modules/auth/components/LoginForm.module.css` i `RegisterForm.module.css`

**Cel**: Zastąpić indigo focus outline i border tokenami. Oba pliki są
identyczne — te same zmiany.

**Kontrakt** (dla obu): `rgba(128,128,128,0.4)` na `border` →
`var(--color-border-default)`. `rgba(99,102,241,0.6)` na `outline` → zamienić na
focus ring przez
`box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color)` i
`outline: none` (box-shadow nie powoduje reflow, lepszy dla focus ring).
`border-radius: 4px` → `var(--radius-sm)`. `font-size: 1.5rem` →
`var(--font-size-lg)`. `font-size: 0.875rem` → `var(--font-size-sm)`.
`font-size: 0.8125rem` → `var(--font-size-xs)`. `font-size: 1rem` →
`var(--font-size-base)`. `gap: 1.25rem` → `var(--space-5)`.
`padding: 0.5rem 0.75rem` → `var(--space-2) var(--space-3)`.
`padding: 0.625rem 1rem` → `var(--space-2) var(--space-4)`.

#### 7. `src/shared/components/Nav/Nav.module.css`

**Cel**: Zastąpić `rgba(128,128,128,*)` tokenami border i background.

**Kontrakt**: `rgba(128,128,128,0.2)` na `border-bottom` →
`var(--color-border-subtle)`. `rgba(128,128,128,0.4)` na `border` logoutButton →
`var(--color-border-default)`. `rgba(128,128,128,0.1)` na `logoutButton:hover` →
`var(--color-bg-subtle)`. `border-radius: 4px` → `var(--radius-sm)`.
`font-size: 1rem` → `var(--font-size-base)`. `font-size: 0.875rem` →
`var(--font-size-sm)`. `padding: 0.75rem 1.5rem` →
`var(--space-3) var(--space-6)`. `padding: 0.25rem 0.75rem` →
`var(--space-1) var(--space-3)`. `gap: 1rem` → `var(--space-4)`.
`var(--transition-fast)` zostaje — jest aliasem po Fazie 1.

#### 8. `src/app/(auth)/auth.module.css`

**Cel**: Zastąpić border i radius tokenami.

**Kontrakt**: `rgba(128,128,128,0.2)` na border → `var(--color-border-subtle)`.
`border-radius: 8px` → `var(--radius-lg)`. `padding: 2rem` → `var(--space-8)`.
`var(--shadow-card)` zostaje — alias po Fazie 1. `max-width: 400px` pozostaje
(nie ma tokenu dla max-width komponentów).

#### 9. `src/shared/components/Spinner/Spinner.module.css`

**Cel**: Brak kolorów hardkodowanych — `currentColor` jest poprawne. Animacja
`0.7s linear infinite` jest dla infinite spin (nie UI transition) — pozostaje
jako literał lub zamienić na `0.75s` dla czystości. Brak pilnych zmian.

**Kontrakt**: Nie zmieniać `animation: spin 0.7s linear infinite` — duration
tokens są dla UI state transitions, nie dla infinite spin animations. Spinner
używa `currentColor` ✓.

#### 10. `src/app/page.module.css`

**Cel**: Zastąpić border i radius tokenami.

**Kontrakt**: `rgba(128,128,128,0.4)` na `secondaryBtn` border →
`var(--color-border-default)`. `border-radius: 4px` → `var(--radius-sm)`.
`font-size: 2rem` → `var(--font-size-2xl)`. `font-size: 1rem` →
`var(--font-size-base)`. `font-size: 0.9375rem` → `var(--font-size-base)`.
`padding: 3rem 1rem` → `var(--space-12) var(--space-4)`.
`padding: 0.625rem 1.25rem` → `var(--space-2) var(--space-5)`. `gap: 1.5rem` →
`var(--space-6)`. `gap: 0.75rem` → `var(--space-3)`.

#### 11. `src/app/dashboard/history/page.module.css`

**Cel**: Zastąpić spacing i brak kolorów hardkodowanych tokenami.

**Kontrakt**: Brak hardkodowanych kolorów w tym pliku (czyste opacity).
`padding: 2rem` → `var(--space-8)`. `margin: 0 0 1.5rem` → `var(--space-6)`.
`gap: 1rem` → `var(--space-4)`.

#### 12. `src/app/dashboard/session/[sessionId]/details/page.module.css`

**Cel**: Zastąpić wszystkie 8+ standalone hexów tokenami semantycznymi.

**Kontrakt**: `color: #666` → `var(--color-text-muted)`. `color: #6b7280` →
`var(--color-text-muted)`. `color: #374151` → `var(--color-text-secondary)`.
`color: #065f46` → `var(--color-success-fg)`. `color: #92400e` →
`var(--color-warning-fg)`. `color: #991b1b` → `var(--color-danger-fg)`.
`color: #6b7280` (resultUnnecessary) → `var(--color-text-muted)`.
`background: #d1fae5` → `var(--color-success-bg)`. `background: #fee2e2` →
`var(--color-danger-bg)`. `background: #e5e7eb` → `var(--color-bg-subtle)`.
`border: 1px solid #e5e7eb` → `var(--color-border-default)`.
`border-radius: 4px` → `var(--radius-sm)`. `border-radius: 6px` →
`var(--radius-md)`. `border-radius: 50%` → `var(--radius-full)`. `padding: 2rem`
→ `var(--space-8)`. `font-size: 1rem` → `var(--font-size-base)`.
`font-size: 0.875rem` → `var(--font-size-sm)`. `font-size: 0.75rem` →
`var(--font-size-xs)`.

#### 13. Nowy plik: `src/app/dashboard/page.module.css`

**Cel**: Zastąpić inline styles `dashboard/page.tsx` companion modułem CSS
(wymaganie lekcji „Pages use CSS Modules").

**Kontrakt**: Nowy plik z klasami `.main` (padding, container) i `.list` (flex
column, gap, padding/margin zero). `src/app/dashboard/page.tsx`: usunąć
`style={{ padding: "2rem" }}` z `<main>` i
`style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: 0, marginTop: "1.5rem" }}`
z `<ul>` → `className={styles.main}` i `className={styles.list}`. Tokeny:
`padding: var(--space-8)`, `gap: var(--space-4)`, `margin-top: var(--space-6)`.

#### 14. Nowy plik: `src/app/account/settings/page.module.css`

**Cel**: Zastąpić inline styles `settings/page.tsx`.

**Kontrakt**: Klasa `.main` z `padding: var(--space-8)` i `max-width: 600px`.
`settings/page.tsx`: `<main style={{ padding: "2rem", maxWidth: "600px" }}>` →
`<main className={styles.main}>`.

#### 15. Nowy plik: `src/app/account/settings/DeleteAccountSection.module.css`

**Cel**: Zastąpić inline styles `DeleteAccountSection.tsx`.

**Kontrakt**: Klasy `.section` (margin-top), `.description` (opacity),
`.fieldGroup` (margin-bottom), `.label` (display block, margin-bottom,
font-size), `.input` (padding, border, border-radius, width, max-width),
`.errorMsg` (color danger, margin, font-size), `.successMsg` (color success,
margin, font-size), `.submitButton` + `.submitButtonActive` /
`.submitButtonDisabled` (padding, border-radius, cursor; kolory przez
`var(--color-danger-fg)` gdy aktywny / `var(--color-bg-subtle)` gdy disabled).
`DeleteAccountSection.tsx`: usunąć wszystkie `style={{...}}`, zamienić na
`className={styles.*}`. Hardkodowane `color: "red"` → `var(--color-danger-fg)`,
`color: "green"` → `var(--color-success-fg)`, `#dc2626` →
`var(--color-danger-fg)`, `rgba(128,128,128,0.2)` → `var(--color-bg-subtle)`.

#### 16. Nowy plik: `src/app/account/settings/CancelDeletionSection.module.css`

**Cel**: Zastąpić inline styles `CancelDeletionSection.tsx`. Banner ostrzegawczy
powinien używać tokenów `warning`.

**Kontrakt**: Klasy `.section` (margin-top), `.warningBanner`
(`padding: var(--space-4)`, `border: 1px solid var(--color-warning-border)`,
`border-radius: var(--radius-md)`, `background: var(--color-warning-bg)`,
margin-bottom), `.bannerTitle` (font-weight semibold, margin-bottom),
`.bannerText` (font-size sm, opacity), `.cancelButton` (padding, border
`var(--color-border-default)`, border-radius, background none, color inherit,
cursor pointer). `CancelDeletionSection.tsx`: usunąć wszystkie `style={{...}}`.
Hardkodowane `#f59e0b` (amber-400 = warning) → `var(--color-warning-border)`,
`rgba(245,158,11,0.1)` → `var(--color-warning-bg)`, `rgba(128,128,128,0.4)` →
`var(--color-border-default)`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run typecheck` przechodzi (import styles w page.tsx/DeleteAccountSection
  nie generuje błędów)
- `npm run lint` przechodzi
- `npm run build` kończy się bez błędów

#### Weryfikacja ręczna:

- Przełącz motyw na dark: wszystkie komponenty (TestCard, HistoryCard,
  ScenarioCard, Nav, LoginForm, dashboard, settings) wyglądają poprawnie — tła
  ciemne, border widoczne, tekst czytelny
- Przełącz z powrotem na light: wygląd identyczny z wyjściowym (bez regresji)
- Strona settings/account: brak inline styles widocznych w DevTools → Elements
- Badge "correct"/"suboptimal"/"unnecessary" w history widoku: poprawne kolory w
  obu motywach
- CancelDeletionSection: żółty banner ostrzegawczy widoczny w obu motywach
- LoginForm/RegisterForm: focus ring teal (nie indigo) przy focus na input
- SessionView drag drop zone: border teal przy hover/over (nie indigo)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
weryfikacji, zatrzymaj się.

---

## Strategia testowania

### Testy automatyczne:

Obecny projekt nie ma testów jednostkowych dla CSS/komponentów prezentacyjnych.
Weryfikacja odbywa się przez `typecheck`, `lint`, `build` + ręczne testy
wizualne.

### Kroki testowania ręcznego:

1. Po każdej fazie: `npm run dev`, otwórz `http://localhost:3000`, sprawdź
   wygląd podstawowych ścieżek (strona główna, login, dashboard, session)
2. Faza 3: Kliknij ThemeToggle 3 razy (light → dark → system), sprawdź brak FOUC
   przy refresh
3. Faza 4: W dark mode przejdź przez: login → dashboard → start session →
   history session → settings — sprawdzaj każdą stronę
4. Sprawdź polskie znaki w tytułach (ą, ę, ś, ź, ż) — weryfikacja subset
   `latin-ext`
5. Sprawdź focus ring: Tab przez elementy interaktywne — ring powinien być teal,
   widoczny 2px

## Uwagi dotyczące migracji

- Istniejące konsumenty `var(--transition-fast)` i `var(--transition-base)`
  działają bez zmian — są aliasami po Fazie 1. Nie migrujemy ich w module CSS w
  Fazie 4 (opcjonalne cleanup w kolejnym PR).
- Istniejące `var(--shadow-card)` i `var(--shadow-card-hover)` działają jako
  aliasy — krok `sm/md` z nowej skali.
- `auth.module.css` już używa `var(--shadow-card)` i poprawnego
  `border-radius: 8px` — minimalne zmiany.
- Spinner `.animation` pozostaje z literalnym `0.7s` — nie jest to UI transition
  token.

## Referencje

- Badania (pełne wartości hex/rem/ms):
  `context/changes/ui-design-system/research.md`
- Globals CSS (punkt wyjścia): `src/app/globals.css:1-83`
- Layout (punkt wyjścia): `src/app/layout.tsx:1-23`
- Next.js Fonts docs: `src/app/layout.tsx` + `next/font/google`
- Lekcja CSS Modules: `context/foundation/lessons.md` — "Pages use CSS Modules
  for layout/spacing — never inline styles"
- Lekcja npm scripts: `context/foundation/lessons.md` — "Verify every npm-script
  success criterion exists"

---

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku.

### Faza 1: Token foundation (globals.css)

#### Automatyczne

- [ ] 1.1 `npm run typecheck` przechodzi bez błędów
- [ ] 1.2 `npm run lint` przechodzi bez błędów
- [ ] 1.3 `npm run build` kończy się bez błędów

#### Ręczne

- [ ] 1.4 Background strony: slate-50 (light), primary button teal (nie indigo)
- [ ] 1.5 Badge correct/suboptimal/unnecessary renderują się poprawnie
- [ ] 1.6 `<html>` ma atrybut `data-theme` (lub brak — ustawiony przez
      next-themes w Fazie 3)

### Faza 2: Typografia + tooling

#### Automatyczne

- [ ] 2.1 `npm run typecheck` przechodzi
- [ ] 2.2 `npm run build` przechodzi (next/font pobiera fonty)

#### Ręczne

- [ ] 2.3 Tekst renderowany Inter (nie Arial) — widoczna różnica kształtu liter
- [ ] 2.4 DevTools Network: brak requestów do fonts.googleapis.com
- [ ] 2.5 `<html class>` zawiera zmienne `--font-sans` i `--font-mono`

### Faza 3: Theme infrastructure

#### Automatyczne

- [ ] 3.1 `npm run typecheck` przechodzi
- [ ] 3.2 `npm run build` przechodzi

#### Ręczne

- [ ] 3.3 ThemeToggle widoczny w nawigacji
- [ ] 3.4 Przełącznik zmienia motyw: tło slate-50 (light) ↔ `#020618` (dark)
- [ ] 3.5 Brak FOUC przy refresh strony
- [ ] 3.6 Dark mode: tekst slate-100 (nie pure white), bg slate-900/950 (nie
      `#0a0a0a`)

### Faza 4: Migracja CSS modules

#### Automatyczne

- [ ] 4.1 `npm run typecheck` przechodzi (import styles w
      page.tsx/DeleteAccountSection)
- [ ] 4.2 `npm run lint` przechodzi
- [ ] 4.3 `npm run build` kończy się bez błędów

#### Ręczne

- [ ] 4.4 Dark mode: TestCard, HistoryCard, ScenarioCard, Nav, LoginForm —
      poprawne kolory
- [ ] 4.5 Light mode: brak regresji wizualnych w stosunku do stanu przed zmianą
- [ ] 4.6 Settings/dashboard: brak inline styles w DevTools → Elements
- [ ] 4.7 CancelDeletionSection: żółty warning banner w obu motywach
- [ ] 4.8 Focus ring na input fields: teal 2px (nie indigo)
- [ ] 4.9 SessionView dropzone: border teal (nie indigo) przy drag-over
