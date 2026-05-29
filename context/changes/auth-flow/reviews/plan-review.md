<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Auth Flow — Plan implementacji (S-01)

- **Plan**: `context/changes/auth-flow/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-05-29
- **Werdykt**: DO POPRAWY → SOLIDNY (po zastosowaniu poprawek)
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar | Werdykt |
|---|---|
| Zgodność ze stanem końcowym | ZALICZONY |
| Oszczędna realizacja | ZALICZONY |
| Dopasowanie architektoniczne | OSTRZEŻENIE → NAPRAWIONE |
| Martwe punkty | OSTRZEŻENIE → NAPRAWIONE |
| Kompletność planu | OSTRZEŻENIE → NAPRAWIONE |

## Ugruntowanie

5/5 ścieżek ✓, 3/3 symboli ✓, brief↔plan ✓. Sub-agent zweryfikował wszystkie 5 ryzykownych twierdzeń:
- `isRedirectError` @ `next/dist/client/components/redirect-error` — istnieje w Next.js 16.2.6
- `useActionState` eksportowany z `react` 19.2.4 (nie `react-dom`)
- `useFormStatus` eksportowany z `react-dom`
- next-auth 5.0.0-beta.31 — `signIn(redirectTo)` rzuca NEXT_REDIRECT; `auth.config.ts` bez kolidujących callbacków
- `src/shared/components/` i `src/modules/auth/components/` nie istniały — plan może je tworzyć

## Ustalenia

### F1 — SubmitButton nie ma ścieżki pliku

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 — kontrakty LoginForm i RegisterForm
- **Szczegóły**: Kontrakt obu formularzy opisywał `<SubmitButton>` jako osobny komponent, ale brak ścieżki pliku. Agent zduplikowałby go lub umieścił źle.
- **Poprawka A ⭐ Zastosowana**: `src/modules/auth/components/SubmitButton.tsx` — auth-specific per AGENTS.md.
- **Decyzja**: NAPRAWIONE (Poprawka A)

### F2 — user.util.ts vs konwencja PascalCase.util.ts

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 1 — `src/modules/auth/user.util.ts`
- **Szczegóły**: AGENTS.md definiował tylko `PascalCase.util.ts`. Użytkownik wyjaśnił dystynkcję: `PascalCase.util.ts` = util związany z komponentem; `camelCase.util.ts` = logika domenowa nieprzywiązana do komponentu. `user.util.ts` jest poprawny — zawiera domenową logikę `registerUser`.
- **Poprawka**: AGENTS.md zaktualizowany o tę dystynkcję (obie konwencje udokumentowane).
- **Decyzja**: NAPRAWIONE (AGENTS.md zaktualizowany; nazwa pliku bez zmian)

### F3 — Brak index.ts dla nowych katalogów modułów

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 2 (components/), Faza 3 (Nav/)
- **Szczegóły**: AGENTS.md: „Export all components from a single index file." Brak specyfikacji plików index.ts w planie.
- **Poprawka**: Dodano `src/modules/auth/components/index.ts` (Faza 2, item 7) i `src/shared/components/Nav/index.ts` (Faza 3, item 2).
- **Decyzja**: NAPRAWIONE

### F4 — Ścieżka błędu gdy auto-signIn zawiedzie po rejestracji

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 1 — registerAction
- **Szczegóły**: Jeśli `signIn` zawiedzie po udanej rejestracji, użytkownik miał konto ale dostawał błąd bez wskazówki.
- **Poprawka**: Kontrakt `registerAction` zaktualizowany — fallback: `{ errors: { _form: "Konto zostało utworzone. Zaloguj się na /login." } }`.
- **Decyzja**: NAPRAWIONE

### F5 — isRedirectError z wewnętrznej ścieżki Next.js

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 1 — sekcja Krytyczne szczegóły
- **Szczegóły**: Import z `next/dist/client/components/redirect-error` potwierdzony dla 16.2.6, ale wersjo-zależny.
- **Poprawka**: Dodano fallback `(e as any)?.digest?.startsWith("NEXT_REDIRECT")` do kontraktu actions.ts.
- **Decyzja**: NAPRAWIONE
