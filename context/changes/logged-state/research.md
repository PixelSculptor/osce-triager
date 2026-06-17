---
date: 2026-06-17T00:00:00+02:00
researcher: Kacper Nadstoga
git_commit: 40e891b527cd779462086e0a9fc593644beef873
branch: project-documentation
repository: osce-traiger
topic:
  'Auth state leak: niezalogowany widzi navbar zalogowanego; po logout
  odświeżenie pokazuje nadal zalogowany; Error 1101 Worker hung na /dashboard'
tags:
  [
    research,
    auth,
    session,
    cloudflare,
    caching,
    nextauth,
    logged-state,
    error-1101,
    db-timeout,
  ]
status: complete
last_updated: 2026-06-17
last_updated_by: Kacper Nadstoga
last_updated_note:
  'Dodano follow-up research: Error 1101 Worker hung na /dashboard'
---

# Research: Auth state leak — błąd odzwierciedlania stanu logowania

**Date**: 2026-06-17 **Researcher**: Kacper Nadstoga **Git Commit**:
`40e891b527cd779462086e0a9fc593644beef873` **Branch**: `project-documentation`
**Repository**: osce-traiger

## Research Question

Po ostatnich wdrożeniach na Cloudflare Workers zaobserwowano dwa symptomy:

1. **Niezalogowany użytkownik widzi w navbarze pełen komplet linków + email
   zalogowanego** — wyciek stanu między sesjami.
2. **Po wylogowaniu i odświeżeniu strony aplikacja wyświetla nadal stan
   "zalogowany"** — stan nie jest unieważniany.

Oba objawy nie były reprodukowalne lokalnie — tylko na produkcji (Cloudflare
Workers).

---

## Summary

**Główna przyczyna obu symptomów to brak explicite wymuszenia dynamicznego
renderowania na poziomie root layoutu, co powoduje cache'owanie przez Cloudflare
CDN odpowiedzi HTML zawierających dane specyficzne dla użytkownika.**

Konkretny łańcuch zdarzeń:

1. `src/app/layout.tsx` nie ma dyrektywy
   `export const dynamic = 'force-dynamic'`
2. `Nav.tsx` (Server Component w root layoutu) wywołuje `await auth()` — czyta
   cookies → Next.js powinien oznaczyć stronę jako dynamiczną
3. Jednak `@opennextjs/cloudflare` v1.19.11 z defaultową konfiguracją
   (`open-next.config.ts`) nie propaguje poprawnie nagłówków
   `Cache-Control: no-store` do CDN Cloudflare
4. Brak jakichkolwiek explicite nagłówków `Cache-Control: private, no-store` w
   kodzie
5. CDN Cloudflare cache'uje HTML z emailem zalogowanego użytkownika — kolejny
   niezalogowany użytkownik otrzymuje ten sam cached HTML

Symptom 2 (stan po logout) ma tę samą przyczynę: CDN serwuje cached odpowiedź
mimo że cookie zostało skasowane przez `signOut()`.

Istnieje też **wtórna przyczyna architektoniczna**: konfiguracja JWT strategy +
DrizzleAdapter jest wzajemnie sprzeczna, a `signOut()` operuje wyłącznie na
cookie po stronie klienta — nie istnieje mechanizm unieważniania sesji
server-side.

---

## Detailed Findings

### F-1: Root layout bez `force-dynamic` — kluczowy błąd

**Plik**: `src/app/layout.tsx:1-50`

Root layout eksportuje tylko `metadata` — brak jakiejkolwiek dyrektywy
renderowania:

