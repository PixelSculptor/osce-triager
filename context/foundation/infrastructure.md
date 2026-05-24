---
project: osce-triager
researched_at: 2026-05-21
recommended_platform: Cloudflare Workers + Pages
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js (App Router)
  runtime: Node.js / Cloudflare Workers (via OpenNext adapter)
  database: PostgreSQL via Supabase (external)
---

## Rekomendacja

**Wdróż na Cloudflare Workers + Pages.**

Stos technologiczny (`tech-stack.md`) już wskazuje Cloudflare Pages jako cel wdrożenia, a `@opennextjs/cloudflare` (GA, 2025) zastępuje deprecated `@cloudflare/next-on-pages` i obsługuje pełny Next.js App Router z Node.js runtime. Bezpłatny tier obejmuje 100 000 żądań/dzień — wystarczający dla polskiej bazy studentów MVP — a pełny zestaw MCP (Observability, API, Docs, Builds) to najlepsza integracja z agentami AI wśród wszystkich badanych platform. Odpowiedzi z wywiadu (brak wymagań na trwałe połączenia, jeden region, Supabase jako zewnętrzny DB) nie wykluczają żadnej platformy, ale potwierdzają, że Cloudflare jest dopasowanym wyborem.

## Porównanie platform

| Platforma | CLI-first | Zarządzane/Serverless | Docs dla agenta | Stabilne API deploy | MCP / Integracja | **Suma** |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | **5/5** |
| **Vercel** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ⚠️ Partial | **4.5/5** |
| **Netlify** | ⚠️ Partial | ✅ Pass | ❌ Fail | ✅ Pass | ✅ Pass | **3.5/5** |
| **Railway** | ⚠️ Partial | ✅ Pass | ✅ Pass | ⚠️ Partial | ⚠️ Partial | **3/5** |
| **Render** | ⚠️ Partial | ✅ Pass | ✅ Pass | ⚠️ Partial | ⚠️ Partial | **3/5** |
| **Fly.io** | ⚠️ Partial | ✅ Pass | ❌ Fail | ⚠️ Partial | ⚠️ Partial | **2.5/5** |

### Notatki do ocen

**Cloudflare**: `wrangler deploy/rollback/tail/versions` pokrywa cały cykl operacyjny; pełna dokumentacja przez MCP Documentation Server (`docs.mcp.cloudflare.com`); `wrangler deploy` deterministyczne z wersjonowaniem; 5 GA MCP serverów (API, Builds, Observability, Docs, Bindings). **Uwaga**: `@cloudflare/next-on-pages` jest deprecated — wymagana migracja na `@opennextjs/cloudflare`.

**Vercel**: Natywna platforma Next.js — App Router zero-config; `vercel.com/llms.txt` i `llms-full.txt` opublikowane; Vercel MCP Server istnieje ale w stanie **beta (od 2026-02-12)**; Hobby plan darmowy, ale restrykcja tylko-niekomercyjna; log retention 1h/4000 wierszy na Hobby.

**Netlify**: OpenNext v5 (GA) pełna obsługa App Routera; GA MCP server (`@netlify/mcp`, czerwiec 2025); credit-based pricing od września 2025 (hard cap 300 kredytów/mc — serwis wstrzymywany po przekroczeniu); **rollback tylko przez UI** (brak `netlify rollback` CLI); brak `llms.txt` — dokumentacja tylko HTML.

**Railway**: Persistent Node.js (auto-detect przez Railpack); `railway.com/llms.txt` ✓; MCP server `@railway/mcp-server` istnieje ale opisywany jako **"work in progress"**; rollback tylko przez dashboard; znany 502 cold-start bug (marzec 2026, status poprawki niepotwierdzony); Railway samo porzuciło Next.js na własnym froncie.

**Render**: Persistent Node.js; `render.com/llms.txt` i `llms-full.txt` ✓; GA MCP server (`mcp.render.com`) ale **nie może wyzwolić deployu** — krytyczna luka dla agentów; free tier śpi po 15 min (cold start ~1 min); $7/mc Starter dla always-on.

