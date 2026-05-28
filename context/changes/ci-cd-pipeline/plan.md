# CI/CD Pipeline — Plan implementacji (F-03)

## Przegląd

Stworzenie GitHub Actions workflow, który po każdym merge do `main` uruchamia bramkę lint+typecheck, buduje aplikację przez `@opennextjs/cloudflare` i deployuje ją na Cloudflare Workers. F-03 odblokowuje weryfikację każdego kolejnego fragmentu (S-01, S-02, S-03) na środowisku produkcyjnym.

## Analiza stanu obecnego

Brak katalogu `.github/` — żadnych GitHub Actions workflows. Projekt ma jednak kompletne narzędzia gotowe do użycia w CI:

- `package.json:17` — `"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"` — pełny build+deploy w jednej komendzie
- `wrangler.jsonc:4-18` — skonfigurowane `name`, `compatibility_date`, `vars` (NEXT_PUBLIC_*, AUTH_URL, AUTH_TRUST_HOST) i `assets`
- `devDependencies` — `@opennextjs/cloudflare@^1.19.11` i `wrangler@^4.94.0` zainstalowane, `npm ci` w CI pobierze je automatycznie
- Brak `account_id` w `wrangler.jsonc` — musi być dostarczony jako `CLOUDFLARE_ACCOUNT_ID` env var w CI

Czego brakuje: `.github/workflows/deploy.yml` oraz konfiguracji GitHub Secrets i Variables.

## Pożądany stan końcowy

Po merge do `main`: GitHub Actions uruchamia workflow, lint i typecheck przechodzą jako bramka, aplikacja jest budowana i deployowana na `https://osce-triager.kapix007.workers.dev`. Każdy fragment weryfikowalny na produkcji po merge. Status deployu widoczny na zakładce Actions w GitHub.

### Kluczowe odkrycia

- `wrangler.jsonc:vars` — `NEXT_PUBLIC_*` są tam jako Worker bindings (runtime), ale `next build` wewnątrz `opennextjs-cloudflare build` potrzebuje ich jako env vars w czasie buildu — muszą być też w GitHub Variables (`vars.X`)
- `infrastructure.md:97` — potwierdzony gotcha: „NEXT_PUBLIC_* muszą być dostępne jako zmienne środowiskowe CI w czasie buildu, nie jako Workers Secrets runtime"
- Wrangler w CI wymaga `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — `wrangler.jsonc` nie ma `account_id`, wrangler czyta go z env
- Brak test runnera (AGENTS.md) — CI nie uruchamia testów jednostkowych
- `npm run lint` i `npx tsc --noEmit` jako bramka zgodna z wymaganiem AGENTS.md: „Run `npm run lint` and `npm run build` before every commit"

## Czego NIE robimy

- Preview deploymentów na PR — tylko main branch
- Automatycznych migracji Drizzle w CI — dołączone w F-02 gdy będzie co migrować
- Ochrony preview URLs przez Cloudflare Access
- Konfiguracji wielu środowisk (staging/prod)
- Rollback automation — `wrangler rollback` dostępny ręcznie

## Podejście do implementacji

Dwie fazy w kolejności zależności: (1) stworzenie pliku workflow; (2) konfiguracja GitHub i weryfikacja pierwszego deployu. Faza 1 jest czysto kodowa — jeden plik YAML. Faza 2 jest w całości ręczna — konfiguracja w GitHub UI + Cloudflare Dashboard + obserwacja pierwszego uruchomienia.

## Faza 1: Plik workflow GitHub Actions

### Przegląd

Stworzenie `.github/workflows/deploy.yml` z triggerem push→main, bramką lint+typecheck i krokiem build+deploy.

### Wymagane zmiany

#### 1. Katalog workflows i plik deploy

**Plik:** `.github/workflows/deploy.yml` (nowy)

**Cel:** Zdefiniować automatyczny pipeline deploy — lint i typecheck jako bramka zapobiegająca deployowi zepsutego kodu, `npm run deploy` jako jeden krok budujący i deployujący na Cloudflare Workers.

**Kontrakt:**

```yaml
name: 🚀 Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Build and deploy
        run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

Node 20 (LTS) spełnia wymaganie Next.js 16 (≥18.18). `cache: 'npm'` przyspiesza pipeline przez cache `node_modules`. `NEXT_PUBLIC_*` ustawione na poziomie kroku deploy — potrzebne tylko gdy `next build` jest wywoływany przez `opennextjs-cloudflare build`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Plik `.github/workflows/deploy.yml` istnieje
- `npm run lint` przechodzi lokalnie po stworzeniu pliku
- `npx tsc --noEmit` przechodzi lokalnie

#### Weryfikacja ręczna