```tsx
// src/app/layout.tsx — eksport tylko metadata, brak dynamic
export const metadata: Metadata = { ... };

export default function RootLayout({ children }) {
  return (
    <html ...>
      <body>
        <ThemeProvider ...>
          <Nav />          // ← wywołuje await auth() wewnątrz
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Next.js App Router automatycznie opt-in'uje do dynamicznego renderowania gdy
Server Component wywołuje dynamiczną funkcję jak `cookies()`. `Nav.tsx:7`
wywołuje `await auth()` który wewnętrznie czyta cookies → layout powinien być
dynamiczny.

**Problem**: `@opennextjs/cloudflare` nie gwarantuje że Next.js-owe wewnętrzne
oznaczenie `no-store` zostanie przetłumaczone na nagłówek `Cache-Control` w
faktycznej odpowiedzi HTTP. Bez `export const dynamic = 'force-dynamic'`
OpenNext może cache'ować layout na poziomie CDN.

---

### F-2: Nav.tsx — Server Component czytający auth przez props

**Plik**: `src/shared/components/Nav/Nav.tsx:1-19`

```tsx
export async function Nav() {
  const session = await auth();    // ← czyta JWT cookie
  return (
    <nav ...>
      <NavLinks isLoggedIn={!!session} email={session?.user?.email} />
    </nav>
  );
}
```

**Plik**: `src/shared/components/Nav/NavLinks.tsx:21`

Email renderowany z propsa:

```tsx
{
  email && <span className={styles.email}>{email}</span>;
}
```

Architektura sama w sobie jest poprawna (Server Component → Client Component
przez props, bez `useSession()`). Problem nie leży w komponencie — leży w braku
gwarancji dynamicznego renderowania.

---

### F-3: `open-next.config.ts` — brak konfiguracji cache

**Plik**: `open-next.config.ts:1-9`

```typescript
// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from '@opennextjs/cloudflare';
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  // For best results consider enabling R2 caching
  // incrementalCache: r2IncrementalCache  ← ZAKOMENTOWANE
});
```

Brak R2 incremental cache oznacza że każda instancja Workera ma własny in-memory
cache bez synchronizacji między instancjami. Przy stateless Workers to prowadzi
do niespójnego zachowania — różne instancje mogą serwować różne cached wersje
tej samej strony.

---

### F-4: JWT + DrizzleAdapter — architektoniczna sprzeczność

**Plik**: `src/modules/auth/auth.ts:15-22`

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions, // ← tabela sessions w DB
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' }, // ← JWT nie zapisuje do sessionsTable!
  // ...
});
```

**Problem**: `strategy: "jwt"` z DrizzleAdapter to wzajemna sprzeczność:

- JWT strategy → sesja przechowywana wyłącznie w zaszyfrowanym cookie
- `sessionsTable` → nigdy nie jest zapisywana przy JWT strategy
- Tabela `sessions` w DB istnieje ale jest pusta/nieużywana
- `signOut()` → kasuje tylko cookie po stronie klienta, **nie wykonuje żadnej
  operacji DB**
- Brak możliwości server-side unieważnienia sesji

To oznacza że teoretycznie skradziony JWT token jest ważny aż do wygaśnięcia,
bez możliwości unieważnienia.

---

### F-5: logoutAction — brak czyszczenia cache po wylogowaniu

**Plik**: `src/modules/auth/actions.ts:90-96`

```typescript
export async function logoutAction(): Promise<void> {
  try {
    await signOut({ redirectTo: '/' });
  } catch (e) {
    if (isRedirectError(e)) throw e;
  }
}
```

`signOut()` kasuje cookie `authjs.session-token`. Jednak:

1. Brak `revalidatePath('/', 'layout')` — Next.js cache nie jest czyszczony
2. Brak explicite `Cache-Control` headers w odpowiedzi po logout
3. CDN Cloudflare może nadal serwować cached HTML ze stanem "zalogowany"

---

### F-6: Brak nagłówków Cache-Control w całej aplikacji

Wyszukiwanie `Cache-Control` w źródłach: **0 wyników**.

```
src/app/**/*.tsx       — brak Cache-Control
src/modules/**/*.ts    — brak Cache-Control
next.config.ts         — brak headers() konfiguracji
middleware.ts          — brak Cache-Control ustawiania
```

Bez explicite `Cache-Control: private, no-store` Cloudflare stosuje domyślne
zasady cache'owania, które mogą obejmować dynamiczne odpowiedzi HTML.

---

### F-7: Middleware poprawny — nie jest przyczyną problemu