**Fly.io**: Kontenery Firecracker, pełna obsługa WebSocket, persistent process; brak `llms.txt`; rollback = `fly deploy --image <prev-image>` (niestandardowy); MCP server `fly mcp server` oznaczony jako **experimental**; brak free tier od 2024; ~$5-7/mc minimum.

### Platformy na krótkiej liście

#### 1. Cloudflare Workers + Pages (Zalecana)

Wygrywa kombinacją: najwyższy wynik 5/5 kryteriów, zgodność z istniejącym wskazaniem w `tech-stack.md`, bezpłatny tier 100k req/dzień bez limitu czasowego, oraz najlepsza platforma pod kątem AI-agent operations dzięki 5 GA MCP serverom. Brak doświadczenia z platformą (odpowiedź z wywiadu) nie jest barierą — wrangler CLI jest dobrze udokumentowane, a MCP Documentation Server umożliwia agentowi samodzielne dotarcie do aktualnej dokumentacji.

#### 2. Vercel

Niezaprzeczalnie najlepszy DX dla Next.js — App Router działa natywnie bez adaptera. Hobby plan darmowy i pokrywa skalę MVP. Główna wada dla tego projektu: ograniczenie tylko-niekomercyjne Hobby planu (jeśli projekt kiedykolwiek będzie monetyzowany, wymagany Pro $20/mc), log retention 1h na Hobby utrudnia debugowanie, oraz MCP Server jest w stanie beta. Silny fallback gdyby Cloudflare okazał się problematyczny.

#### 3. Railway

Przewidywalne $5/mc, trwały Node.js bez adaptera, `llms.txt` opublikowane, dobry DX dla solo developera. Traci na tle liderów przez: rollback tylko dashboard, MCP "work in progress", znany 502 cold-start bug, oraz fakt że Railway само porzuciło Next.js na własnej platformie (nieoficjalny sygnał ryzyka wsparcia).

## Weryfikacja krzyżowa anty-uprzedzeniowa: Cloudflare Workers + Pages

### Adwokat diabła — Słabe strony

1. **Deprecated adapter w tech-stack.md**: `@cloudflare/next-on-pages` wymieniony w `tech-stack.md` jest deprecated (ostatnia wersja 8 miesięcy temu). Migracja na `@opennextjs/cloudflare` to nieplanowany koszt konfiguracyjny na starcie 3-tygodniowego sprintu.
2. **Limit 3 MiB na free tier jest realny**: Next.js + Auth.js + Supabase-js przekracza limit 3 MiB (compressed). W praktyce może być potrzebny plan $5/mc od pierwszego dnia — niespodziewany koszt.
3. **Node.js API gaps w Workers runtime**: Mimo że OpenNext celuje w Node.js runtime, niektóre npm pakiety (natywne moduły, specyficzne operacje crypto, Pino logger) mogą nie działać. Problemy ujawnią się podczas developmentu, nie przed nim.
4. **AUTH_URL — nieoczywisty gotcha**: Auth.js wymaga jawnego `AUTH_URL` w Cloudflare Workers — runtime nie eksponuje URL żądania tak jak Node.js. Tego nie ma w quickstartach Auth.js, pojawia się tylko w community threads.
5. **Brak pinowania regionu na free**: Worker może być wykonywany z US datacenter zamiast EU, dodając 100–200ms do połączeń z Supabase dla polskich użytkowników. Region pinning wymaga planu Enterprise.

### Pre-Mortem — Jak mogło się nie udać

