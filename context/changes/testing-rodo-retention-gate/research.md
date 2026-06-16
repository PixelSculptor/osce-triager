---
date: 2026-06-16T00:00:00+00:00
researcher: Claude Sonnet 4.6
git_commit: b904dcb402e09efef8593211946a0fe38d281d72
branch: testing-rodo-retention-gate
repository: osce-traiger
topic:
  'RODO retention gate — mechanizm cleanup, zakres danych, luki w czyszczeniu'
tags:
  [
    research,
    codebase,
    account-deletion,
    rodo,
    cleanup,
    cascade,
    verificationToken,
    github-actions,
  ]
status: complete
last_updated: 2026-06-16
last_updated_by: Claude Sonnet 4.6
---

# Research: RODO Retention Gate — mechanizm cleanup, zakres danych, luki w czyszczeniu

**Date**: 2026-06-16T00:00:00+00:00 **Researcher**: Claude Sonnet 4.6 **Git
Commit**: b904dcb402e09efef8593211946a0fe38d281d72 **Branch**:
testing-rodo-retention-gate **Repository**: osce-traiger

## Research Question

Jaki mechanizm wyzwala czyszczenie (Workers cron vs zaplanowana funkcja)? Które
tabele mają `deleted_at`? Jaka jest logika warunku brzegowego? Jak w akcji
`cleanup.yml` powinniśmy się zachować odnośnie danych usera — poza samym userem
z tabeli `users` powinniśmy usuwać cały wolumen danych z nim związany. Ten slice
powinien dotyczyć nie tylko testu bramki retencji RODO, ale i tego, czy wszystko
prawidłowo czyścimy, czy tylko userów.

## Summary

**Mechanizm cleanup**: GitHub Actions scheduled workflow
(`.github/workflows/cleanup.yml`) uruchamiający Node.js skrypt
(`scripts/cleanup-expired-accounts.mjs`) codziennie o 02:00 UTC. Brak Cloudflare
Cron Trigger — `wrangler.jsonc` nie ma sekcji `triggers.crons`.

**Kolumna soft-delete**: `deletionRequestedAt` (DB: `deletion_requested_at`) w
tabeli `user` — nie `deleted_at`. Dodana przez migrację
`0002_swift_the_phantom.sql`.

**Granica 30 dni**: `deletion_requested_at < NOW() - INTERVAL '30 days'` —
strict less-than, czyli dzień dokładnie 30 po requestcie jest usunięty (nie
grace period).

**CASCADE coverage**: 4 z 5 tabel z danymi usera są objęte CASCADE. **Luka:
`verificationToken` nie ma FK do `user`** — dane mogą przeżyć hard-delete.

**Stan testów**: 0 zautomatyzowanych testów dla logiki retencji/cleanup. Skrypt
nie ma żadnego pliku testowego.

## Detailed Findings

### Mechanizm wyzwalania cleanup

GitHub Actions — **nie** Cloudflare Workers cron:

- `.github/workflows/cleanup.yml:3-7` — `schedule: cron: '0 2 * * *'` +
  `workflow_dispatch`
- `wrangler.jsonc` — brak sekcji `triggers.crons`, brak `scheduled()` handler w
  `src/`
- `DATABASE_URL` jest sekreciem GitHub Actions (`deploy.yml:24-25`), NIE jest
  Worker secret — to był główny powód wyboru GH Actions zamiast Cloudflare Cron

Skrypt (`scripts/cleanup-expired-accounts.mjs:9`):

```js
const sql = postgres(DATABASE_URL, { prepare: false });
```

Używa `{ prepare: false }` — wymagane przez Supabase PgBouncer (Transaction
Pooler port 6543).

### Kolumna soft-delete w tabeli `user`

`src/shared/lib/schema.ts:20`:

```ts
deletionRequestedAt: timestamp("deletion_requested_at", { mode: "date" }),
```

Dodana migracją `drizzle/migrations/0002_swift_the_phantom.sql:1`:

```sql
ALTER TABLE "user" ADD COLUMN "deletion_requested_at" timestamp;
```

Nazwa `deletionRequestedAt` jest intentowa — rejestruje moment żądania i
startuje 30-dniowy countdown.

### Logika warunku brzegowego

`scripts/cleanup-expired-accounts.mjs:12-16`:

```sql
DELETE FROM "user"
WHERE deletion_requested_at IS NOT NULL
  AND deletion_requested_at < NOW() - INTERVAL '30 days'
RETURNING id
```

Warunek: **strict `<`** (less-than), nie `<=`. Oznacza to:

- `deletion_requested_at = NOW() - 31 days` → **usunięty** ✅
- `deletion_requested_at = NOW() - 30 days - 1 second` → **usunięty** ✅
- `deletion_requested_at = NOW() - 30 days` → **zachowany** (exactly at
  boundary)
- `deletion_requested_at = NOW() - 29 days` → **zachowany** ✅
- `deletion_requested_at = NULL` → **zachowany** (nie ma soft-delete flagi) ✅

### Mapa tabel i CASCADE coverage

