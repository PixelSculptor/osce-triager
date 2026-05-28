# Auth.js Scaffold — Krótki plan (F-01)

> Pełny plan: `context/changes/auth-scaffold/plan.md`

## Co i dlaczego

Konfigurujemy fundament uwierzytelniania — Auth.js (next-auth@beta) z Drizzle ORM i Credentials providerem (e-mail+hasło) działający w Cloudflare Workers runtime. Bez tego nie można uruchomić S-01 (UI auth) ani F-02 (schemat domenowy z FK do tabeli użytkowników).

## Punkt wyjścia

Next.js 16 App Router scaffold istnieje. `wrangler.jsonc` ma już `AUTH_URL` i `AUTH_TRUST_HOST`; `AUTH_SECRET` jest w `.env.local`. Brakuje wszystkich warstw auth: pakietów, schematu DB, konfiguracji Auth.js, middleware i migracji.

## Pożądany stan końcowy

Student może zostać zarejestrowany przez `POST /api/auth/register`, zalogować się przez Credentials provider, a cookie JWT weryfikuje middleware — `/dashboard` przekierowuje niezalogowanych i wyświetla e-mail zalogowanego. Flow działa zarówno na `npm run dev` jak i `npm run preview` (Workers runtime).

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Strategia sesji | JWT (bezstanowe) | Zero zapytań DB per request — krytyczne dla Workers low-latency | Plan |
| Driver postgres | postgres.js + pooler | `nodejs_compat` już aktywny w wrangler.jsonc; natywny TCP w Workers | Plan |
| Haszowanie haseł | bcryptjs | Pure-JS — działa w Workers bez native modules | Plan |
| Pole hasła | `hashed_password` w tabeli `user` | Jeden rekord przy logowaniu zamiast JOINa z osobną tabelą | Plan |
| Rejestracja | Własny endpoint `/api/auth/register` | Auth.js v5 Credentials nie woła adaptera `createUser` automatycznie | Plan |
| Ochrona tras | Whitelist publicznych tras | Nowe trasy prywatne chronione automatycznie; zgodne z PRD izolacją dostępu | Plan |
| Struktura plików | `src/shared/lib/` + `src/modules/auth/` | Zgodne z AGENTS.md (shared utility vs feature logic) | Plan |
| Migracje | drizzle-kit generate + SQL zawsze | Jeden audytowalny git history dla schematu; drizzle zarządza tracking | Plan |

## Zakres

**W zakresie:** instalacja pakietów, schemat Drizzle (4 tabele Auth.js + hashed_password), klient DB, konfiguracja NextAuth, endpoint rejestracji API, middleware whitelist, strona `/dashboard` do weryfikacji, migracja lokalna.

**Poza zakresem:** UI logowania/rejestracji (S-01), tabele domenowe (F-02), deploy produkcyjny (F-03), weryfikacja e-mail, OAuth providers, odzyskiwanie hasła.

## Architektura / Podejście

```
src/shared/lib/
  schema.ts     ← tabele Auth.js (users + hashed_password, accounts, sessions, verificationTokens)
  db.ts         ← klient Drizzle (postgres.js, prepare: false)

src/modules/auth/
  auth.ts       ← NextAuth config (JWT + DrizzleAdapter + Credentials)

src/app/
  api/auth/[...nextauth]/route.ts  ← catch-all handler Auth.js
  api/auth/register/route.ts       ← rejestracja (bcrypt.hash → db.insert)
  dashboard/page.tsx               ← chroniona strona weryfikacyjna

src/middleware.ts   ← whitelist-based route guard (req.auth check)

drizzle.config.ts  ← konfiguracja drizzle-kit
drizzle/migrations/ ← wygenerowany SQL (drizzle-kit generate)
```

Klient DB (`db.ts`) jest współdzielony między auth i przyszłym F-02. Adapter Drizzle jest inicjowany z referencjami do niestandardowych tabel (ze względu na dodatkową kolumnę `hashed_password`).

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Zależności + schemat | Zainstalowane pakiety, tabele Auth.js w lokalnej DB, klient Drizzle | DATABASE_URL niedostępne dla drizzle-kit (trzeba załadować `.env.local`) |
| 2. Auth.js core | Endpoint rejestracji, logowanie JWT, middleware ochrony tras | `prepare: false` pominięte w db.ts → błędy PgBouncer pod obciążeniem |
| 3. Weryfikacja | Dashboard page, test end-to-end na dev i Workers runtime | Auth.js decode JWT może zachowywać się inaczej w Workers runtime |

**Wymagania wstępne:** Uruchomiony lokalny Supabase (`npx supabase start`); `DATABASE_URL` dostępne w środowisku dla drizzle-kit.

**Szacowany nakład pracy:** ~1-2 sesje w 3 fazach.

## Otwarte ryzyka i założenia

- `AUTH_SECRET` wymaga ręcznego `wrangler secret put AUTH_SECRET` przed pierwszym deployem produkcyjnym (nie jest automatycznie pobierany z `.env.local`)
- Supabase connection pooler na produkcji wymaga `?pgbouncer=true` lub `?sslmode=require` w DATABASE_URL — do weryfikacji przy F-03
- bcryptjs jest wolniejszy niż argon2 — akceptowalne dla MVP; przy bardzo dużej liczbie rejestracji może być wąskim gardłem

## Kryteria sukcesu (podsumowanie)

1. `npm run build` przechodzi — Auth.js + Drizzle kompilują się poprawnie z Next.js 16 i Workers runtime
2. Rejestracja → logowanie → `/dashboard` pokazuje e-mail — end-to-end flow działa na localhost
3. Ten sam flow działa na `npm run preview` (Workers runtime) — potwierdza kompatybilność z Cloudflare
