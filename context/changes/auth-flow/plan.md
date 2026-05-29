# Auth Flow — Plan implementacji (S-01)

## Przegląd

Budowa UI uwierzytelniania na gotowym fundamencie F-01: strony logowania (`/login`) i rejestracji (`/register`) z formularzami i field-level błędami, globalny pasek nawigacyjny świadomy sesji oraz przepisana strona główna (`/`) z CTA login/register. Po tej zmianie student może założyć konto, zalogować się, zobaczyć swój e-mail w nawigacji i wylogować się.

## Analiza stanu obecnego

F-01 jest kompletne: `signIn`, `signOut` z `src/modules/auth/auth.ts`, endpoint `POST /api/auth/register` (`src/app/api/auth/register/route.ts`), `src/middleware.ts` chroniący trasy spoza `PUBLIC_PATHS = ["/", "/api/auth"]`, minimalna strona `/dashboard` wyświetlająca e-mail sesji.

Czego brakuje: żadnych stron `/login` ani `/register`, żadnych formularzy ani komponentów UI, żadnych Server Actions, brak globalnej nawigacji, `src/app/page.tsx` to stock Next.js scaffold (Vercel branding). Middleware nie ma `/login` ani `/register` w `PUBLIC_PATHS` — bez zmiany te strony będą chronione i niedostępne dla niezalogowanych.

## Pożądany stan końcowy

Student może odwiedzić `/login`, wpisać dane i trafić na `/dashboard` (lub zobaczyć komunikat o błędzie przy polu). Może odwiedzić `/register`, wypełnić email + hasło + potwierdzenie hasła i zostać automatycznie zalogowany. Na każdej stronie widzi globalną nawigację: nie zalogowany → linki Login / Register; zalogowany → adres e-mail + przycisk Sign Out. Strona `/` to landing page z opisem aplikacji i CTA. Pełna weryfikacja: `npm run typecheck`, `npm run lint`, `npm run build` przechodzą; ręczny test full flow w przeglądarce na localhost:3000 i localhost:8787.

### Kluczowe odkrycia

- `src/middleware.ts:7` — `PUBLIC_PATHS = ["/", "/api/auth"]`; `/login` i `/register` muszą być dodane przed Fazą 2
- `src/modules/auth/auth.ts:14` — `signIn("credentials", {..., redirectTo})` rzuca `NEXT_REDIRECT` — catch bloki muszą re-throw gdy `isRedirectError(error)`
- `src/app/api/auth/register/route.ts` — logika rejestracji (sprawdź duplikat → hash → insert) zostanie wyekstrahowana do `user.util.ts` i współdzielona z Server Action
- `AGENTS.md` — `src/shared/components/` dla współdzielonych (Nav), `src/modules/auth/components/` dla auth-specific; co-location: `PascalCase.tsx` + `PascalCase.module.css` obok siebie; nigdy `src/components/`
- CSS: CSS Modules + zmienne z `globals.css` (`--background`, `--foreground`); brak Tailwind

## Czego NIE robimy

- Weryfikacja e-mail (link aktywacyjny)
- Odzyskiwanie hasła
- OAuth providers
- Animacje, toast notifications, skeleton loaders
- React Hook Form ani innej biblioteki formularzy
- Własny test runner — weryfikacja przez build + testy ręczne

## Podejście do implementacji

Trzy fazy w kolejności zależności. **Faza 1** tworzy Server Actions i aktualizuje middleware — fundament wymagany przez formularze. **Faza 2** buduje strony i formularze auth korzystające z tych actions. **Faza 3** dodaje globalny Nav i aktualizuje home page.

Formularze używają natywnego `useActionState` (React 19) + `useFormStatus` dla loading state — bez zewnętrznych bibliotek. Server Actions zwracają `{ errors: { field?: string } }` dla błędów lub rzucają `NEXT_REDIRECT` (re-throw) po sukcesie. Field-level błędy: każde pole renderuje komunikat gdy `state?.errors?.field` istnieje.