Pełna mapa FK z `src/shared/lib/schema.ts` i `drizzle/migrations/`:

| Tabela                  | FK do `user`                       | CASCADE?    | Czy czyści się auto? | Źródło                           |
| ----------------------- | ---------------------------------- | ----------- | -------------------- | -------------------------------- |
| `account`               | `userId` → `user.id`               | ✅ CASCADE  | ✅ Tak               | `schema.ts:28`, `0000_*.sql:39`  |
| `session`               | `userId` → `user.id`               | ✅ CASCADE  | ✅ Tak               | `schema.ts:51`, `0000_*.sql:40`  |
| `session_result`        | `user_id` → `user.id`              | ✅ CASCADE  | ✅ Tak               | `schema.ts:107`, `0001_*.sql:43` |
| `session_event`         | `session_id` → `session_result.id` | ✅ CASCADE  | ✅ Tak (pośredni)    | `schema.ts:126`, `0001_*.sql:41` |
| **`verificationToken`** | **brak FK**                        | ❌ **BRAK** | ❌ **NIE**           | `0000_*.sql:32-37`               |

Ścieżka cascade po hard-delete usera:

```
DELETE "user"
├── account (bezpośredni CASCADE)
├── session (bezpośredni CASCADE)
└── session_result (bezpośredni CASCADE)
    └── session_event (pośredni CASCADE via session_result.id)
```

Tabele bez danych usera (nie wymagają cleanup):

- `scenario` — dane treści klinicznych, bez userId
- `diagnostic_test` — katalog badań, bez userId
- `test_classification` — mapowanie scenariusz→badanie, bez userId

### Luka: `verificationToken` bez CASCADE

`verificationToken` jest tabelą Auth.js dla email verification tokenów:

- `drizzle/migrations/0000_robust_dragon_lord.sql:32-37` — PK:
  `(identifier, token)`, brak FK do `user`
- `identifier` przechowuje email użytkownika, ale bez FK constraint
- Po hard-delete usera: wiersze z emailem usuniętego usera **pozostają w DB**

**Ocena ryzyka RODO**: Tokeny weryfikacyjne zawierają email (PII). Jeśli
użytkownik wygenerował token (np. podczas rejestracji lub próby zmiany emaila),
ten rekord przeżyje 30-dniowy cleanup.

**Skrypt `cleanup-expired-accounts.mjs` nie ma logiki do czyszczenia
`verificationToken`** — wymaga rozszerzenia.

### Stan testów cleanup/retencji (zerowe pokrycie)

Istniejące pliki testowe w projekcie:

```
src/__tests__/e2e/auth-boundary.spec.ts
src/__tests__/e2e/login-form.spec.ts
src/__tests__/e2e/session-flow.spec.ts
src/__tests__/e2e/seed.spec.ts
src/modules/session/actions.test.ts
src/modules/session/queries.test.ts
src/modules/session/components/SessionView/SessionView.test.tsx
src/modules/session/components/SessionView/SessionView.reorder.test.ts
src/shared/lib/validator.test.ts
```

**0 plików testowych** dla:

- `scripts/cleanup-expired-accounts.mjs`
- `src/modules/account/actions.ts` (`requestDeletionAction`,
  `cancelDeletionAction`)
- logiki granicy 30 dni
- weryfikacji cascade

Z `context/changes/account-deletion/plan.md:336-342` (Progress):

- `[x] 3.1` — skrypt uruchamia się bez błędu (commit e1f3a2d) — ale to ręczna
  weryfikacja, nie test
- `[ ] 3.2` — `workflow_dispatch` w GitHub Actions — pending
- `[ ] 3.3` — test row z 31 days usunięty przez skrypt — pending
- `[ ] 3.4` — login po hard-delete odrzucony — pending

### cleanup.yml — analiza akcji