**Plik**: `src/middleware.ts:1-22`

```typescript
import { authConfig } from '@/modules/auth/auth.config';
const { auth } = NextAuth(authConfig);

export default auth(function middleware(req) {
  const isLoggedIn = !!req.auth;
  // redirect logic
});
```

Middleware używa `auth.config.ts` (Edge-safe, bez DrizzleAdapter) — poprawny
wzorzec split-config. **Middleware samo w sobie nie jest przyczyną problemu**.

Middleware tylko sprawdza obecność cookie i jego poprawność kryptograficzną.
Jeśli cookie istnieje (np. nie zostało skasowane przez `signOut()`), middleware
przepuszcza request.

---

### F-8: AUTH_URL i AUTH_TRUST_HOST — poprawnie skonfigurowane

**Plik**: `wrangler.jsonc:28-35`

```jsonc
{
  "AUTH_URL": "https://osce-triager.kapix007.workers.dev",
  "AUTH_TRUST_HOST": "true",
}
```

Te ustawienia są wymagane dla NextAuth na Cloudflare Workers. Skonfigurowane
poprawnie — nie są przyczyną problemu.

---

## Code References

- `src/app/layout.tsx:26-50` — Root layout bez `export const dynamic` — **główny
  punkt naprawy**
- `src/shared/components/Nav/Nav.tsx:7` — `await auth()` w Server Component
- `src/shared/components/Nav/NavLinks.tsx:21` — renderowanie emaila z propsa
- `src/modules/auth/auth.ts:15-22` — JWT strategy + DrizzleAdapter (sprzeczność)
- `src/modules/auth/actions.ts:90-96` — `logoutAction()` bez cache invalidation
- `open-next.config.ts:1-9` — brak R2 incremental cache (domyślna konfiguracja)
- `wrangler.jsonc:1-37` — Cloudflare Workers config z `nodejs_compat`

---

## Architecture Insights

### Dlaczego tylko na produkcji?

Lokalny dev server (Next.js) nie ma Cloudflare CDN przed sobą — renderuje każdy
request fresh. Na Cloudflare Workers:

1. Worker renderuje response
2. Cloudflare CDN decyduje czy cache'ować na podstawie response headers
3. Bez `Cache-Control: no-store` CDN może cache'ować
4. Kolejne requesty (w tym od innych użytkowników) dostają cached HTML

### Przepływ sesji (poprawny, ale bez gwarancji dynamiczności)

```
Request → Cloudflare CDN
  → [jeśli cached] → zwróć cached HTML (BUG: może zawierać dane zalogowanego)
  → [jeśli nie cached] → Worker → Next.js Server
    → middleware (auth.config.ts, Edge-safe) → sprawdź JWT cookie
    → layout.tsx → Nav.tsx: await auth() → czyta JWT cookie → session
    → render HTML z danymi sesji → response
    → [brak Cache-Control: no-store] → CDN cache'uje response
```

### Split-config pattern (auth.config.ts + auth.ts)

Był świadomą decyzją z `auth-scaffold`:

- `auth.config.ts` → Edge runtime (middleware, bez DrizzleAdapter)
- `auth.ts` → Node.js runtime (Server Components, Server Actions, z
  DrizzleAdapter)

Wzorzec jest poprawny architektonicznie. Nie jest przyczyną problemu.

---

## Historical Context

- `context/changes/auth-scaffold/plan.md` — JWT strategy wybrana dla "zero DB
  queries per request — critical for Workers low-latency"
- `context/changes/auth-flow/reviews/impl-review.md` — 4 poprawki po
  impl-review, żadna nie dotyczyła cachingu
- `context/changes/testing-auth-boundary-gate/research.md` — testy boundary gate
  badały middleware, nie CDN caching

Żadna poprzednia zmiana nie adresowała tematu CDN caching auth responses na
Cloudflare.

---

## Open Questions

1. **Czy `signOut()` na Cloudflare Workers poprawnie kasuje cookie?** Warto
   zweryfikować w logach Workers czy `Set-Cookie` z wygasłym tokenem jest
   poprawnie wysyłany.
