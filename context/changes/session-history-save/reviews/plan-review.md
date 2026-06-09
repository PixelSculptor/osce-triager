<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Session History Save — Plan implementacji

- **Plan**: `context/changes/session-history-save/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-06-09
- **Werdykt**: DO POPRAWY
- **Ustalenia**: 2 krytyczne | 0 ostrzeżeń | 1 obserwacja

## Werdykty

| Wymiar | Werdykt |
|---|---|
| Zgodność ze stanem końcowym | ZALICZONY |
| Oszczędna realizacja | ZALICZONY |
| Dopasowanie architektoniczne | ZALICZONY |
| Martwe punkty | NIEZALICZONY |
| Kompletność planu | NIEZALICZONY |

## Ugruntowanie

5/5 ścieżek ✓, 3/3 symboli ✓, brief↔plan ✓

Weryfikowane: `queries.ts` (eq import, brak getUserSessions/getSessionDetails), `dashboard/page.tsx` (wzorzec auth), `session/[sessionId]/page.tsx` (async params + notFound pattern), `Nav.tsx` (aktualna struktura linków), `components/index.ts` (barrel istnieje). npm scripts typecheck/lint/build — wszystkie istnieją w package.json.

## Ustalenia

### F1 — getSessionDetails nie filtruje sesji in_progress → null completedAt crash

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 — Query getSessionDetails, Kontrakt
- **Szczegóły**: Schema (`src/shared/lib/schema.ts:117`) deklaruje `completedAt` jako nullable (brak `.notNull()`). Kontrakt `getSessionDetails` filtruje tylko `WHERE id = sessionId AND userId = userId` — bez `outcome != 'in_progress'`. Bezpośredni URL `/dashboard/session/[id]/details` dla sesji in_progress przejdzie walidację userId, ale zwróci `completedAt = null`. Strona wywoła `completedAt.getTime()` przy obliczaniu czasu trwania → TypeError w runtime. Izolacja `getUserSessions` (który filtruje po outcome) nie chroni trasy details dostępnej przez bezpośredni URL.
- **Poprawka**: Dodaj `AND outcome != 'in_progress'` do pierwszego zapytania w kontrakcie `getSessionDetails`. Zwraca `null` (→ `notFound()`) dla in-progress sesji, gwarantuje `completedAt: Date` zgodnie z typem.
- **Decyzja**: OCZEKUJĄCA

### F2 — Progress Faza 1 brakuje checkboxa dla 5. kryterium ręcznego

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Sekcja ## Postęp — Faza 1 ręczne
- **Szczegóły**: Blok `#### Weryfikacja ręczna:` Fazy 1 (linia 124–128 planu) ma 5 pozycji: Nav link, lista sesji, pusty stan, izolacja, oraz „Kliknięcie wpisu przenosi do `/dashboard/session/[id]/details` (może być 404 przed Fazą 2 — akceptowalne)". Sekcja Progress `### Faza 1` zawiera tylko 4 pozycje ręczne (1.4–1.7) — piąte kryterium nie ma odpowiadającego `- [ ] 1.8`.
- **Poprawka**: Dodaj do sekcji Progress → Faza 1 → Ręczne: `- [ ] 1.8 Kliknięcie wpisu w historii przenosi do /dashboard/session/[id]/details (może być 404 przed Fazą 2 — akceptowalne)`
- **Decyzja**: OCZEKUJĄCA

### F3 — Opis linku w Nav pomija istniejący link Ustawienia

- **Waga**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 — Zmiana 6 (Nav.tsx)
- **Szczegóły**: Plan mówi „przed lub po emailu — spójnie z istniejącą kolejnością elementów". Faktyczna kolejność w Nav.tsx to: email → Ustawienia → Wyloguj. Implementator może nie wiedzieć, czy „Historia" ma wejść między emailem a Ustawieniami, czy między Ustawieniami a Wyloguj.
- **Poprawka**: Dookreślić pozycję, np. „między emailem a linkiem Ustawienia" lub „między linkiem Ustawienia a przyciskiem Wyloguj".
- **Decyzja**: OCZEKUJĄCA
