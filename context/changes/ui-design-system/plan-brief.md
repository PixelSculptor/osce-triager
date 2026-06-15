# UI Design System — Krótki plan

> Pełny plan: `context/changes/ui-design-system/plan.md` Badania:
> `context/changes/ui-design-system/research.md`

## Co i dlaczego

Obecny design jest nieczytelny i nie ma tożsamości medycznej — generyczny indigo
SaaS, Arial, brak dark mode pod kontrolą, 13 modułów CSS z hardkodowanymi
wartościami. Budujemy kompletny design system (_Clinical & trustworthy_): pełna
warstwa tokenów CSS (kolory, typografia, spacing, motion), dual light/dark theme
sterowany jawnie przez `[data-theme]`, czcionka Inter, ikony Lucide React,
migracja wszystkich istniejących plików na tokeny.

## Punkt wyjścia

`globals.css` ma 83 linie z palety S-04 (indigo) i
`@media prefers-color-scheme: dark`. Layout nie ładuje fontów. 13 plików
`*.module.css` + 4 komponenty z inline styles zawierają hardkodowane
kolory/spacing/radius. Tokeny CSS variables są już konwencją w projekcie (S-04
jako proof of concept).

## Pożądany stan końcowy

Kliknięcie ThemeToggle w Nav przełącza motyw light/dark bez FOUC. Wszystkie
komponenty automatycznie adoptują nowe kolory (teal zamiast indigo, slate
neutrals), tekst renderowany Inter z polskim subsetem. Żaden plik `*.module.css`
nie zawiera hardkodowanych hexów, `rgba(128,128,128,*)` ani literalnych
radius/spacing — tylko tokeny semantyczne.

## Kluczowe podjęte decyzje

| Decyzja                 | Wybór                                              | Dlaczego (1 zdanie)                                                                                  | Źródło  |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| Tożsamość kolorystyczna | Teal primary / Sky accent / Slate neutral          | Medyczny „hospital-grade" — teal = "czyste światło w gabinecie" w odróżnieniu od generycznego indigo | Badania |
| Dual-theme mechanism    | `[data-theme]` atrybut na `<html>`                 | Jawna kontrola (NIE auto `prefers-color-scheme`), SSR-safe, no FOUC                                  | Badania |
| Theme toggle library    | `next-themes`                                      | Standard branżowy, +1 mała zależność (3.3kB), zero boilerplate po stronie projektu                   | Plan    |
| Font stack              | Inter + IBM Plex Mono                              | Inter = najlepszy font UI; Mono = wyraźne rozróżnienie danych klinicznych (score, dawki)             | Plan    |
| Skala typografii        | 1.2 (Minor Third), baza 16px                       | Spokojniejsza hierarchia — lepsza do gęstego czytania klinicznego                                    | Plan    |
| Zakres PR               | Tokeny + pełna migracja 13 modułów + inline styles | Jedno atomowe przejście eliminuje dług techniczny bez ryzyka częściowego stanu                       | Plan    |
| Token architektura      | Primitives → semantic aliases (dwuwarstwowo)       | Komponenty referują aliasy; light/dark to remap aliasów, nie prymitywów                              | Badania |
| Badge tokens            | Remap na success/warning/danger ramps              | Eliminuje izolowane hexady, dark mode działa automatycznie                                           | Plan    |
| Inline styles           | Migruj w tym PR                                    | Lekcja: każdy `page.tsx` musi mieć companion `*.module.css`                                          | Plan    |

## Zakres

**W zakresie:**

- `globals.css` — pełny rewrite (primitives + semantic aliases + migration
  aliases)
- `src/app/layout.tsx` — next/font (Inter + IBM Plex Mono), ThemeProvider,
  suppressHydrationWarning
- `next.config.ts` — optimizePackageImports dla lucide-react
- `lucide-react` + `next-themes` — instalacja
- Nowy komponent `ThemeToggle` + integracja z `Nav`
- 11 istniejących `*.module.css` — podmiana hardkodów na tokeny
- 4 nowe companion `*.module.css` + usunięcie inline styles z
  page.tsx/komponentów

**Poza zakresem:**

- Budowanie komponentów UI (Button, Input, Card) — kolejny PR
- Tailwind CSS
- Healthicons / @lucide/lab
- Migracja `var(--transition-fast/base)` — zostaną jako działające aliasy
- Testy automatyczne CSS/visual regression
- Responsywność / breakpointy

## Architektura / Podejście

```
globals.css
  :root                    ← primitives (--teal-600: #009689, --space-4: 1rem, ...)
  :root                    ← semantic defaults (light): --color-bg-page: var(--slate-50)
  :root                    ← migration aliases: --background: var(--color-bg-surface)
  [data-theme='dark']      ← semantic overrides: --color-bg-page: var(--slate-950)

layout.tsx
  ThemeProvider (next-themes, attribute="data-theme")
    <html data-theme="light|dark" className={inter.variable + ibmPlexMono.variable}>
      <Nav> → zawiera <ThemeToggle> (client component)
      {children}
```

Komponenty referują wyłącznie semantic aliases (`var(--color-border-default)`,
`var(--space-4)` itd.). Przełączenie motywu = zmiana `data-theme` na `<html>` →
remap aliasów → zero zmian w komponentach.

## Fazy w skrócie

| Faza                    | Co dostarcza                                      | Kluczowe ryzyko                                         |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| 1. Token foundation     | Kompletny globals.css z dual-theme tokenami       | Zbyt mała skala primitives — brak potrzebnego kroku hex |
| 2. Typografia + tooling | Inter/IBMPlexMono loaded, Lucide gotowy do użycia | `latin-ext` pominięte → polskie znaki się psują         |
| 3. Theme infrastructure | Działający toggle light/dark/system               | FOUC jeśli suppressHydrationWarning pominięte           |
| 4. Migracja CSS modules | Wszystkie komponenty używają tokenów              | Przeoczone hardkodowane wartości w edge-case states     |

**Wymagania wstępne:** Czysta gałąź od `main`. Brak innych otwartych PR
dotykających `globals.css` lub `layout.tsx`.

**Szacowany nakład pracy:** ~3-4 sesje implementacyjne w 4 fazach (Faza 1 i 4 są
najdłuższe).

## Otwarte ryzyka i założenia

- W dark mode kontrast badge (success/warning/danger bg + text) nie był
  weryfikowany WCAG — do sprawdzenia ręcznie po Fazie 1 (research wskazuje pary
  jako bezpieczne, ale wartości Emerald/Amber/Red-dark nie były dokładnie
  wyliczone)
- `CancelDeletionSection` i `DeleteAccountSection` są client components —
  companion moduł działa normalnie, ale typescript strict mode może wymagać
  import adjustment
- `next-themes` + App Router: `ThemeProvider` musi być Client Component child w
  `layout.tsx` (server component) — standardowy wzorzec, nie ryzyko

## Kryteria sukcesu (podsumowanie)

- Kliknięcie ThemeToggle przełącza motyw bez FOUC — tło, border, tekst adoptują
  się w całej aplikacji
- `npm run typecheck && npm run lint && npm run build` — zero błędów
- Polskie znaki (ą, ę, ś, ź, ż) renderują się w Inter bez layout shift