## Krytyczne szczegóły implementacji

**Re-throw NEXT_REDIRECT w Server Actions:** `signIn` i `signOut` wewnętrznie wywołują `redirect()` Next.js, który rzuca specjalny błąd. Blok `try/catch` musi go wykryć i ponownie rzucić — pominięcie powoduje, że przekierowanie jest połykane i użytkownik nigdy nie trafia na `/dashboard`. Importować `isRedirectError` z `next/dist/client/components/redirect-error` (potwierdzony w Next.js 16.2.6). Fallback gdy import zawiedzie po upgrade: `if ((e as any)?.digest?.startsWith("NEXT_REDIRECT")) throw e` — to samo pole, które `isRedirectError` sprawdza wewnętrznie. Wzorzec z importem: `if (isRedirectError(e)) throw e`.

**`useFormStatus` musi być w dziecku `<form>`:** `isPending` z `useFormStatus` dostarcza stanu loading dla przycisku. Wymaga, żeby komponent wywołujący `useFormStatus` był renderowany wewnątrz elementu `<form>` — nie w tym samym komponencie co `<form>`. Rozwiązanie: osobny komponent `<SubmitButton>` który wewnętrznie wywołuje `useFormStatus`.

**Rejestracja po stronie klienta vs serwera — split walidacji:** Sprawdzenie `password === confirmPassword` wykonać na kliencie w `handleSubmit` przed wysłaniem formularza (`event.preventDefault()` + sprawdzenie + setError jeśli niezgodne) — nie wysyłać do serwera niezgodnych haseł. Serwer waliduje: email format, email unikalność, minimalną długość hasła.

---

## Faza 1: Server Actions + Middleware

### Przegląd

Wyekstrahowanie logiki rejestracji do współdzielonego utila, stworzenie Server Actions dla login/register/logout, aktualizacja middleware. Żadnych plików UI — same warstwy logiki i routingu.

### Wymagane zmiany

#### 1. Shared user util — wyekstrahowanie logiki rejestracji

**Plik:** `src/modules/auth/user.util.ts` (nowy)

**Cel:** Współdzielona logika tworzenia użytkownika używana przez API route (istniejący) i nowy Server Action (rejestracja). Eliminuje duplikację logiki DB między `route.ts` a `actions.ts`.

**Kontrakt:** Eksportuje `registerUser(email: string, password: string): Promise<{ id: string; email: string }>`. Rzuca `new Error("EMAIL_TAKEN")` gdy email istnieje. Rzuca `new Error("INVALID_INPUT")` gdy email lub hasło puste. Haszuje hasło bcrypt 12 rund, wstawia do tabeli `users`, zwraca `{ id, email }`.

#### 2. Refaktor endpointu rejestracji

**Plik:** `src/app/api/auth/register/route.ts` (modyfikacja)

**Cel:** Delegowanie do `registerUser` zamiast zawierania logiki inline — zachowanie tego samego kontraktu HTTP (201 / 400 / 409).

**Kontrakt:** `POST` handler wywołuje `registerUser(email, password)`, mapuje `EMAIL_TAKEN` → 409, `INVALID_INPUT` → 400, sukces → 201 z `{ user: { id, email } }`. Interfejs HTTP bez zmian.

#### 3. Server Actions

**Plik:** `src/modules/auth/actions.ts` (nowy)

**Cel:** Trzy server actions używane przez formularze Client Components. Wszystkie mają `"use server"` dyrektywę.

**Kontrakt:**

`loginAction(prevState: LoginState, formData: FormData): Promise<LoginState>` — waliduje obecność email i password (zwraca field errors jeśli brak), wywołuje `signIn("credentials", { email, password, redirectTo: "/dashboard" })`, re-rzuca `NEXT_REDIRECT`, przy błędzie credentials zwraca `{ errors: { _form: "Nieprawidłowy email lub hasło" } }`.