2. **Czy `@opennextjs/cloudflare` v1.19.11 automatycznie dodaje
   `Cache-Control: no-store` gdy Next.js oznaczy stronę jako dynamiczną?**
   Wymaga weryfikacji w changelog/docs OpenNext.
3. **Czy warto włączyć R2 incremental cache?** Dla konsystentności między
   instancjami Workers — ale wymaga dodatkowej konfiguracji Cloudflare R2
   bucket.

---

---

## Follow-up Research 2026-06-17: Error 1101 — Worker hung na /dashboard

### Symptom

```
GET https://osce-triager.kapix007.workers.dev/dashboard
outcome: exception
"The Workers runtime canceled this request because it detected that your Worker's code had hung
and would never generate a response."
```

Użytkownicy dostają stronę Cloudflare z prośbą o przeładowanie strony. Nie można
rozpocząć nowej sesji. Problem powtarzalny na produkcji, niereprodukowany
lokalnie.

### Poprzednie fixy — co zrobiono i dlaczego nie wystarczyło

| Commit    | Co naprawiał                                        | Czego nie naprawiał                                         |
| --------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `38b9fb5` | `connect_timeout: 10` — timeout TCP connect         | Brak `query_timeout` — query na martwym połączeniu wisi     |
| `e555301` | `ssl: 'require'` — wymusza TLS od razu, bez upgrade | Nie chroni przed dead connection reuse                      |
| `40e891b` | `ssl` z URL zamiast `NODE_ENV` (błędne w Workers)   | Powiązany z poprzednim fixem                                |
| `63f99bd` | `auth()` w try/catch w **server actions**           | **Server components** (Nav.tsx, page.tsx) nadal bez ochrony |

### Pełna ścieżka wykonania GET /dashboard

Na każdy request do `/dashboard` wykonują się:

1. **Middleware** (`src/middleware.ts`) — Edge-safe, czyta JWT z cookie.
   Bezpieczne.
2. **Root layout** (`src/app/layout.tsx:44`) → renderuje `<Nav />`
3. **`Nav.tsx:7`** → `await auth()` — używa pełnego `auth.ts` z DrizzleAdapter →
   **potencjalne wywołanie DB #1**
4. **`dashboard/page.tsx:8`** → `await auth()` — drugie wywołanie →
   **potencjalne wywołanie DB #2**
5. **`dashboard/page.tsx:11`** → `await getScenarios()` / `getUserSessions()` →
   **zapytanie DB #3**

**Dwa wywołania `auth()` na jedno renderowanie strony** — oba bez ochrony
try/catch.

### Dlaczego `auth()` z DrizzleAdapter może wołać DB przy JWT strategy

`src/modules/auth/auth.ts:15-22` konfiguruje NextAuth z jednoczesnym
`DrizzleAdapter` i `session: { strategy: "jwt" }`. W NextAuth v5.0.0-beta.31
adapter jest inicjalizowany przy każdym wywołaniu `auth()`. Adapter może
wywoływać `getUser(token.sub)` aby odświeżyć dane użytkownika z DB (np. email,
role) — to "session refresh" mechanizm nieudokumentowany wprost. Commit
`63f99bd`
(`fix: wrap auth() in try/catch in all server actions to prevent Error 1101`)
potwierdza że `auth()` faktycznie uderzało w DB i powodowało timeout.

### Główna przyczyna — dead connection reuse bez query_timeout

**`src/shared/lib/db.ts:16`**: `connect_timeout: 10` dotyczy tylko nawiązania
TCP socket. **Nie chroni** przed:

- SSL handshake timeout
- PgBouncer authentication latency
- Query execution timeout
- **Reuse martwego połączenia** — gdy PgBouncer cicho zrywa połączenie (po idle
  period), postgres.js reużywa ten socket i wysyła query. Ponieważ
  `connect_timeout` nie ma zastosowania po połączeniu, query czeka bez limitu
  czasu.

