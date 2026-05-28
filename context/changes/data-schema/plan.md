# Schemat danych dziedzinowych — Plan implementacji (F-02)

## Przegląd

Rozszerzenie schematu Drizzle o 5 tabel domenowych (`scenarios`, `diagnostic_tests`, `test_classifications`, `session_results`, `session_events`), wygenerowanie i aplikacja migracji SQL, oraz stworzenie idempotentnego skryptu seed z 2 hardcoded scenariuszami klinicznymi i 18 badaniami diagnostycznymi. F-02 jest fundamentem dla walidatora (S-02) i zapisu historii sesji (S-03).

## Analiza stanu obecnego

`src/shared/lib/schema.ts` zawiera wyłącznie tabele Auth.js (F-01): `users`, `accounts`, `sessions`, `verificationTokens`. Migracja `drizzle/migrations/0000_robust_dragon_lord.sql` istnieje i jest zaaplikowana do lokalnego Supabase. Brak plików seed. `drizzle.config.ts` wskazuje na `./src/shared/lib/schema.ts` i `./drizzle/migrations` — drizzle-kit automatycznie wykryje nowe tabele po ich dodaniu do schema.ts.

## Pożądany stan końcowy

Po ukończeniu planu: `npx drizzle-kit generate` tworzy `0001_domain_schema.sql`, `npx drizzle-kit migrate` aplikuje go do lokalnego Supabase bez błędów. `npx tsx src/shared/lib/seed.ts` wstawia 2 scenariusze, 18 badań i 36 klasyfikacji — ponowne uruchomienie nie duplikuje danych. Tabele domenowe widoczne w Supabase Studio. `npm run typecheck` i `npm run build` przechodzą.

### Kluczowe odkrycia

- `src/shared/lib/schema.ts:1-8` — importuje z `drizzle-orm/pg-core`; trzeba dodać `boolean` do importu
- `src/shared/lib/db.ts` — singleton eksportuje `db`; seed.ts może importować bezpośrednio
- `drizzle.config.ts:4` — `config({ path: ".env.local" })` wzorzec ładowania env; seed.ts musi replikować
- `package.json` — `dotenv` jest w devDependencies (do użycia w seed.ts); brak `tsx` — trzeba dodać
- FK `session_results.user_id → users.id` trafia do tabeli Auth.js "user" (SQL name `user`, Drizzle export `users`)
- Tabela junction `test_classifications` używa compound PK (scenario_id, test_id) — identyczny wzorzec jak `accounts` w istniejącym schemacie

## Czego NIE robimy

- Logiki walidatora (S-02) — tabele ją tylko zasilają
- UI do wyświetlania scenariuszy (S-01/S-02)
- Migracji produkcyjnej w CI — manual-only do stabilizacji schematu
- Row Level Security w Supabase — izolacja przez `WHERE user_id` w zapytaniach (S-02, S-03)
- Więcej niż 2 scenariuszy — ≤3 per cel speed

## Podejście do implementacji

Dwie fazy w kolejności zależności: (1) rozszerzenie schema.ts + migracja lokalna; (2) seed.ts z hardcoded danymi. Faza 1 musi poprzedzać fazę 2 (seed.ts importuje tabele ze schema.ts). Seed idempotentny przez `onConflictDoNothing()` na każdym insercie.

## Krytyczne szczegóły implementacji

**Kolejność insertów w seed:** `scenarios` i `diagnosticTests` przed `testClassifications` — FK constraints blokują odwrotną kolejność.

**Ładowanie env w seed.ts:** `db.ts` czyta `process.env.DATABASE_URL` przy imporcie. Seed musi załadować `.env.local` PRZED importem `db` — `import { config } from "dotenv"; config({ path: ".env.local" })` musi być pierwszą instrukcją w pliku (przed `import { db } from "./db"`).

---

## Faza 1: Schema domenowa + migracja

### Przegląd

Dodanie 5 tabel do `schema.ts`, instalacja `tsx`, wygenerowanie migracji i zaaplikowanie jej do lokalnego Supabase.

### Wymagane zmiany

#### 1. Dodanie `tsx` do devDependencies

**Plik:** `package.json` (modyfikacja przez npm install)

**Cel:** Umożliwić uruchamianie TypeScript seed script bez kompilacji — `npx tsx src/shared/lib/seed.ts`.

**Kontrakt:** `npm install -D tsx` + dodaj `"seed": "tsx src/shared/lib/seed.ts"` do sekcji `scripts`.

#### 2. Rozszerzenie schema.ts o 5 tabel domenowych