`registerAction(prevState: RegisterState, formData: FormData): Promise<RegisterState>` — waliduje format email, minimalną długość hasła (8 znaków), wywołuje `registerUser(email, password)`, mapuje `EMAIL_TAKEN` → `{ errors: { email: "Ten adres email jest już zajęty" } }`, po sukcesie wywołuje `signIn("credentials", { email, password, redirectTo: "/dashboard" })`, re-rzuca `NEXT_REDIRECT`. Gdy `signIn` zawiedzie po udanej rejestracji (edge case: konto istnieje, ale credentials provider nie odpowiada), zwraca `{ errors: { _form: "Konto zostało utworzone. Zaloguj się na /login." } }`.

`logoutAction(): Promise<void>` — wywołuje `signOut({ redirectTo: "/" })`, re-rzuca `NEXT_REDIRECT`.

Typy `LoginState` i `RegisterState` zdefiniowane w tym samym pliku: `{ errors?: { email?: string; password?: string; _form?: string } } | null`.

#### 4. Aktualizacja middleware

**Plik:** `src/middleware.ts` (modyfikacja)

**Cel:** Udostępnienie stron `/login` i `/register` dla niezalogowanych użytkowników — bez tej zmiany formularze są niedostępne.

**Kontrakt:** Zmiana `PUBLIC_PATHS = ["/", "/api/auth"]` na `PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth"]`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run typecheck` przechodzi bez błędów
- `npm run lint` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna

- `POST /api/auth/register` nadal zwraca 201 z prawidłowymi danymi
- `POST /api/auth/register` z duplikatem e-maila nadal zwraca 409
- `/login` i `/register` dostępne bez sesji (sprawdzić w DevTools — brak redirect 307)

**Uwaga implementacyjna:** Zatrzymaj się po Fazie 1 na ręczne potwierdzenie przed przejściem do Fazy 2.

---

## Faza 2: Strony auth — login i rejestracja

### Przegląd

Budowa stron `/login` i `/register` z formularzami Client Components korzystającymi z Server Actions z Fazy 1. Field-level błędy przez `useActionState`. Wspólny layout `(auth)` jako wycentrowana karta.

### Wymagane zmiany

#### 1. Auth route group layout

**Plik:** `src/app/(auth)/layout.tsx` (nowy)

**Cel:** Wycentrowana karta dla wszystkich stron auth — login i rejestracja dzielą ten sam centered card wrapper bez duplikacji.

**Kontrakt:** Server Component renderujący `<main>` z klasą z `auth.module.css` wokół `{children}`. CSS module: `src/app/(auth)/auth.module.css` — flexbox center, max-width ~400px, padding.

#### 2. Strona logowania

**Plik:** `src/app/(auth)/login/page.tsx` (nowy)

**Cel:** Wrapper page dla formularza logowania — dostarcza metadata i renderuje `<LoginForm>`.

**Kontrakt:** Async Server Component eksportujący `metadata` (title: "Logowanie — OSCE Triager") i `default` funkcję renderującą `<LoginForm>` z `@/modules/auth/components/LoginForm`. Link "Nie masz konta? Zarejestruj się" → `/register`.

#### 3. SubmitButton — wspólny przycisk z loading state

**Plik:** `src/modules/auth/components/SubmitButton.tsx` (nowy)

**Cel:** Współdzielony przycisk submit dla LoginForm i RegisterForm — wywołuje `useFormStatus()` z `react-dom` wewnątrz `<form>`, by odczytać `pending` i zablokować podwójne wysyłki.

**Kontrakt:** `"use client"`. Przyjmuje `children: React.ReactNode` i `loadingLabel?: string`. Wewnętrznie wywołuje `useFormStatus()` — wymagane, by komponent był dzieckiem `<form>`, nie w tym samym komponencie. Gdy `pending`: wyświetla `loadingLabel` (lub "Proszę czekać…") i ustawia `disabled={true}`.

---

#### 4. LoginForm — komponent kliencki

**Plik:** `src/modules/auth/components/LoginForm.tsx` (nowy)

**Cel:** Interaktywny formularz logowania z field-level błędami i loading state.

**Kontrakt:** `"use client"`. Używa `useActionState(loginAction, null)` z `@/modules/auth/actions`. Form z `action={formAction}`. Pola: `email` (type="email"), `password` (type="password"). Pod każdym polem: warunkowy `<p>` z `state?.errors?.email` / `state?.errors?.password`. Pod formularzem: `state?.errors?._form` dla błędów auth. `<SubmitButton>` jako osobny komponent wywołujący `useFormStatus()` dla disable/tekst "Logowanie…" gdy `pending`. CSS module: `LoginForm.module.css`.

#### 5. Strona rejestracji

**Plik:** `src/app/(auth)/register/page.tsx` (nowy)

**Cel:** Wrapper page dla formularza rejestracji.

**Kontrakt:** Analogicznie do `login/page.tsx` — metadata (title: "Rejestracja — OSCE Triager"), renderuje `<RegisterForm>`. Link "Masz już konto? Zaloguj się" → `/login`.

#### 6. RegisterForm — komponent kliencki

**Plik:** `src/modules/auth/components/RegisterForm.tsx` (nowy)

**Cel:** Formularz rejestracji z polem potwierdzenia hasła i field-level błędami.

**Kontrakt:** `"use client"`. Używa `useActionState(registerAction, null)`. Lokalne state `confirmError: string | null` dla walidacji zgodności haseł po stronie klienta. `onSubmit` handler: sprawdza `password === confirmPassword` — jeśli nie, ustawia `confirmError` i wywołuje `event.preventDefault()`. Pola: `email`, `password`, `confirmPassword`. Błędy field-level: `state?.errors?.email`, `state?.errors?.password`, `confirmError`. `<SubmitButton>` analogicznie do LoginForm. CSS module: `RegisterForm.module.css`.

#### 7. Index modułu komponentów auth

**Plik:** `src/modules/auth/components/index.ts` (nowy)

**Cel:** Pojedynczy punkt eksportu dla komponentów auth — zgodnie z wymaganiem AGENTS.md „Export all components from a single index file."

**Kontrakt:** Re-eksportuje `LoginForm`, `RegisterForm`, `SubmitButton` z odpowiednich plików w katalogu.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run typecheck` przechodzi
- `npm run lint` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna

- `/login` renderuje formularz (nie wymaga sesji)
- Logowanie z prawidłowymi danymi → redirect do `/dashboard`
- Logowanie z błędnym hasłem → błąd `_form` pod przyciskiem
- Logowanie z pustym polem → błąd przy polu email lub password
- Przycisk pokazuje "Logowanie…" podczas przetwarzania
- `/register` renderuje formularz (nie wymaga sesji)
- Rejestracja z nowym emailem → konto tworzone, automatyczne logowanie, redirect do `/dashboard`
- Rejestracja z istniejącym emailem → błąd przy polu email
- Hasło ≠ potwierdzenie → błąd przy polu confirmPassword (client-side, przed wysyłką)
- Link "Zarejestruj się" na `/login` prowadzi do `/register` i vice versa

**Uwaga implementacyjna:** Zatrzymaj się po Fazie 2 na ręczne potwierdzenie przed przejściem do Fazy 3.

---

## Faza 3: Landing page + globalny pasek nawigacyjny

### Przegląd

Globalny Nav świadomy sesji we wspólnym layoucie, przepisana strona główna, aktualizacja dashboard. Po tej fazie cała pętla S-01 jest kompletna: student może zarejestrować się, zalogować, zobaczyć swój email w Nav i wylogować się z dowolnej strony.

### Wymagane zmiany

#### 1. Nav — współdzielony komponent serwera

**Plik:** `src/shared/components/Nav/Nav.tsx` (nowy)