- Zawartość pliku YAML jest poprawna (brak błędów składni) — walidacja wizualna lub `npx js-yaml .github/workflows/deploy.yml`

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie przed Fazą 2.

---

## Faza 2: Konfiguracja GitHub + weryfikacja pierwszego deployu

### Przegląd

Konfiguracja sekretów i zmiennych w GitHub Repository Settings, następnie wypchnięcie do main i obserwacja pierwszego uruchomienia workflow.

### Wymagane zmiany

#### 1. Cloudflare API Token

**Gdzie:** Cloudflare Dashboard → My Profile → API Tokens → Create Token

**Cel:** Token z uprawnieniami do deployowania Workers, wymagany przez wrangler w kroku CI.

**Kontrakt:** Użyj szablonu „Edit Cloudflare Workers"; zakres — Account: Workers Scripts: Edit + Workers Routes: Edit; Zone: nie wymagany dla workers.dev. Skopiuj wygenerowany token — pokazywany tylko raz.

#### 2. GitHub Secrets

**Gdzie:** GitHub → repozytorium → Settings → Secrets and variables → Actions → Secrets

**Cel:** Dostarczyć poświadczenia Cloudflare do kroku build+deploy; wartości ukryte w logach CI.

**Kontrakt:** Dodaj dwa sekrety:
- `CLOUDFLARE_API_TOKEN` — token z kroku 1
- `CLOUDFLARE_ACCOUNT_ID` — ID konta Cloudflare (widoczne w URL dashboard: `dash.cloudflare.com/<ACCOUNT_ID>` lub przez `wrangler whoami`)

#### 3. GitHub Repository Variables

**Gdzie:** GitHub → repozytorium → Settings → Secrets and variables → Actions → Variables

**Cel:** Dostarczyć `NEXT_PUBLIC_*` jako build-time env vars; wartości publiczne (anon key), nie wymagają ochrony jak sekrety.

**Kontrakt:** Dodaj dwie zmienne (wartości skopiować z `wrangler.jsonc:14-15`):
- `NEXT_PUBLIC_SUPABASE_URL` — `https://yehnxcansdzrfukqjpor.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — wartość z `wrangler.jsonc`

#### 4. Weryfikacja pierwszego deployu

**Cel:** Potwierdzić, że cały pipeline działa od końca do końca na środowisku produkcyjnym.

**Kontrakt:** Push dowolnego commita do `main` (lub merge istniejącego PR) → obserwuj przebieg w zakładce Actions → po sukcesie zweryfikuj URL `https://osce-triager.kapix007.workers.dev`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Workflow uruchomiony i zakończony statusem ✅ w zakładce GitHub Actions

#### Weryfikacja ręczna

- Każdy z kroków (lint, typecheck, deploy) widoczny jako ✅ w logu GitHub Actions
- `https://osce-triager.kapix007.workers.dev` odpowiada po zakończeniu workflow
- `wrangler tail osce-triager` (lokalnie) pokazuje request po odwiedzeniu URL

---

## Strategia testowania

### Kroki testowania ręcznego

1. Po stworzeniu workflow: `npm run lint` lokalnie → powinno przejść
2. `npx tsc --noEmit` lokalnie → powinno przejść
3. Push do main → zakładka Actions w GitHub → obserwuj postęp kroków
4. Po sukcesie: odwiedź `https://osce-triager.kapix007.workers.dev` → strona aplikacji
5. Celowo złam lint (wprowadź błąd składni TS), push → workflow powinien zatrzymać się na kroku Lint

## Referencje

- Roadmap F-03: `context/foundation/roadmap.md:75-87`
- Gotcha NEXT_PUBLIC_*: `context/foundation/infrastructure.md:77, 96`
- Deploy command: `package.json:17`
- Wrangler config: `wrangler.jsonc`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: Plik workflow GitHub Actions

#### Automatyczne

- [ ] 1.1 Plik `.github/workflows/deploy.yml` istnieje
- [ ] 1.2 `npm run lint` przechodzi lokalnie
- [ ] 1.3 `npx tsc --noEmit` przechodzi lokalnie

#### Ręczne

- [ ] 1.4 Zawartość YAML jest poprawna (brak błędów składni)

### Faza 2: Konfiguracja GitHub + weryfikacja pierwszego deployu

#### Automatyczne

- [ ] 2.1 Workflow uruchomiony i zakończony statusem ✅ w GitHub Actions

#### Ręczne

- [ ] 2.2 Każdy krok (lint, typecheck, deploy) widoczny jako ✅ w logu
- [ ] 2.3 `https://osce-triager.kapix007.workers.dev` odpowiada po deploy
- [ ] 2.4 `wrangler tail osce-triager` pokazuje request po odwiedzeniu URL
