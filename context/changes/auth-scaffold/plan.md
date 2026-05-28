# Auth.js Scaffold — Plan implementacji (F-01)

## Przegląd

Instalacja i konfiguracja Auth.js (next-auth@beta) z adapterem Drizzle, strategią JWT, Credentials providerem (e-mail+hasło) i middleware chroniącym trasy — w Cloudflare Workers runtime. F-01 tworzy fundament sesji i tabel użytkowników wymagany przez S-01 (UI auth) i F-02 (schemat domenowy z FK do `user.id`).

## Analiza stanu obecnego

Scaffold Next.js 16 App Router istnieje (`src/app/layout.tsx`, `src/app/page.tsx`). `wrangler.jsonc` ma już ustawione `AUTH_URL` i `AUTH_TRUST_HOST` jako zmienne build-time (linie 7-18). `AUTH_SECRET` jest w `.env.local` i `.dev.vars` — ale nie jako wrangler secret dla produkcji. Supabase local dev skonfigurowany (`config.toml`), brak tabel w bazie (`schema_paths = []`).

Czego brakuje: pakiety `next-auth@beta`, `@auth/drizzle-adapter`, `drizzle-orm`, `postgres`, `bcryptjs`, `drizzle-kit`; pliki `src/shared/lib/schema.ts`, `src/shared/lib/db.ts`, `src/modules/auth/auth.ts`; handlery `/api/auth/[...nextauth]/route.ts`, `/api/auth/register/route.ts`; `src/middleware.ts`; migracja SQL i katalog `drizzle/migrations/`.

## Pożądany stan końcowy

`POST /api/auth/register` tworzy użytkownika z zahaszowanym hasłem w lokalnej bazie Supabase. Logowanie przez Auth.js credentials zwraca cookie JWT. Strona `/dashboard` jest niedostępna bez sesji (middleware przekierowuje na `/`) i wyświetla `session.user.email` po zalogowaniu. `npm run typecheck`, `npm run lint` i `npm run build` przechodzą czysto. Identyczny flow działa na `npm run preview` (Workers runtime, localhost:8787).

### Kluczowe odkrycia

- `wrangler.jsonc:7-18` — `AUTH_URL` i `AUTH_TRUST_HOST` już ustawione jako zmienne build-time; `AUTH_SECRET` musi być ustawiony jako wrangler secret przed pierwszym deployem produkcyjnym
- `.env.local:8-10` — `AUTH_SECRET` wygenerowany, `AUTH_URL=http://localhost:3000`; `.dev.vars:5-7` — analogicznie dla Workers dev (localhost:8787)
- `supabase/config.toml` — lokalny Postgres na porcie 54322, email confirmations wyłączone
- `AGENTS.md` — struktura: `src/shared/lib/` dla shared utility, `src/modules/<feature>/` dla feature logic; pliki ts lowercase

## Czego NIE robimy

- UI logowania i rejestracji — S-01
- Tabele domenowe (`scenarios`, `diagnostic_tests`, `session_results`) — F-02
- Weryfikacja adresu e-mail
- Odzyskiwanie hasła
- OAuth providers
- Deploy produkcyjny — F-03

## Podejście do implementacji

Trzy fazy w kolejności zależności: (1) pakiety + schemat DB + klient + migracja lokalnie; (2) konfiguracja Auth.js + handlery + middleware; (3) strona weryfikacyjna + test end-to-end. Używamy postgres.js jako driver, bo `nodejs_compat` jest już ustawiony w `wrangler.jsonc` — TCP działa w Workers. Strategia JWT eliminuje zapytania DB przy każdym request. Schemat Auth.js rozszerzamy o kolumnę `hashed_password` w tabeli `user` zamiast osobnej tabeli — prostszy model, mniej JOINów przy logowaniu.

## Krytyczne szczegóły implementacji

**Driver postgres.js:** musi być tworzony z opcją `{ prepare: false }` — Supabase connection pooler (PgBouncer transaction mode) nie wspiera prepared statements; pominięcie tej opcji powoduje błąd `prepared statement already exists` przy współbieżnych requestach.

```typescript
// src/shared/lib/db.ts — kontrakt klienta
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })
```