`tech-stack.md` wskazywał `@cloudflare/next-on-pages`, ale bootstrapping ujawnił deprecated adapter — przełączenie na `@opennextjs/cloudflare` kosztowało 2–3 dni debugowania w tygodniowym sprincie. Bundle przekroczył limit 3 MiB już na staging, wymuszając nagłe przejście na plan $5/mc i zmianę konfiguracji wranglera. Konfiguracja Auth.js w środowisku Workers wymagała nieoczywistych obejść dla `AUTH_URL`, ciasteczek na `.workers.dev` i `AUTH_TRUST_HOST` — wszystko znalezione w community threads, nie w dokumentacji. Kiedy walidator diagnostyczny zwracał niepoprawne wyniki na produkcji, `wrangler tail` gubił zdarzenia pod obciążeniem; konfiguracja Observability MCP Server wymagała osobnego OAuth flow. Łącznie: migracja adaptera + bundle limit + auth edge-cases + konfiguracja logowania skonsumowały prawie tydzień z 3-tygodniowego okna MVP.

### Nieznane niewiadome

- **OpenNext vs Next.js 16**: Adapter opisuje wsparcie Next.js 14–16, ale AGENTS.md wskazuje "Next.js 16" — konkretne funkcje App Router Next.js 16 warto zweryfikować w changelog OpenNext przed deployem.
- **Pages Functions vs Workers — nieintuicyjna różnica**: Deploy SSR na Workers (zalecane przez OpenNext) ma inne limity i konfigurację niż Pages Functions. Dokumentacja marketingowa nie wyróżnia tej różnicy wyraźnie.
- **`NEXT_PUBLIC_*` vars baked at build time**: Na Cloudflare wszystkie `NEXT_PUBLIC_*` muszą być dostępne jako zmienne środowiskowe CI w czasie buildu — nie jako Workers Secrets runtime. Deweloperzy przyzwyczajeni do Vercel są zaskoczeni tym zachowaniem.
- **Gradual rollout jest płatny**: Funkcja `wrangler versions deploy <id>:10%` wymaga Workers for Platforms — nie dostępne na Workers free tier mimo że dokumentacja to opisuje jako standardową funkcję.
- **Preview URL protection**: Cloudflare nie chroni preview deploymentów przez JWT (jak Vercel) — wymagana ręczna konfiguracja Cloudflare Access lub pominięcie ochrony preview.

## Historia operacyjna

- **Wdrożenia podglądowe**: Branch deployments przez `wrangler deploy --env preview` lub przez GitHub Actions workflow dostarczony przez OpenNext template. Preview URL ma format `<branch>.<project>.pages.dev` (dla Pages) lub subdomena na Workers. Brak automatycznej JWT ochrony preview — wymaga Cloudflare Access lub świadomej decyzji o pozostawieniu publicznych.
- **Sekrety**: Zmienne środowiskowe w Cloudflare Dashboard (`Pages > Settings > Environment variables`) lub przez `wrangler secret put <KEY>`. Wartości runtime-only (DB passwords, AUTH_SECRET) ustawiać jako Secrets; `NEXT_PUBLIC_*` jako Environment Variables dostępne w czasie buildu. Rotacja: `wrangler secret put` na nową wartość, nowy deploy aktywuje zmianę.
- **Wycofywanie**: `wrangler rollback` (domyślnie do poprzedniej wersji) lub `wrangler versions deploy <prev-version-id>:100%`. Typowy czas: <1 min dla Workers. Uwaga: rollback deploymentu nie cofa migracji bazy danych w Supabase — rollback kodu i rollback danych to dwie niezależne operacje.
- **Zatwierdzanie**: Agent może wykonać bez nadzoru: `wrangler deploy`, `wrangler rollback`, `wrangler tail`, `wrangler secret put`. Wymaga człowieka: zmiana billing tier, konfiguracja domeny custom, konfiguracja Cloudflare Access, modyfikacja głównych Workers Routes.
- **Logi**: `wrangler tail` (live streaming, console + exceptions); strukturowane logi przez Observability MCP Server (`observability.mcp.cloudflare.com/mcp`, GA, OAuth) — umożliwia Claude Code bezpośredni dostęp do logów bez terminala.

## Rejestr ryzyka

