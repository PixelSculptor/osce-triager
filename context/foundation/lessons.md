# Lessons Learned

> Rejestr tylko do dodawania powtarzających się reguł i wzorców. Odczytywany
> ponownie na początku przez /10x-frame, /10x-research, /10x-plan,
> /10x-plan-review, /10x-implement, /10x-impl-review.

## Use query modules for DB access in RSC — never self-calling REST routes

- **Context**: Next.js App Router — any RSC page (page.tsx) that needs data from
  the database
- **Problem**: Placing DB queries directly in page components scatters query
  logic and makes it hard to reuse/test; creating a REST API route for an RSC to
  call itself adds a needless HTTP round-trip and requires cookie forwarding for
  auth
- **Rule**: Pages import from server-only query modules (e.g. `queries.ts`);
  never create a REST API route just to serve data to an RSC. RSC page
  components run on the server — DB calls from them never reach the browser.
- **Applies to**: plan, implement, impl-review

## Verify every npm-script success criterion exists and runs before checking it off

- **Context**: Any plan phase whose success criteria reference an
  `npm run <script>` command for verification (typecheck / lint / build / test).
- **Problem**: A criterion named a script absent from package.json, so the
  command errored "Missing script", yet the [x] box was checked — verification
  was signed off blind across all 3 phases.
- **Rule**: Every `npm run <script>` named in a plan's success criteria must
  exist in package.json before the plan is written; verify each criterion
  actually executes before marking it [x].
- **Applies to**: all

## Pages use CSS Modules for layout/spacing — never inline styles

- **Context**: All `page.tsx` files in the Next.js App Router
  (`src/app/**/*.tsx`)
- **Problem**: Inline `style={{}}` attributes scatter presentation logic, break
  dark-mode theming via CSS custom properties, and are inconsistent with the CSS
  Modules pattern established for all other components.
- **Rule**: Every `page.tsx` must have a companion `*.module.css` file. Use CSS
  Modules for all layout, spacing, and typography — never inline `style={{}}`
  attributes.
- **Applies to**: plan, implement, impl-review

## Załaduj .env.local w playwright.config.ts gdy testy E2E potrzebują sekretów

- **Kontekst**: Konfiguracja Playwright (`playwright.config.ts`) — każda faza
  dodająca spec E2E wymagający credentiali (TEST_USER_EMAIL, TEST_USER_PASSWORD
  lub podobnych).
- **Problem**: Playwright runner nie ładuje automatycznie `.env.local` — tylko
  serwer Next.js to robi. Bez jawnego `config({ path: '.env.local' })` w
  playwright.config.ts, `auth.setup.ts` dostaje `undefined` i cały projekt
  `setup` pada, blokując wszystkie testy chromium bez czytelnej przyczyny.
- **Reguła**: Przed uruchomieniem testów E2E lokalnie: załaduj `.env.local` w
  `playwright.config.ts` przez dotenv; trzymaj `TEST_USER_*` w `.env.local`
  (gitignorowany przez `.env*`); w CI te same zmienne bierz z GitHub Secrets —
  żadna zmiana w configu CI nie jest potrzebna.
- **Dotyczy**: implement

## Każdy komponent React w dedykowanym podfolderze

- **Kontekst**: Wszystkie moduły z komponentami React (foldery `components/`)
- **Problem**: Płaska lista plików utrudnia orientację i narusza zasadę
  lokalności — trudno szybko znaleźć wszystkie składowe należące do komponentu.
- **Reguła**: Każdy komponent umieszczaj we własnym folderze `ComponentName/`
  zawierającym `ComponentName.tsx`, `ComponentName.module.css` i opcjonalnie
  `ComponentName.utils.ts`; `index.ts` na poziomie `components/` re-eksportuje
  przez `./ComponentName/ComponentName`.
- **Dotyczy**: plan, implement, impl-review

## Nigdy nie używaj glifów Unicode/emoji jako ikon UI — używaj lucide-react

- **Kontekst**: Każdy komponent/strona w warstwie prezentacji (`*.tsx`)
  renderująca afordancje UI — linki nawigacyjne, podpowiedzi, przyciski.
- **Problem**: Glify Unicode (← → ↑ ↓) renderują się niespójnie między
  fontami/platformami, nie skalują się z tokenami designu, nie dają kontroli
  stroke/rozmiaru i są problematyczne dla czytników ekranu. Wykryto w
  details/page.tsx (← ↓) i HistoryCard.tsx (→) podczas migracji
  ui-design-system.
- **Reguła**: Nigdy nie używaj znaków Unicode/emoji jako ikon UI. Używaj
  komponentów z `lucide-react` z `aria-hidden="true"` i rozmiarem z tokenów
  (`--icon-*` / `size={16}`).
- **Dotyczy**: plan, implement, impl-review