**Plik:** `src/shared/lib/schema.ts`

**Cel:** Zdefiniować tabele domenowe OSCE Triager jako część jednego schematu Drizzle, z FK do istniejącej tabeli `users` (Auth.js). Eksportowane tabele będą dostępne przez `db.query.*` dla walidatora (S-02) i historii sesji (S-03).

**Kontrakt:** Dodaj `boolean` do importu z `drizzle-orm/pg-core`. Dołącz 5 eksportów:

- `scenarios` — pgTable `"scenario"`, kolumny: `id` (text PK, uuid), `title` (text notNull), `description` (text notNull), `timeLimitSeconds` (integer notNull), `createdAt` (timestamp notNull defaultNow)
- `diagnosticTests` — pgTable `"diagnostic_test"`, kolumny: `id` (text PK, uuid), `name` (text notNull unique), `createdAt` (timestamp notNull defaultNow)
- `testClassifications` — pgTable `"test_classification"`, kolumny: `scenarioId` (text notNull FK→scenarios.id cascade), `testId` (text notNull FK→diagnosticTests.id cascade), `classification` (text notNull, `.$type<"critical" | "optimal" | "acceptable" | "unnecessary">()`); compound PK `[scenarioId, testId]` — identyczny wzorzec jak `accounts` w linii 38-43
- `sessionResults` — pgTable `"session_result"`, kolumny: `id` (text PK, uuid), `userId` (text notNull FK→users.id cascade), `scenarioId` (text notNull FK→scenarios.id restrict), `outcome` (text notNull default `"in_progress"`, `.$type<"in_progress" | "positive" | "negative">()`), `isFailed` (boolean notNull default false), `startedAt` (timestamp notNull defaultNow), `completedAt` (timestamp nullable)
- `sessionEvents` — pgTable `"session_event"`, kolumny: `id` (text PK, uuid), `sessionId` (text notNull FK→sessionResults.id cascade), `testId` (text notNull FK→diagnosticTests.id restrict), `validatorResult` (text notNull, `.$type<"correct" | "suboptimal" | "critical_miss">()`), `selectedAt` (timestamp notNull defaultNow)

#### 3. Generowanie i aplikacja migracji

**Cel:** Zmaterializować schemat Drizzle w lokalnej bazie Supabase jako SQL.

**Kontrakt:** Po edycji schema.ts uruchom sekwencję:
```bash
npx drizzle-kit generate    # tworzy drizzle/migrations/0001_*.sql
npx drizzle-kit migrate     # aplikuje do lokalnego Supabase (port 54322)
```

Lokalne Supabase musi być uruchomione: `supabase start`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run typecheck` przechodzi bez błędów po edycji schema.ts
- `npm run lint` przechodzi
- `npx drizzle-kit generate` tworzy plik `drizzle/migrations/0001_*.sql`
- `npx drizzle-kit migrate` kończy się bez błędu

#### Weryfikacja ręczna

- Tabele `scenario`, `diagnostic_test`, `test_classification`, `session_result`, `session_event` widoczne w Supabase Studio (`http://127.0.0.1:54323`) lub `psql -U postgres -h 127.0.0.1 -p 54322 -d postgres -c "\dt"`

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie przed Fazą 2.

---

## Faza 2: Seed script

### Przegląd

Stworzenie `src/shared/lib/seed.ts` z idempotentnym insertem 2 scenariuszy, 18 badań diagnostycznych i 36 wierszy klasyfikacji (18 badań × 2 scenariusze).

### Wymagane zmiany

#### 1. Plik seed.ts z pełną treścią medyczną

**Plik:** `src/shared/lib/seed.ts` (nowy)

**Cel:** Wypełnić bazę danych hardcoded treścią kliniczną — jedyne źródło prawdy dla scenariuszy i klasyfikacji badań w MVP. Idempotentny: wielokrotne uruchomienie nie duplikuje danych.

**Kontrakt:** Struktura pliku (kolejność sekcji jest wymagana ze względu na FK):

