<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: First Diagnostic Session with Validator

- **Plan**: `context/changes/first-playable-session/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-06-01
- **Werdykt**: DO POPRAWY
- **Ustalenia**: 1 krytyczne | 1 ostrzeżenie | 2 obserwacje

## Werdykty

| Wymiar | Werdykt |
|---|---|
| Zgodność ze stanem końcowym | ZALICZONY |
| Oszczędna realizacja | ZALICZONY |
| Dopasowanie architektoniczne | ZALICZONY |
| Martwe punkty | NIEZALICZONY |
| Kompletność planu | OSTRZEŻENIE |

## Ugruntowanie

5/5 ścieżek ✓, 4/4 symboli ✓, brief↔plan ✓, Progress↔Phase ✓

## Ustalenia

### F1 — Faza 1 zakłada migrację DB, której nie ma

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 1 — Schema Extension + Migration; Migration Notes
- **Szczegóły**: `validator_result` to zwykłe `text NOT NULL` bez DB-level CHECK constraint (potwierdzone: `0001_secret_nicolaos.sql` linia 19). `.$type<>()` to wyłącznie anotacja TypeScript. `drizzle-kit generate` nie wyprodukuje żadnej migracji — kryterium sukcesu 1.3 flat-out fails. Kolumna już teraz akceptuje `'unnecessary'` bez żadnych zmian w DB.
- **Poprawka**: Przepisz Fazę 1 jako TypeScript-only. Usuń kroki 1.3–1.5 z Progress. Zaktualizuj Migration Notes.
- **Decyzja**: NAPRAWIONO

### F2 — Idempotentność endSessionAction ma okno wyścigu na poziomie DB

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 — endSessionAction; schema sessionEvents
- **Szczegóły**: Wzorzec read-then-write bez transakcji. Oba wywołania mogą odczytać `outcome='in_progress'` zanim pierwsze zatwierdzi UPDATE. Skutek: duplikaty `critical_miss` events (brak UNIQUE na `(session_id, test_id)` w schemacie — potwierdzone subagent).
- **Poprawka A ⭐ Zalecana**: Atomowy UPDATE WHERE jako strażnik: `UPDATE ... WHERE outcome='in_progress' RETURNING *`. Jeśli 0 wierszy — sesja już zamknięta; zwróć aktualny stan bez insertu eventów.
  - Siła: Eliminuje okno wyścigu; nie wymaga pełnej transakcji; `.returning()` Drizzle.
  - Kompromis: Nieco bardziej złożony kontrakt akcji.
  - Pewność: WYSOKA — standardowy CAS na poziomie SQL.
  - Martwy punkt: Brak UNIQUE na `(session_id, test_id)` nadal istnieje (dla selectTestAction), ale MVP nie wymaga.
- **Decyzja**: NAPRAWIONO (Poprawka A)

### F3 — SessionView nie specyfikuje wyświetlania skipped-critical przy odświeżeniu zakończonej sesji

- **Waga**: 👁 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 5 — SessionView Contract, Result display
- **Szczegóły**: Gdy użytkownik odświeży URL zakończonej sesji, lista pominiętych testów krytycznych musi być wyprowadzona z `initialEvents.filter(e => e.validatorResult === 'critical_miss')`. Kontrakt tego nie opisywał.
- **Poprawka**: Dodano do sekcji "Result display" w SessionView Contract akapit opisujący oba źródła listy (normal flow vs. page refresh).
- **Decyzja**: NAPRAWIONO

### F4 — classifications prop eksponuje kategorie testów klientowi

- **Waga**: 👁 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 5 — SessionView Props
- **Szczegóły**: `classifications: Record<string, TestCategory>` jako prop klienta jest widoczny w React DevTools — student może zobaczyć które testy są `critical` przed wybraniem. Sekcja "What We Are NOT Doing" tego nie wymieniała.
- **Poprawka**: Dodano do sekcji "What We Are NOT Doing" jawną adnotację o braku ochrony przed inspekcją przez DevTools.
- **Decyzja**: NAPRAWIONO
