# Auth Flow — Krótki plan (S-01)

> Pełny plan: `context/changes/auth-flow/plan.md`

## Co i dlaczego

Budujemy UI uwierzytelniania dla S-01: strony login i rejestracji z formularzami, globalny pasek nawigacyjny świadomy sesji i przepisaną stronę główną. Fundament jest gotowy (F-01: Auth.js v5, endpoint rejestracji, middleware, tabele DB) — brakuje tylko warstwy UI, przez którą student może faktycznie założyć konto i zalogować się.

## Punkt wyjścia

`signIn`, `signOut`, `POST /api/auth/register` i `src/middleware.ts` działają i są przetestowane (F-01, commity `7e7e9df`–`baa18d6`). Brakuje stron `/login` i `/register` (middleware je blokuje), globalnej nawigacji i sensownej strony głównej (to wciąż stock Next.js scaffold z Vercel branding).

## Pożądany stan końcowy

Student otwiera OSCE Triager, widzi landing page z CTA "Zaloguj się" / "Zarejestruj się", wypełnia formularz i trafia na `/dashboard` — ze swoim emailem i przyciskiem Sign Out w globalnej nawigacji na każdej stronie.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Home page dla niezalogowanych | Landing page z CTA | Czytelne wejście, jeden dodatkowy klik akceptowalny dla MVP | Plan |
| Styling | Minimalny / CSS Modules | Spójny z istniejącym wzorcem, brak nowych zależności, cel speed | Plan |
| Błędy formularzy | Field-level (per-pole) | Lepsza UX diagnozy — React 19 `useActionState` obsługuje bez bibliotek | Plan |
| Formularz rejestracji | Email + hasło + potwierdź | Chroni przed literówką hasła, standardowe UX | Plan |
| Logout placement | Globalny Nav | Jeden komponent obsługuje wszystkie chronione strony (S-02, S-03) | Plan |
| Redirect po logowaniu | Zawsze → `/dashboard` | Prosta, deterministyczna ścieżka dla MVP | Plan |
| Placement komponentów | `src/modules/auth/components/` (form) + `src/shared/components/Nav/` | Zgodne z AGENTS.md: module-specific vs. shared across features | Plan |

## Zakres

**W zakresie:** Login form, register form (z confirm password), logout w Nav, landing page `/`, globalny Nav, aktualizacja `/dashboard`, refaktor `register/route.ts` do shared util, aktualizacja middleware (PUBLIC_PATHS).

**Poza zakresem:** Weryfikacja e-mail, odzyskiwanie hasła, OAuth, animacje, toast notifications, React Hook Form, testy jednostkowe.

## Architektura / Podejście

Server Actions (`src/modules/auth/actions.ts`) jako warstwa logiki między formularzami a Auth.js. Client Components z `useActionState` + `useFormStatus` dla field-level błędów i loading state — bez zewnętrznych bibliotek. Nav jako async Server Component (czyta `auth()` server-side). Walidacja split: password match po stronie klienta, email unikalność i hash po stronie serwera. Shared `user.util.ts` eliminuje duplikację logiki rejestracji między API route a Server Action.

```
page.tsx (Server) → LoginForm.tsx (Client "use client")
                        → useActionState(loginAction)
                        → loginAction ("use server") → signIn() → NEXT_REDIRECT /dashboard
                        
Nav.tsx (Server, async) → auth() → session-aware links
                        → logoutAction ("use server") → signOut() → NEXT_REDIRECT /
```

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Server Actions + Middleware | `actions.ts`, `user.util.ts`, PUBLIC_PATHS fix | NEXT_REDIRECT re-throw pattern — pominięcie powoduje niemożność przekierowania po login |
| 2. Strony auth | `/login`, `/register` z field-level błędami | `useFormStatus` musi być w dziecku `<form>` — nie w tym samym komponencie |
| 3. Landing + Nav | Globalny Nav, landing page, dashboard update | Nav jako async Server Component — `auth()` musi być awaited, nie useSession() |

**Wymagania wstępne:** F-01 done (✓), F-02 done (✓), lokalna baza Supabase uruchomiona dla ręcznych testów.  
**Szacowany nakład pracy:** ~2-3 sesje w 3 fazach; prosta logika UI, 0 zmian DB.

## Otwarte ryzyka i założenia

- `isRedirectError` import path może się różnić między wersjami Next.js 16 — weryfikować przez `node_modules/next/dist/` przed implementacją (AGENTS.md: "Next.js 16 is not the Next.js from training data")
- Wrangler preview (localhost:8787) weryfikuje Workers runtime — każda faza powinna przejść tę weryfikację przed merge

## Kryteria sukcesu (podsumowanie)

- Student może zarejestrować konto, zalogować się i wylogować przez UI przeglądarki
- Każdy formularz pokazuje konkretny błąd przy odpowiednim polu przy nieprawidłowych danych
- Globalny Nav pokazuje stan sesji na wszystkich stronach
- Pełny flow działa identycznie na localhost:3000 i localhost:8787