**Cel:** Globalny pasek nawigacyjny renderowany na każdej stronie. Async Server Component czytający sesję — różna treść dla zalogowanych i niezalogowanych.

**Kontrakt:** Async Server Component wywołujący `auth()` z `@/modules/auth/auth`. Jeśli `!session`: renderuje linki "Zaloguj się" (`/login`) i "Zarejestruj się" (`/register`). Jeśli `session`: renderuje `session.user?.email` + form z `<button formAction={logoutAction}>Wyloguj</button>` (server action bezpośrednio w formAction). Logo/nazwa "OSCE Triager" → link do `/`. CSS module: `Nav.module.css` — poziomy flex, padding, wyrównanie. Co-location: `Nav.tsx` i `Nav.module.css` w katalogu `src/shared/components/Nav/`.

#### 2. Index modułu Nav

**Plik:** `src/shared/components/Nav/index.ts` (nowy)

**Cel:** Pojedynczy punkt eksportu komponentu Nav — zgodnie z wymaganiem AGENTS.md.

**Kontrakt:** Re-eksportuje `Nav` z `./Nav`.

#### 3. Aktualizacja root layoutu

**Plik:** `src/app/layout.tsx` (modyfikacja)

**Cel:** Dodanie Nav do każdej strony aplikacji i aktualizacja metadanych z placeholdera na nazwę projektu.

**Kontrakt:** Import `Nav` z `@/shared/components/Nav`. Renderuje `<Nav />` bezpośrednio przed `{children}` w `<body>`. Zmiana `metadata.title` na `"OSCE Triager"` i `metadata.description` na `"Interaktywny symulator ścieżki diagnostycznej OSCE"`.

#### 4. Aktualizacja strony głównej

**Plik:** `src/app/page.tsx` (modyfikacja)

**Cel:** Zastąpienie stock Next.js scaffold sensowną landing page dopasowaną do projektu.

**Kontrakt:** Async Server Component wywołujący `auth()`. Renderuje: nagłówek z tytułem aplikacji i krótkim opisem (symulator OSCE). Jeśli `!session`: dwa przyciski CTA — "Zaloguj się" (`/login`) i "Zarejestruj się" (`/register`). Jeśli `session`: "Witaj, {email}" + button/link "Przejdź do Pulpitu" → `/dashboard`. Styling przez `page.module.css` — zastąpić istniejące style scaffoldu.

#### 5. Aktualizacja dashboard

**Plik:** `src/app/dashboard/page.tsx` (modyfikacja)

**Cel:** Uprzątnięcie strony proof-of-concept F-01 — Nav obsługuje teraz wylogowanie, strona pokazuje tylko potwierdzenie zalogowania.

**Kontrakt:** Async Server Component wywołujący `auth()`. Renderuje: "Panel studenta" + `session.user?.email`. Żadnego wbudowanego przycisku wylogowania (Nav to obsługuje). Minimalne style zgodne z resztą aplikacji.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run typecheck` przechodzi
- `npm run lint` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna (localhost:3000)

- `/` bez sesji → landing page z CTA "Zaloguj się" i "Zarejestruj się", Nav pokazuje linki Login/Register
- `/` z sesją → "Witaj, {email}" z przyciskiem Dashboard, Nav pokazuje email + Wyloguj
- `/dashboard` z sesją → email użytkownika, Nav z email + przyciskiem Wyloguj
- Kliknięcie "Wyloguj" w Nav → redirect na `/`, Nav z powrotem pokazuje Login/Register
- `/login` i `/register` dostępne bez sesji, Nav widoczny na tych stronach
- `/dashboard` bez sesji → redirect na `/` (middleware działa)
- Metadata: tab przeglądarki pokazuje "OSCE Triager" zamiast "Create Next App"

#### Weryfikacja ręczna (localhost:8787 — Workers runtime)

- Identyczny full flow działa na `npm run preview`
- Brak błędów runtime w `wrangler tail`

---

## Strategia testowania

### Kroki testowania ręcznego — full flow

1. Otwórz prywatne okno przeglądarki, przejdź na `http://localhost:3000`
2. Zweryfikuj landing page z CTA i Nav z Login/Register
3. Kliknij "Zarejestruj się" → strona `/register`
4. Spróbuj zarejestrować z hasłem ≠ potwierdzenie → błąd przy confirm
5. Zarejestruj z nowym emailem i pasującymi hasłami → `/dashboard`, Nav z emailem
6. Wyloguj przez Nav → `/`, Nav z Login/Register
7. Przejdź na `/login`, zaloguj z błędnym hasłem → błąd `_form`
8. Zaloguj z poprawnymi danymi → `/dashboard`
9. Nawiguj na `/` → welcome message z przyciskiem Dashboard
10. Wyloguj → powrót na landing page
11. Powtórz kroki 1-10 na `npm run preview` (localhost:8787)