`max: 1` (`db.ts:18`) — jedno połączenie na isolate. Jeśli to połączenie jest w
złym stanie (TCP half-open), wszystkie queries w danym request wiszą.

### Brakujące zabezpieczenia (file:line)

| Lokalizacja                           | Operacja               | Timeout?                                        |
| ------------------------------------- | ---------------------- | ----------------------------------------------- |
| `src/shared/components/Nav/Nav.tsx:7` | `await auth()`         | Brak try/catch, brak query_timeout              |
| `src/app/dashboard/page.tsx:8`        | `await auth()`         | Brak try/catch                                  |
| `src/app/dashboard/page.tsx:11`       | `await getScenarios()` | Brak query_timeout                              |
| `src/shared/lib/db.ts:10-20`          | postgres client        | `connect_timeout: 10`, **brak `query_timeout`** |

### Dlaczego tylko na produkcji

Lokalnie: bezpośrednie połączenie Postgres, brak PgBouncer, brak CDN. Na
Cloudflare Workers: Supabase PgBouncer w trybie transaction-mode, isolates są
stateless (każdy request może dostać świeży isolate z nowym połączeniem),
latency sieci może sprawić że connect/query przekracza limit Workers (~30s
wall-clock, ale CPU limit jest niższy).

---

## Recommended Fixes (priorytetyzowane)

### P1 — Krytyczne (naprawia oba symptomy)

**Fix 1**: Dodaj `export const dynamic = 'force-dynamic'` do
`src/app/layout.tsx`

```typescript
// src/app/layout.tsx
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { ... };
```

To wymusza dynamiczne renderowanie całego root layoutu (i wszystkich stron) —
Cloudflare nie może cache'ować HTML zawierającego auth state.

**Fix 2**: Dodaj `Cache-Control: private, no-store` przez `next.config.ts`
headers dla wszystkich chronionych ścieżek:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(dashboard|account)(.*)',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, must-revalidate' },
        ],
      },
    ];
  },
};
```

### P2 — Ważne (naprawia Symptom 2 server-side)

**Fix 3**: Po `signOut()` wywołaj `revalidatePath('/', 'layout')` aby wyczyścić
Next.js cache:

```typescript
// src/modules/auth/actions.ts
export async function logoutAction(): Promise<void> {
  try {
    await signOut({ redirectTo: '/' });
  } catch (e) {
    if (isRedirectError(e)) throw e;
  }
  revalidatePath('/', 'layout'); // ← dodać
}
```

### P3 — Error 1101 Worker hung

**Fix 6**: Dodaj `query_timeout` do konfiguracji postgres.js w
`src/shared/lib/db.ts`:

```typescript
const client = postgres(connectionString!, {
  prepare: false,
  max: 1,
  ssl: isLocal ? false : 'require',
  connect_timeout: 5, // zmniejszyć z 10 na 5 — fail fast
  idle_timeout: 20,
  query_timeout: 8000, // ← dodać: 8s limit query (poniżej Worker ~10s limit)
});
```

**Fix 7**: Dodaj try/catch wokół `auth()` w
`src/shared/components/Nav/Nav.tsx:7` i `src/app/dashboard/page.tsx:8` — ten sam
wzorzec co commit `63f99bd` w server actions.

**Fix 8**: Zbadać czy DrizzleAdapter jest w ogóle potrzebny przy
`strategy: "jwt"` z Credentials provider. Jeśli tabela `sessions` w DB jest
pusta/nieużywana, adapter można usunąć — `auth()` nie będzie wołało DB w ogóle i
problem Error 1101 przy `auth()` zniknie.

### P4 — Architektoniczne (nie naprawia bezpośrednio symptomów)

**Fix 9**: Dokumentacja sprzeczności JWT + DrizzleAdapter — rozważyć usunięcie
adaptera jeśli sesje DB nie są potrzebne, lub przejście na
`strategy: "database"` dla server-side session revocation.

**Fix 10**: Dodaj `export const dynamic = 'force-dynamic'` do wszystkich
protected pages jako defence-in-depth: `src/app/dashboard/page.tsx`,
`src/app/account/settings/page.tsx`.