**Ładowanie DATABASE_URL dla drizzle-kit:** drizzle-kit nie czyta `.env.local` automatycznie. `drizzle.config.ts` musi ładować env ręcznie: `import { config } from "dotenv"; config({ path: ".env.local" })` — lub `DATABASE_URL` musi być wyeksportowane przed uruchomieniem komendy.

**Lokalizacja middleware:** plik to `src/middleware.ts` (wewnątrz katalogu `src/`, nie w root projektu).

**Auth.js v5 Credentials + JWT:** adapter Drizzle NIE jest wywoływany przy logowaniu przez Credentials — `createUser` adaptera nie jest wołany. Użytkownik musi być stworzony przez własny endpoint `/api/auth/register` przed pierwszym logowaniem.

---

## Faza 1: Zależności, schemat i klient DB

### Przegląd

Instalacja pakietów, stworzenie klienta Drizzle i schematu Auth.js z rozszerzeniem `hashed_password`, wygenerowanie i zaaplikowanie migracji do lokalnego Supabase.

### Wymagane zmiany

#### 1. Instalacja pakietów

**Plik:** `package.json` (modyfikacja przez npm install)

**Cel:** Dodanie next-auth@beta i wszystkich wymaganych zależności; drizzle-kit jako devDependency do zarządzania migracjami.

**Kontrakt:**
```bash
npm install next-auth@beta @auth/drizzle-adapter drizzle-orm postgres bcryptjs
npm install -D drizzle-kit @types/bcryptjs dotenv
```

#### 2. Konfiguracja drizzle-kit

**Plik:** `drizzle.config.ts` (nowy, root projektu)

**Cel:** Wskazanie drizzle-kit gdzie znajdzie schemat i gdzie zapisywać wygenerowane migracje SQL.

**Kontrakt:** `defineConfig` z `schema: "./src/shared/lib/schema.ts"`, `out: "./drizzle/migrations"`, `dialect: "postgresql"`, `dbCredentials: { url: process.env.DATABASE_URL }`. Na górze pliku: `import { config } from "dotenv"; config({ path: ".env.local" })` do załadowania `DATABASE_URL`.

#### 3. Schemat Drizzle

**Plik:** `src/shared/lib/schema.ts` (nowy)

**Cel:** Definicja tabel Auth.js-compatible w PostgreSQL. Tabela `user` rozszerzona o `hashed_password` — jedyne odejście od domyślnego schematu adaptera. Eksportowane tabele będą używane przez F-02 jako FK target dla `session_results.user_id`.

**Kontrakt:** Eksportuje cztery pgTable: `users` (pgTable "user" — id, name, email, emailVerified, image + `hashedPassword: text("hashed_password")`), `accounts` (pgTable "account" — compound PK na [provider, providerAccountId]), `sessions` (pgTable "session"), `verificationTokens` (pgTable "verificationToken" — compound PK na [identifier, token]). Typy zgodne z `@auth/drizzle-adapter` dla PostgreSQL.

#### 4. Klient Drizzle

**Plik:** `src/shared/lib/db.ts` (nowy)

**Cel:** Singleton klienta bazy danych do użytku przez wszystkie moduły aplikacji (auth, F-02 queries).

**Kontrakt:** Tworzy klienta postgres.js z `{ prepare: false }`, opakowuje drizzle z importowanym schematem, eksportuje `db`. Patrz fragment powyżej w sekcji „Krytyczne szczegóły implementacji".

#### 5. Generowanie i aplikacja migracji

**Plik:** `drizzle/migrations/` (katalog tworzony przez drizzle-kit)

**Cel:** Wygenerowanie SQL tworzącego tabele Auth.js i zaaplikowanie do lokalnego Supabase.

**Kontrakt:** Sekwencja poleceń po stworzeniu schema.ts i db.ts:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run typecheck` przechodzi bez błędów po instalacji pakietów i stworzeniu schema.ts + db.ts
- `npx drizzle-kit generate` generuje plik SQL w `drizzle/migrations/`
- `npx drizzle-kit migrate` kończy się bez błędu (połączenie z lokalnym Supabase)

#### Weryfikacja ręczna

- Tabele `user`, `account`, `session`, `verificationToken` widoczne w lokalnym Supabase Studio (`http://127.0.0.1:54323`) lub przez `psql -U postgres -h 127.0.0.1 -p 54322 -d postgres -c "\dt"`

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich weryfikacji, zatrzymaj się na ręczne potwierdzenie przed przejściem do Fazy 2.

