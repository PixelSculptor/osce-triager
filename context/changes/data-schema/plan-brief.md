# Schemat danych dziedzinowych — Krótki plan (F-02)

> Pełny plan: `context/changes/data-schema/plan.md`

## Co i dlaczego

Dodanie 5 tabel domenowych do bazy (scenariusze, badania, klasyfikacje, wyniki sesji, zdarzenia sesji) oraz seed z 2 hardcoded scenariuszami OSCE i 18 badaniami diagnostycznymi. F-02 jest ostatnim fundamentem blokującym S-02 (walidator) — bez schematu i danych walidator nie ma czego sprawdzać.

## Punkt wyjścia

Istnieją tylko tabele Auth.js (F-01). Drizzle + postgres.js skonfigurowane, jedna migracja zaaplikowana. Brak tabel domenowych, brak seed.

## Pożądany stan końcowy

`npm run seed` wstawia 2 scenariusze kliniczne, 18 badań diagnostycznych i 36 klasyfikacji (critical/optimal/acceptable/unnecessary). Ponowne uruchomienie jest bezpieczne. Walidator w S-02 może zapytać: „jaką klasyfikację ma badanie X w scenariuszu Y?" i dostać odpowiedź przez PK lookup.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
|---|---|---|
| Liczba scenariuszy | 2 | Minimalne MVP z dowodem że system działa na >1 przypadku |
| Klasyfikacje | Junction table `test_classifications` | PK lookup (scenario_id, test_id) → determinizm <1s wymagany przez NFR |
| Seed mechanism | Osobny `seed.ts` (idempotentny) | Edytowalny bez nowej migracji; onConflictDoNothing() |
| Migracja CI | Nie teraz | Czyste oddzielenie; automigrate po ustabilizowaniu schematu |
| Env w seed | `dotenv` PRZED importem `db` | db.ts czyta DATABASE_URL przy imporcie — kolejność krytyczna |

## Zakres

**W zakresie:** schema.ts (5 nowych tabel), migracja 0001, seed.ts z danymi medycznymi, tsx w devDeps

**Poza zakresem:** logika walidatora, UI, RLS w Supabase, migracja CI, >2 scenariusze

## Architektura / Podejście

```
schema.ts (F-01 tables)
  + scenarios        ← hardcoded 2 przypadki kliniczne
  + diagnostic_tests ← 18 badań (wspólna lista, FR-004)
  + test_classifications  ← junction: scenario × test → classification
  + session_results  ← FK users.id + scenarios.id, outcome + is_failed
  + session_events   ← FK session_results + diagnostic_tests, validator_result
```

`seed.ts` insertuje w kolejności FK: scenarios → tests → classifications.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Schema + migracja | 5 tabel w DB, plik 0001_*.sql | FK do "user" (Auth.js używa nazwy "user" nie "users") |
| 2. Seed script | 2+18+36 wierszy, idempotentny | dotenv musi być ładowany przed importem db |

**Wymagania wstępne:** F-01 done (tabela `user` istnieje), lokalne Supabase uruchomione (`supabase start`)
**Szacowany nakład pracy:** ~1 sesja, 2 fazy — Faza 1 ≈ 20 min, Faza 2 ≈ 15 min

## Otwarte ryzyka i założenia

- FK `session_results.user_id` odwołuje się do tabeli `user` (SQL name) — Drizzle eksportuje ją jako `users`, ale `references(() => users.id)` jest poprawne
- Hardcoded UUID-y w seed (`01935a5f-...`) są deterministyczne — OK dla MVP, w przyszłości można zastąpić CMS

## Kryteria sukcesu (podsumowanie)

- `npm run seed` → komunikat `Seed complete: 2 scenarios, 18 tests, 36 classifications`, exit 0
- SQL: `SELECT * FROM test_classification WHERE classification = 'critical'` → 4 wiersze (EKG+Troponiny dla S1, Glukoza+KT dla S2)
- `npm run build` przechodzi — schema zintegrowana z Next.js build