### Brak testów jednostkowych

Brak skonfigurowanego test runnera w projekcie — weryfikacja przez `npm run build` + testy ręczne.

## Uwagi dotyczące migracji

Brak zmian schematu DB — F-01 i F-02 stworzyły wszystkie potrzebne tabele. Faza 1 refaktoruje tylko `route.ts` bez zmiany kontraktor HTTP.

## Referencje

- Roadmap S-01: `context/foundation/roadmap.md:107-118`
- Roadmap F-01 (fundament): `context/foundation/roadmap.md:60-72`
- Auth.js gotcha `AUTH_URL` / `NEXT_REDIRECT`: `context/foundation/infrastructure.md:66-67`
- Konwencje struktury: `AGENTS.md:42-60`
- Schema tabela users: `src/shared/lib/schema.ts`
- Istniejący register endpoint: `src/app/api/auth/register/route.ts`
- Middleware: `src/middleware.ts`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: Server Actions + Middleware

#### Automatyczne

- [ ] 1.1 `npm run typecheck` przechodzi
- [ ] 1.2 `npm run lint` przechodzi
- [ ] 1.3 `npm run build` przechodzi

#### Ręczne

- [ ] 1.4 `POST /api/auth/register` zwraca 201 (zachowanie bez zmian)
- [ ] 1.5 `/login` dostępne bez sesji (brak redirect)
- [ ] 1.6 `/register` dostępne bez sesji (brak redirect)

### Faza 2: Strony auth

#### Automatyczne

- [ ] 2.1 `npm run typecheck` przechodzi
- [ ] 2.2 `npm run lint` przechodzi
- [ ] 2.3 `npm run build` przechodzi

#### Ręczne

- [ ] 2.4 `/login` renderuje formularz bez sesji
- [ ] 2.5 Logowanie z poprawnymi danymi → `/dashboard`
- [ ] 2.6 Logowanie z błędnym hasłem → błąd _form
- [ ] 2.7 `/register` renderuje formularz bez sesji
- [ ] 2.8 Rejestracja z nowym emailem → konto + auto-login + `/dashboard`
- [ ] 2.9 Rejestracja z istniejącym emailem → błąd przy polu email
- [ ] 2.10 Hasło ≠ potwierdzenie → błąd przy polu confirmPassword

### Faza 3: Landing page + Nav

#### Automatyczne

- [ ] 3.1 `npm run typecheck` przechodzi
- [ ] 3.2 `npm run lint` przechodzi
- [ ] 3.3 `npm run build` przechodzi

#### Ręczne

- [ ] 3.4 `/` bez sesji → landing page z CTA Login/Register
- [ ] 3.5 Nav bez sesji → linki Login/Register
- [ ] 3.6 Nav z sesją → email + przycisk Wyloguj
- [ ] 3.7 Przycisk Wyloguj w Nav działa, redirect na `/`
- [ ] 3.8 Full flow (rejestracja → login → dashboard → logout) na localhost:3000
- [ ] 3.9 Identyczny full flow na localhost:8787 (Workers runtime)