---

## Faza 2: Konfiguracja Auth.js i ochrona tras

### Przegląd

Stworzenie konfiguracji NextAuth z adapterem Drizzle i Credentials providerem, catch-all route handlera dla Auth.js, własnego endpointu rejestracji i middleware chroniącego trasy.

### Wymagane zmiany

#### 1. Konfiguracja Auth.js

**Plik:** `src/modules/auth/auth.ts` (nowy)

**Cel:** Centralna konfiguracja NextAuth — adapter Drizzle (dla spójności schematu i FK), JWT sessions, Credentials provider z weryfikacją bcryptjs. Eksportuje `{ handlers, auth, signIn, signOut }` do użytku przez route handler, middleware i Server Components.

**Kontrakt:** `NextAuth({ adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens }), session: { strategy: "jwt" }, providers: [Credentials({ credentials: { email, password }, authorize: async () => { query users by email → bcrypt.compare → return { id, email, name } or null } })] })`.

#### 2. Catch-all handler Auth.js

**Plik:** `src/app/api/auth/[...nextauth]/route.ts` (nowy)

**Cel:** Obsługa wszystkich żądań Auth.js API (`/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`, itd.).

**Kontrakt:** `export const { GET, POST } = handlers` gdzie `handlers` importowane z `@/modules/auth/auth`.

#### 3. Endpoint rejestracji

**Plik:** `src/app/api/auth/register/route.ts` (nowy)

**Cel:** Tworzenie konta e-mail+hasło — jedyna droga do stworzenia użytkownika w MVP (adapter nie woła `createUser` przy Credentials).

**Kontrakt:** `export async function POST(request: NextRequest)`: parsuje `{ email, password }` z body, zwraca 400 gdy brakuje pola, sprawdza duplikat przez `db.query.users.findFirst()`, zwraca 409 jeśli email istnieje, haszy hasło `bcrypt.hash(password, 12)`, wstawia rekord `{ id: crypto.randomUUID(), email, hashedPassword }` do `users`, zwraca `{ user: { id, email } }` ze statusem 201.

#### 4. Middleware ochrony tras

**Plik:** `src/middleware.ts` (nowy, w katalogu `src/`)

**Cel:** Blokuje dostęp do wszystkich tras bez sesji JWT; whitelist tras publicznych — nowe trasy prywatne są chronione automatycznie.

**Kontrakt:** Eksportuje `default auth(callback)` z `@/modules/auth/auth` gdzie callback: jeśli `!req.auth` i ścieżka nie startsWith żadnego z `["/", "/api/auth"]`, `return Response.redirect(new URL("/", req.url))`. Eksportuje też:
```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run typecheck` przechodzi
- `npm run lint` przechodzi
- `npm run build` przechodzi bez błędów

#### Weryfikacja ręczna

- `npm run dev` startuje bez błędów na localhost:3000
- `curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"password123"}'` zwraca `201` z `{ user: { id, email } }`
- Drugie wywołanie z tym samym e-mailem zwraca `409`
- Logowanie przez `POST /api/auth/callback/credentials` (lub przez przeglądarkę) ustawia cookie `next-auth.session-token`
- `GET /api/auth/session` zwraca dane sesji po zalogowaniu

**Uwaga implementacyjna**: Zatrzymaj się po fazie 2 na ręczne potwierdzenie przed przejściem do Fazy 3.

---

## Faza 3: Strona weryfikacyjna i test end-to-end

### Przegląd

Minimalna chroniona strona `/dashboard` jako dowód działającego flow auth. Ręczny test end-to-end przez przeglądarkę i wrangler dev (Workers runtime).

### Wymagane zmiany

#### 1. Chroniona strona dashboard

**Plik:** `src/app/dashboard/page.tsx` (nowy)

**Cel:** Minimalny Server Component weryfikujący działanie Auth.js — wyświetla e-mail sesji, co potwierdza poprawność JWT decode w Workers runtime.

