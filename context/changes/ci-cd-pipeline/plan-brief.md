# CI/CD Pipeline — Krótki plan (F-03)

> Pełny plan: `context/changes/ci-cd-pipeline/plan.md`

## Co i dlaczego

Stworzenie GitHub Actions workflow, który po każdym merge do `main` uruchamia bramkę lint+typecheck, buduje aplikację i deployuje ją na Cloudflare Workers. Bez CI/CD każdy deploy jest ręczny — F-03 odblokowuje weryfikację S-01, S-02, S-03 na środowisku produkcyjnym bez ręcznej pracy przy każdym fragmencie.

## Punkt wyjścia

Projekt ma w pełni skonfigurowane narzędzia deploy: `npm run deploy` (package.json:17) uruchamia `opennextjs-cloudflare build && deploy`, `wrangler.jsonc` zawiera konfigurację workera i zmienne build-time. Brakuje tylko pliku `.github/workflows/deploy.yml` i konfiguracji sekretów w GitHub.

## Pożądany stan końcowy

Po merge do `main`: GitHub Actions uruchamia 4-krokowy pipeline (checkout → lint → typecheck → deploy), aplikacja jest dostępna na `https://osce-triager.kapix007.workers.dev`. Status deployu widoczny bezpośrednio w GitHub.

## Kluczowe podjęte decyzje

| Decyzja          | Wybór                           | Dlaczego (1 zdanie)                                                                                                     | Źródło |
| ---------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| Zakres deployu   | Tylko main                      | MVP nie wymaga preview URLi; upraszcza konfigurację i eliminuje ryzyko publicznych preview bez Cloudflare Access        | Plan   |
| Bramka jakości   | lint + typecheck przed deployem | Egzekwuje regułę AGENTS.md i blokuje deploy po regresji typów                                                           | Plan   |
| Migracje DB w CI | Poza zakresem (F-02)            | Brak schematu domenowego teraz; krok migracji zostanie dodany w F-02 gdy będzie co migrować                             | Plan   |
| Runner           | ubuntu-latest                   | Standard, darmowy w GitHub Free, najlepiej udokumentowany dla wrangler                                                  | Plan   |
| NEXT*PUBLIC*\*   | GitHub repository variables     | Wartości publiczne (anon key) — vars nie secrets; muszą być env vars w czasie `next build` (gotcha z infrastructure.md) | Plan   |

## Zakres

**W zakresie:** `.github/workflows/deploy.yml`, konfiguracja GitHub Secrets (CLOUDFLARE*API_TOKEN, CLOUDFLARE_ACCOUNT_ID) i GitHub Variables (NEXT_PUBLIC*\*), weryfikacja pierwszego deployu

**Poza zakresem:** Preview deployments na PR, automatyczne migracje Drizzle, ochrona Cloudflare Access dla preview, staging environment

## Architektura / Podejście

```
push → main
  └─ ubuntu-latest
       ├─ npm ci
       ├─ npm run lint          ← bramka: blokuje przy błędach ESLint
       ├─ npx tsc --noEmit     ← bramka: blokuje przy błędach typów
       └─ npm run deploy        ← opennextjs-cloudflare build + wrangler deploy
            env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
            env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Fazy w skrócie

| Faza                     | Co dostarcza                                          | Kluczowe ryzyko                                         |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------- |
| 1. Workflow file         | `.github/workflows/deploy.yml` gotowy do push         | YAML invalid — walidacja przed push                     |
| 2. GitHub setup + deploy | Sekrety skonfigurowane, pierwszy deploy zakończony ✅ | CLOUDFLARE_API_TOKEN z niewystarczającymi uprawnieniami |

**Wymagania wstępne:** Konto Cloudflare z już zdeplowanym workerem `osce-triager` (F-01 done), dostęp do GitHub Repository Settings  
**Szacowany nakład pracy:** ~1 sesja, 2 fazy — Faza 1 ≈ 5 min, Faza 2 ≈ 15 min (ręczna konfiguracja + oczekiwanie na pipeline)

## Otwarte ryzyka i założenia

- CLOUDFLARE_API_TOKEN wymaga uprawnień „Edit Cloudflare Workers" — zły token = deploy failure bez jasnego komunikatu
- `opennextjs-cloudflare build` z Node 20 w CI może zachowywać się inaczej niż lokalnie — monitorować logi pierwszego deployu

## Kryteria sukcesu (podsumowanie)

- Workflow ✅ w zakładce GitHub Actions po push do main
- `https://osce-triager.kapix007.workers.dev` odpowiada po zakończeniu workflow
- Każdy kolejny fragment (S-01, F-02, S-02) można weryfikować na produkcji po merge