```typescript
// 1. PIERWSZY: ładowanie env przed importem db
import { config } from "dotenv"
config({ path: ".env.local" })

// 2. Importy po załadowaniu env
import { db } from "./db"
import { scenarios, diagnosticTests, testClassifications } from "./schema"

// 3. Dane — hardcoded UUID dla idempotentności
const SCENARIO_1_ID = "01935a5f-0000-7000-8000-000000000001"
const SCENARIO_2_ID = "01935a5f-0000-7000-8000-000000000002"

const SCENARIOS = [
  {
    id: SCENARIO_1_ID,
    title: "Ostry ból w klatce piersiowej",
    description:
      "55-letni mężczyzna przywieziony przez rodzinę. RR 150/90 mmHg, HR 110/min, SpO2 94% na powietrzu. Skarży się na ból zamostkowy promieniujący do lewego ramienia (NRS 8/10), pocenie się, nudności. Wywiad: nadciśnienie tętnicze leczone farmakologicznie, palenie tytoniu od 20 lat.",
    timeLimitSeconds: 300,
  },
  {
    id: SCENARIO_2_ID,
    title: "Zaburzenia świadomości",
    description:
      "68-letni mężczyzna znaleziony przez żonę leżący na podłodze, nie reaguje na pytania. RR 110/70 mmHg, HR 95/min, RR 12 oddechów/min, Glasgow 10 (M4V3E3), glukoza z glukometru 38 mg/dl. Wywiad: cukrzyca insulin-zależna od 15 lat, wieczorem była kolacja, rano zaplanowany długi spacer.",
    timeLimitSeconds: 240,
  },
]

const TESTS = [
  { id: "dt-001", name: "EKG 12-odprowadzeniowe" },
  { id: "dt-002", name: "Troponiny sercowe" },
  { id: "dt-003", name: "Glukoza z glukometru" },
  { id: "dt-004", name: "KT głowy bez kontrastu" },
  { id: "dt-005", name: "Morfologia krwi" },
  { id: "dt-006", name: "Elektrolity (Na, K)" },
  { id: "dt-007", name: "Gazometria krwi" },
  { id: "dt-008", name: "Kreatynina i mocznik" },
  { id: "dt-009", name: "Koagulogram (INR, APTT)" },
  { id: "dt-010", name: "RTG klatki piersiowej" },
  { id: "dt-011", name: "USG Point-of-Care (POCUS)" },
  { id: "dt-012", name: "D-dimer" },
  { id: "dt-013", name: "CRP" },
  { id: "dt-014", name: "Badanie ogólne moczu" },
  { id: "dt-015", name: "Toksykologia (mocz/krew)" },
  { id: "dt-016", name: "Enzymy wątrobowe (AST, ALT)" },
  { id: "dt-017", name: "Lipaza w surowicy" },
  { id: "dt-018", name: "Prokalcytonina" },
]

// [testId, s1Classification, s2Classification]
const CLASSIFICATIONS: [string, string, string][] = [
  ["dt-001", "critical",     "acceptable" ],
  ["dt-002", "critical",     "unnecessary"],
  ["dt-003", "acceptable",   "critical"   ],
  ["dt-004", "unnecessary",  "critical"   ],
  ["dt-005", "optimal",      "optimal"    ],
  ["dt-006", "optimal",      "optimal"    ],
  ["dt-007", "acceptable",   "optimal"    ],
  ["dt-008", "optimal",      "optimal"    ],
  ["dt-009", "optimal",      "acceptable" ],
  ["dt-010", "acceptable",   "unnecessary"],
  ["dt-011", "acceptable",   "unnecessary"],
  ["dt-012", "acceptable",   "unnecessary"],
  ["dt-013", "unnecessary",  "acceptable" ],
  ["dt-014", "unnecessary",  "acceptable" ],
  ["dt-015", "unnecessary",  "acceptable" ],
  ["dt-016", "unnecessary",  "unnecessary"],
  ["dt-017", "unnecessary",  "unnecessary"],
  ["dt-018", "unnecessary",  "unnecessary"],
]

// 4. Seed funkcja — kolejność insertów respektuje FK
async function seed() {
  // 1. Scenarios
  await db.insert(scenarios).values(SCENARIOS).onConflictDoNothing()

  // 2. Diagnostic tests
  await db.insert(diagnosticTests).values(TESTS).onConflictDoNothing()

  // 3. Classifications (FK do obu powyższych)
  const classificationRows = CLASSIFICATIONS.flatMap(([testId, s1, s2]) => [
    { scenarioId: SCENARIO_1_ID, testId, classification: s1 },
    { scenarioId: SCENARIO_2_ID, testId, classification: s2 },
  ])
  await db.insert(testClassifications).values(classificationRows).onConflictDoNothing()

  console.log("Seed complete: 2 scenarios, 18 tests, 36 classifications")
  process.exit(0)
}

seed().catch((err) => { console.error(err); process.exit(1) })
```

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run typecheck` przechodzi
- `npm run seed` (`npx tsx src/shared/lib/seed.ts`) kończy się z komunikatem `Seed complete: 2 scenarios, 18 tests, 36 classifications` i exit code 0
- Ponowne uruchomienie `npm run seed` nie rzuca błędu i nie duplikuje danych

#### Weryfikacja ręczna

- Supabase Studio (`http://127.0.0.1:54323`) → tabela `scenario`: 2 wiersze (tytuły: "Ostry ból w klatce piersiowej", "Zaburzenia świadomości")
- Tabela `diagnostic_test`: 18 wierszy
- Tabela `test_classification`: 36 wierszy
- Zapytanie weryfikacyjne w SQL Editor: `SELECT t.name, tc.classification FROM test_classification tc JOIN diagnostic_test t ON t.id = tc.test_id WHERE tc.scenario_id = '01935a5f-0000-7000-8000-000000000001' AND tc.classification = 'critical'` → zwraca "EKG 12-odprowadzeniowe" i "Troponiny sercowe"