| Ryzyko | Źródło | Prawdopodobieństwo | Wpływ | Łagodzenie |
|---|---|---|---|---|
| Deprecated adapter `@cloudflare/next-on-pages` w tech-stack.md | Wynik badań | **Wysoki** — dotyczy każdego nowego deployu | **Wysoki** — blokuje start projektu | Zaktualizuj `tech-stack.md` do `@opennextjs/cloudflare` przed pierwszym deployem; sprawdź kompatybilność z Next.js 16 w changelog |
| Bundle > 3 MiB na free tier | Adwokat diabła | **Wysoki** — typowy Next.js + Auth.js + Supabase | Średni — wymusza $5/mc od startu | Zaplanuj $5/mc jako bazowy koszt MVP; `wrangler build --minify` i tree-shaking zmniejszają bundle |
| AUTH_URL nie ustawiony w Workers | Nieznane niewiadome | **Wysoki** — dotyczy każdego projektu Auth.js na Workers | **Wysoki** — auth nie działa bez tego | Ustaw `AUTH_URL=https://<twoja-domena.workers.dev>` i `AUTH_TRUST_HOST=true` przed testem logowania |
| `NEXT_PUBLIC_*` nie dostępne w runtime | Nieznane niewiadome | Średni — odkrywany przy pierwszym CI | Średni — build bez tych zmiennych daje niekompletny output | Dodaj `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` jako build-time env vars w wrangler.toml i CI |
| Opóźnienie Cloudflare → Supabase dla EU | Adwokat diabła | Średni — zależy od lokalizacji datacenter | Niski-Średni — latency widoczna przy >200ms | Wybierz Supabase region EU West (Frankfurt lub Amsterdam); monitoruj latency przez Observability MCP |
| Node Middleware (Next.js 15.2+) niesupportowane | Wynik badań | Niski — projekt nie używa Middleware MVP | Wysoki — gdyby użyto | Używaj Route Handlers zamiast Middleware dla logiki auth; sprawdź OpenNext changelog przed każdym upgrade Next.js |
| Preview URLs publicznie dostępne | Nieznane niewiadome | Niski — MVP z małą ekspozycją | Niski | Konfiguruj Cloudflare Access dla preview lub akceptuj i nie wdrażaj wrażliwych danych w preview |

## Rozpoczęcie pracy

1. **Zaktualizuj tech-stack.md i zainstaluj właściwy adapter**:
   ```bash
   npm install @opennextjs/cloudflare
   # Usuń @cloudflare/next-on-pages jeśli zainstalowany
   npm uninstall @cloudflare/next-on-pages
   ```

2. **Zaloguj się i utwórz projekt Cloudflare** (wymagane konto cloudflare.com):
   ```bash
   npx wrangler login
   npx wrangler pages project create osce-triager
   ```

3. **Skonfiguruj `wrangler.toml`** w katalogu głównym (OpenNext tworzy go przy `npx opennextjs-cloudflare`):
   ```bash
   npx opennextjs-cloudflare
   ```
   Ustaw `name = "osce-triager"` i `compatibility_date` na aktualną datę.

4. **Ustaw wymagane sekrety i zmienne środowiskowe**:
   ```bash
   # Secrets (runtime)
   npx wrangler secret put AUTH_SECRET
   npx wrangler secret put DATABASE_URL

   # Build-time env vars (dodaj do wrangler.toml [vars])
   # NEXT_PUBLIC_SUPABASE_URL = "https://xxx.supabase.co"
   # NEXT_PUBLIC_SUPABASE_ANON_KEY = "..."
   # AUTH_URL = "https://osce-triager.workers.dev"
   # AUTH_TRUST_HOST = "true"
   ```

5. **Wykonaj pierwszy deploy i zweryfikuj**:
   ```bash
   npm run build && npx wrangler deploy
   # Sprawdź logi: npx wrangler tail
   ```

## Poza zakresem

W niniejszych badaniach nie oceniano następujących kwestii:
- Konfiguracja obrazu Docker
- Konfiguracja potoku CI/CD (GitHub Actions)
- Architektura na skalę produkcyjną (wiele regionów, HA, DR)