**Kontrakt:** Async Server Component wywołujący `auth()` z `@/modules/auth/auth`; renderuje `session.user?.email` w dowolnym HTML. Middleware obsługuje przekierowanie niezalogowanych — własny `redirect()` w komponencie jest opcjonalny.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run typecheck` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna (dev — localhost:3000)

- Nawigacja na `http://localhost:3000/dashboard` bez sesji → przekierowanie na `/`
- Po rejestracji i zalogowaniu → `GET /dashboard` → widoczny e-mail użytkownika
- Wylogowanie → powrót na `/`, dashboard ponownie niedostępny

#### Weryfikacja ręczna (preview — localhost:8787)

- `npm run preview` startuje bez błędów
- Identyczny flow rejestracja → logowanie → dashboard działa na localhost:8787 (Workers runtime)
- Brak błędów w `wrangler tail` podczas flow

---

## Strategia testowania

### Kroki testowania ręcznego

1. `POST /api/auth/register {"email":"test@test.com","password":"password123"}` → 201
2. `POST /api/auth/register` (ten sam email) → 409
3. Logowanie przez przeglądarkę → cookie `next-auth.session-token` widoczny w DevTools
4. `GET /dashboard` z cookie → e-mail użytkownika
5. `GET /dashboard` bez cookie (prywatna przeglądarka) → redirect na `/`
6. Powtórzyć kroki 1-5 na `npm run preview` (localhost:8787)

### Brak testów jednostkowych

Brak frameworka testowego w projekcie na tym etapie — weryfikacja przez `npm run build` + testy manualne jest ścieżką F-01.

## Uwagi dotyczące migracji

- Lokalna: `npx drizzle-kit migrate` przez `DATABASE_URL` z `.env.local`
- Produkcyjna (po F-03 CI/CD): ta sama komenda z Supabase production pooler URL (port 6543, pgbouncer=true)
- Rollback: nie ma automatycznego — dodać odwrotną migrację SQL ręcznie jeśli potrzebna

## Referencje

- Roadmap F-01: `context/foundation/roadmap.md:60-72`
- Gotcha AUTH_URL: `context/foundation/infrastructure.md:66-67, 95`
- Risk register: `context/foundation/infrastructure.md:90-99`
- AGENTS.md — konwencje struktury katalogów i nazewnictwa plików

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Zależności, schemat i klient DB

#### Automatyczne

- [ ] 1.1 `npm run typecheck` przechodzi bez błędów po instalacji pakietów i stworzeniu schema.ts + db.ts
- [ ] 1.2 `npx drizzle-kit generate` generuje plik SQL w `drizzle/migrations/`
- [ ] 1.3 `npx drizzle-kit migrate` kończy się bez błędu

#### Ręczne

- [ ] 1.4 Tabele `user`, `account`, `session`, `verificationToken` widoczne w lokalnym Supabase

### Faza 2: Konfiguracja Auth.js i ochrona tras

#### Automatyczne

- [ ] 2.1 `npm run typecheck` przechodzi
- [ ] 2.2 `npm run lint` przechodzi
- [ ] 2.3 `npm run build` przechodzi bez błędów

#### Ręczne

- [ ] 2.4 `POST /api/auth/register` zwraca 201 z danymi użytkownika
- [ ] 2.5 Duplikat e-maila zwraca 409
- [ ] 2.6 Logowanie przez Auth.js credentials ustawia cookie sesji JWT
- [ ] 2.7 `GET /api/auth/session` zwraca dane sesji po zalogowaniu

### Faza 3: Strona weryfikacyjna i test end-to-end

#### Automatyczne

- [ ] 3.1 `npm run typecheck` przechodzi
- [ ] 3.2 `npm run build` przechodzi

#### Ręczne

- [ ] 3.3 `/dashboard` bez sesji → redirect na `/`
- [ ] 3.4 Po zalogowaniu `/dashboard` wyświetla e-mail użytkownika
- [ ] 3.5 Wylogowanie → dashboard ponownie niedostępny
- [ ] 3.6 Identyczny flow działa na `npm run preview` (Workers runtime, localhost:8787)