---

## Strategia testowania

### Kroki testowania ręcznego

1. `supabase start` → upewnij się że działa lokalny Supabase
2. `npx drizzle-kit migrate` → tabele widoczne w `\dt`
3. `npm run seed` → komunikat sukcesu, exit 0
4. Ponownie `npm run seed` → brak błędu, liczba wierszy niezmieniona
5. SQL Editor: zapytanie weryfikacyjne klasyfikacji critical dla S1 i S2
6. `npm run build` przechodzi (integracja schema ze zbudowaną aplikacją)

## Migracja i seed na produkcji (krok ręczny po merge)

CI/CD deployuje kod automatycznie po merge do `main`, ale **nie uruchamia migracji** (decyzja z planowania — automigrate zostanie dodane przed S-02). Po każdym merge zawierającym zmiany schematu lub seed wykonaj ręcznie:

```bash
# 1. Ustaw produkcyjny DATABASE_URL (Supabase cloud — transaction pooler, port 6543)
export DATABASE_URL="postgresql://postgres.[ref]:[hasło]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"

# 2. Aplikuj migrację schematu
npx drizzle-kit migrate

# 3. Zasilij danymi (idempotentne — bezpieczne do wielokrotnego uruchomienia)
npm run seed
```

> **Kolejność:** najpierw `drizzle-kit migrate`, potem `npm run seed` — seed insertuje do tabel, które muszą już istnieć.

Rollback: brak automatycznego — napisać i uruchomić ręcznie `DROP TABLE` w odwrotnej kolejności FK (session_event → session_result → test_classification → diagnostic_test → scenario).

## Referencje

- Roadmap F-02: `context/foundation/roadmap.md:90-101`
- Istniejący schemat (wzorzec): `src/shared/lib/schema.ts`
- Klient DB: `src/shared/lib/db.ts`
- Konfiguracja migracji: `drizzle.config.ts`
- PRD Business Logic (klasyfikacje): `context/foundation/prd.md:95-99`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: Schema domenowa + migracja

#### Automatyczne

- [x] 1.1 `npm run typecheck` przechodzi po edycji schema.ts — 63de06f
- [x] 1.2 `npm run lint` przechodzi — 63de06f
- [x] 1.3 `npx drizzle-kit generate` tworzy `drizzle/migrations/0001_*.sql` — 63de06f
- [x] 1.4 `npx drizzle-kit migrate` kończy się bez błędu — 63de06f

#### Ręczne

- [x] 1.5 5 nowych tabel widocznych w Supabase Studio lub psql `\dt` — 63de06f

### Faza 2: Seed script

#### Automatyczne

- [x] 2.1 `npm run typecheck` przechodzi — 6fa8431
- [x] 2.2 `npm run seed` kończy z `Seed complete: 2 scenarios, 18 tests, 36 classifications` i exit 0 — 6fa8431
- [x] 2.3 Ponowne `npm run seed` nie rzuca błędu ani nie duplikuje — 6fa8431

#### Ręczne

- [x] 2.4 Supabase Studio: tabela `scenario` ma 2 wiersze — 6fa8431
- [x] 2.5 Supabase Studio: tabela `diagnostic_test` ma 18 wierszy, `test_classification` 36 wierszy — 6fa8431
- [x] 2.6 Zapytanie SQL: critical tests dla S1 zwraca EKG i Troponiny — 6fa8431
- [ ] 2.7 Migracja produkcyjna: `drizzle-kit migrate` + `npm run seed` uruchomione z produkcyjnym `DATABASE_URL` po merge do main