`.github/workflows/cleanup.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch: # on-demand manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: node scripts/cleanup-expired-accounts.mjs
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Obserwacje dotyczące cleanup.yml**:

- Akcja ma `workflow_dispatch` — można uruchomić ręcznie bez dodatkowego
  zatwierdzenia
- Brak `permissions` — używa domyślnych minimal GitHub permissions
- Brak `environment` protection rules — żadne approval przed wykonaniem
- `actions/checkout@v6` i `actions/setup-node@v6` — uwaga: v6 jest przyszłą
  wersją (aktualnie stabilne to v4); to prawdopodobnie błąd, który nie blokuje
  działania ale może powodować ostrzeżenia

## Code References

- `scripts/cleanup-expired-accounts.mjs:1-24` — pełny skrypt cleanup
- `scripts/cleanup-expired-accounts.mjs:12-16` — SQL z warunkiem 30 dni
- `.github/workflows/cleanup.yml:1-26` — workflow GitHub Actions
- `src/shared/lib/schema.ts:11-20` — definicja tabeli `user` z
  `deletionRequestedAt`
- `src/shared/lib/schema.ts:20` — kolumna `deletionRequestedAt`
- `src/shared/lib/schema.ts:23-44` — tabela `account` z FK CASCADE
- `src/shared/lib/schema.ts:47-53` — tabela `session` z FK CASCADE
- `src/shared/lib/schema.ts:101-118` — tabela `session_result` z FK CASCADE
- `src/shared/lib/schema.ts:120-134` — tabela `session_event` z FK CASCADE (via
  session_result)
- `src/shared/lib/schema.ts:55-63` — tabela `verificationToken` — **brak FK**
- `drizzle/migrations/0002_swift_the_phantom.sql:1` — migracja dodająca
  `deletion_requested_at`
- `drizzle/migrations/0000_robust_dragon_lord.sql:39-40` — FK CASCADE dla
  `account` i `session`
- `drizzle/migrations/0001_secret_nicolaos.sql:41-43` — FK CASCADE dla
  `session_event` i `session_result`
- `context/changes/account-deletion/plan.md:336-342` — Progress Phase 3
  (częściowo pending)
- `context/changes/account-deletion/research.md` — historyczne badanie
  mechanizmu (2026-06-02)

## Architecture Insights

1. **GitHub Actions jest jedynym mechanizmem cleanup** — nie Worker scheduled
   handler, nie cron na poziomie DB. Wybrano ze względu na dostępność
   `DATABASE_URL` jako GitHub Secret bez potrzeby dodawania Worker secrets.

2. **Cascade jest wystarczający dla 4/5 tabel z danymi usera** — hard-delete
   `user` automatycznie czyści `account`, `session`, `session_result`,
   `session_event`. Architektura była projektowana z myślą o tym.

3. **`verificationToken` jest ślepą plamą** — nie ma FK do `user`, nie jest
   objęta CASCADE, skrypt jej nie czyści. Dla pełnej zgodności z RODO skrypt
   musi zostać rozszerzony o
   `DELETE FROM "verificationToken" WHERE identifier = $email` (lub batch po
   emailach usuniętych userów używając RETURNING).

4. **Warunek granicy: strict less-than** — `< NOW() - INTERVAL '30 days'`
   eliminuje user w dniu 30+ε (nie exactly 30 days). To zachowanie jest zgodne z
   intencją (co najmniej 30 dni grace period), ale testy muszą pokrywać dokładną
   granicę.

5. **Skrypt jest testowalny tylko przez integrację** — używa `postgres.js`
   bezpośrednio z `DATABASE_URL`. Nie ma możliwości unit testu bez mockowania
   całego klienta DB (co ukryłoby granicę SQL). Właściwa warstwa testowa to
   integracyjna z test DB lub wyizolowana przez `vi.spyOn`.

6. **`actions/checkout@v6` i `actions/setup-node@v6` w workflow** — aktualnie
   stabilne to v4; v6 prawdopodobnie zostanie rozwiązane jako v4 przez GitHub
   Actions (major version pinning), ale warto zweryfikować przed następną
   iteracją.

## Historical Context (from prior changes)

- `context/changes/account-deletion/research.md` (2026-06-02) — pełne badanie:
  decyzja GH Actions vs Cloudflare Cron, CASCADE coverage, JWT caveat, brak RLS.
  Obecne badanie potwierdza wszystkie ustalenia i dodaje: `verificationToken`
  luka, zerowe pokrycie testów, analiza `cleanup.yml`.
- `context/changes/account-deletion/plan.md:285` — plan.md zaplanował
  **manualny** test cleanup, nie zautomatyzowany — stąd zerowe pokrycie testów.
- `context/changes/auth-scaffold/plan.md:39` — `{ prepare: false }` jest
  nienaruszalne dla Supabase PgBouncer; potwierdzone w skrypcie cleanup.

## Open Questions

1. **verificationToken cleanup**: Czy rozszerzyć `cleanup-expired-accounts.mjs`
   o
   `DELETE FROM "verificationToken" WHERE identifier IN (SELECT email FROM deleted_users)`
   używając `RETURNING email`? To jest zakres Fazy 6 — wchodzi do planu.

2. **`actions/checkout@v6` i `setup-node@v6`**: Czy to celowe (pre-release
   pinning) czy błąd copyPaste? Nie blokuje działania, ale warto sprawdzić.
   Aktualnie stabilne GitHub Actions są na v4.

3. **Testowanie cascade w Fazie 6**: Testy CASCADE
   (`DELETE user → session_result gone`) wymagają prawdziwego DB (test schema).
   Czy `DATABASE_URL_TEST` jest dostępne (wzorzec z Fazy 2)? Tak — patrz
   `src/modules/session/actions.test.ts` — wzorzec
   `describe.skipIf(!process.env.DATABASE_URL_TEST)`.

4. **Scope Fazy 6**: Badanie ujawniło, że scope jest szerszy niż tylko "test
   granicy 30 dni". Faza 6 powinna obejmować:
   - Test jednostkowy logiki granicy (mockowany `postgres.js`)
   - Test integracyjny cascade (prawdziwy test DB)
   - Fix: rozszerzenie skryptu o cleanup `verificationToken`
   - Test rozszerzonego skryptu
