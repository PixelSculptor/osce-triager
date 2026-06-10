---
date: 2026-06-09T20:30:57+00:00
researcher: Claude Sonnet 4.6
git_commit: 0640e3a9b7a86db7c56ea24e7e903ed3cf5dff73
branch: update-test-plan
repository: osce-traiger
topic: "Phase 2 rollout — data isolation (Risk #2) and session persistence (Risk #3)"
tags: [research, testing, session, idor, drizzle, integration]
status: complete
last_updated: 2026-06-09
last_updated_by: Claude Sonnet 4.6
---

# Research: Phase 2 — Data Isolation + Session Persistence

**Date**: 2026-06-09T20:30:57+00:00
**Researcher**: Claude Sonnet 4.6
**Git Commit**: 0640e3a9b7a86db7c56ea24e7e903ed3cf5dff73
**Branch**: update-test-plan
**Repository**: osce-traiger

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md`: verify the real failure paths for Risk #2 (cross-account IDOR on session detail page) and Risk #3 (`endSessionAction` silent DB write failure), locate existing test infrastructure, and confirm or correct the risk response guidance.

---

## Summary

Both risks are **confirmed real**. Risk #2 has a partial mitigation already in place at the application layer but the underlying query is still unsafe. Risk #3 has no transaction and a swallowed exception handler that hides write failures. The test infrastructure is already set up from Phase 1 and has an established pattern to follow.

**Corrections to test plan §2:**
- Risk #2 guidance names `getSessionById(userId, wrongOwnerSessionId)` as the test target, but the real function signature is `getSessionById(sessionId: string)` — it does not accept userId. The test plan's intent was correct (the function should filter by userId), but the implementation plan must account for a query-layer code change: add userId parameter to `getSessionById`. A correctly scoped pattern already exists in the same file (`getSessionDetails`).
- Risk #2 application-layer mitigation IS present in the page (line 24 of page.tsx checks `sessionResult.userId !== session.user.id`). The page itself does not currently leak data. The risk is real at the query layer and at any future callsite of `getSessionById`.

---

## Detailed Findings

### Risk #2 — IDOR: query-layer vulnerability + page-layer mitigation

#### Session detail page
`src/app/dashboard/session/[sessionId]/page.tsx`
- Route: `/dashboard/session/[sessionId]`
- Auth: calls `auth()` at line 20, redirects to `/login` if no session.user.id (line 21)
- Data fetch: calls `getSessionById(sessionId)` at line 23
- **Application-layer mitigation** (line 24): `if (!sessionResult || sessionResult.userId !== session.user.id) notFound()`

This means the page CURRENTLY returns 404 for a cross-account request. The risk at the page level is mitigated by the app-layer check. However, the query function itself is unsafe.

#### Vulnerable query function
`src/modules/session/queries.ts:17-24`

```typescript
export async function getSessionById(sessionId: string) {
  const [row] = await db
    .select()
    .from(sessionResults)
    .where(eq(sessionResults.id, sessionId))   // ← only sessionId, NO userId
    .limit(1)
  return row ?? null
}
```

The `.where()` clause (line 21) filters only by `sessionId`. It will return any user's session row to any caller. The protection exists only at the page level — not at the query level.

#### Also vulnerable (no userId filter)
`src/modules/session/queries.ts:46-52` — `getSessionEvents(sessionId)`:

```typescript
export async function getSessionEvents(sessionId: string) {
  return db
    .select()
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))  // ← no userId
    .orderBy(sessionEvents.selectedAt)
}
```

#### Correct pattern (already in codebase — use as reference)
`src/modules/session/queries.ts:69-112` — `getSessionDetails(sessionId, userId)`:

```typescript
.where(
  and(
    eq(sessionResults.id, sessionId),
    eq(sessionResults.userId, userId),   // ← both conditions
    ne(sessionResults.outcome, "in_progress")
  )
)
```

This is the pattern to replicate in `getSessionById`.

#### Auth source
`src/modules/auth/auth.ts:28-31` — JWT sub maps to `session.user.id`:

```typescript
session({ session, token }) {
  if (token.sub) session.user.id = token.sub
  return session
}
```

userId is reliable for authorization; it comes from the JWT sub claim.

#### Plan implication for Risk #2
The test for Risk #2 requires a **code change** before the test can be written:
1. Add `userId: string` parameter to `getSessionById` (matching `getSessionDetails` pattern)
2. Add `eq(sessionResults.userId, userId)` to the `.where()` clause
3. Update the page.tsx call site
4. Write integration test: `getSessionById(wrongUserId, sessionId)` → null

The existing application-layer check in page.tsx (line 24) can be kept as defense-in-depth after the query is fixed.

---

### Risk #3 — Silent write: confirmed no transaction, swallowed exceptions

#### endSessionAction full write path
`src/modules/session/actions.ts:104-207`

**Two independent writes (no transaction):**

Write 1 — update outcome (line 150-163):
```typescript
const claimed = await db
  .update(sessionResults)
  .set({
    outcome: irreversibleFail ? "negative" : "positive",
    isFailed: irreversibleFail,
    completedAt: new Date(),
  })
  .where(
    and(
      eq(sessionResults.id, sessionId),
      eq(sessionResults.outcome, "in_progress")
    )
  )
  .returning()
```

Write 2 — insert skipped-critical events (line 190-196, conditional):
```typescript
if (skippedCritical.length > 0) {
  await db.insert(sessionEvents).values(
    skippedCritical.map((testId) => ({
      sessionId,
      testId,
      validatorResult: "critical_miss" as const,
    }))
  )
}
```

**No `.transaction()` call exists anywhere in the codebase.** Confirmed by grep: zero hits on `.transaction` in `src/`.

**Swallowed exception handler (lines 204-206):**
```typescript
} catch {
  return { error: "Internal error" }
}
```
All DB failures — connection error, constraint violation, timeout — collapse to `{ error: "Internal error" }` with no logging or rethrow.

**All awaits are present.** Missing await is NOT the failure mode. The risk is a DB error that fires the catch block.

#### getUserSessions — the read side of the round-trip
`src/modules/session/queries.ts:54-67`

```typescript
export async function getUserSessions(userId: string) {
  return db
    .select({
      id: sessionResults.id,
      outcome: sessionResults.outcome,
      startedAt: sessionResults.startedAt,
      completedAt: sessionResults.completedAt,
      scenarioTitle: scenarios.title,
    })
    .from(sessionResults)
    .innerJoin(scenarios, eq(sessionResults.scenarioId, scenarios.id))
    .where(and(eq(sessionResults.userId, userId), ne(sessionResults.outcome, "in_progress")))
    .orderBy(desc(sessionResults.completedAt))
}
```

Returns both `outcome` and `completedAt`. Filters to `outcome != "in_progress"`. If the `db.update()` write fails silently, `outcome` stays `"in_progress"` and the row is excluded from this query — the session never appears in history. This confirms the failure mode.

#### Race condition path (informational — not a test target for Phase 2)
Lines 165-187: if `claimed.length === 0` (another request ended the session first), the function reads and returns the current row. This is a read-after-write without a transaction — stale data is possible but unlikely in this use case. Not a Phase 2 test target; note for Phase 5 if needed.

---

### DB schema (test fixture construction)

`src/shared/lib/schema.ts:101-118` — `sessionResults` table:

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK, `crypto.randomUUID()` |
| `userId` | text | notNull, FK → users.id CASCADE |
| `scenarioId` | text | notNull, FK → scenarios.id RESTRICT |
| `outcome` | text `"in_progress"\|"positive"\|"negative"` | notNull, default `"in_progress"` |
| `isFailed` | boolean | notNull, default false |
| `startedAt` | timestamp | notNull, defaultNow() |
| `completedAt` | timestamp | **nullable** |

The `completedAt` column is nullable — a session that never completes will have `null` here. The integration test oracle: after `endSessionAction`, `completedAt` must be non-null and `outcome` must be `"positive"` or `"negative"`.

`src/shared/lib/schema.ts:85-99` — `testClassifications` table (needed for `endSessionAction` fixture):

Composite PK on `(scenarioId, testId)`. Classifications: `"critical" | "optimal" | "acceptable" | "unnecessary"`.

---

### Test infrastructure (already in place)

#### vitest config
`vitest.config.ts:1-16` — environment: `node`, includes `src/**/*.test.ts`, setupFiles: `./vitest.setup.ts`

#### Test DB wiring
`vitest.setup.ts:1-10` — loads `.env.test`, then replaces `DATABASE_URL` with `DATABASE_URL_TEST` before any imports. This means `db.ts` picks up the test DB when first loaded.

`.env.test:1` — `DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:54322/postgres` (local Supabase).

**The DB URL is already configured.** No new env setup needed.

#### Existing integration test pattern to follow
`src/modules/session/actions.test.ts` — covers `selectTestAction`, does NOT cover `endSessionAction` or `getSessionById`. Establishes the pattern:

```typescript
const runIntegration = !!process.env.DATABASE_URL_TEST

vi.mock('@/modules/auth/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
}))

describe.skipIf(!runIntegration)('integration — real DB', () => {
  beforeAll(async () => {
    // insert fixtures in FK order: users → scenarios → tests → classifications → sessionResults
  })
  afterAll(async () => {
    // delete in reverse FK order
  })
  // tests here
})
```

The mock for `auth` is the correct approach — it avoids needing a real JWT while still providing a known `userId`.

---

## Code References

- `src/modules/session/queries.ts:17-24` — `getSessionById` (unsafe, no userId filter)
- `src/modules/session/queries.ts:46-52` — `getSessionEvents` (unsafe, no userId filter)
- `src/modules/session/queries.ts:54-67` — `getUserSessions` (safe, userId-scoped)
- `src/modules/session/queries.ts:69-112` — `getSessionDetails` (safe, userId-scoped — reference pattern)
- `src/app/dashboard/session/[sessionId]/page.tsx:20-24` — auth check + app-layer userId guard
- `src/modules/session/actions.ts:104-207` — `endSessionAction` full body
- `src/modules/session/actions.ts:150-163` — primary DB write (update)
- `src/modules/session/actions.ts:190-196` — secondary DB write (insert, conditional)
- `src/modules/session/actions.ts:204-206` — swallowed exception catch block
- `src/shared/lib/schema.ts:101-118` — `sessionResults` table definition
- `src/shared/lib/schema.ts:85-99` — `testClassifications` table definition
- `src/modules/session/actions.test.ts` — existing integration test (pattern reference)
- `vitest.setup.ts:1-10` — DB URL swap before imports
- `.env.test:1` — test DB URL (already configured)

---

## Architecture Insights

1. **Query-layer safety is inconsistent.** `getSessionDetails` and `getUserSessions` scope by userId; `getSessionById` and `getSessionEvents` do not. The safer pattern is established — it just needs to be applied to the two unsafe functions.

2. **No transaction usage anywhere in the codebase.** This is a deliberate or incidental pattern; either way, Phase 2 tests cannot rely on rollback behavior. Tests for Risk #3 must use fixture teardown (`afterAll` deletes) rather than transaction rollback.

3. **`endSessionAction` uses optimistic concurrency** (the `AND outcome = "in_progress"` WHERE clause) rather than a transaction. This is a valid pattern but means partial failure is possible — the update can succeed while a later insert fails, with no rollback.

4. **The test DB is Supabase local** (`127.0.0.1:54322`). Supabase local must be running for integration tests to execute. Plan should note this prerequisite.

---

## Historical Context

- `context/changes/testing-runner-bootstrap/` — Phase 1. Installed Vitest, wrote first unit tests and integration tests for `selectTestAction`. Established the `describe.skipIf(!runIntegration)` pattern and the `.env.test` / `vitest.setup.ts` wiring. Phase 2 builds directly on this infrastructure.

---

## Open Questions

1. **Should `getSessionEvents` also be fixed in Phase 2?** It has the same missing userId filter. It is used alongside `getSessionById` in the session detail page. If `getSessionById` is fixed but `getSessionEvents` is not, a caller could still enumerate events for another user's session. Recommend fixing both in the same plan phase to close the surface completely.

2. **Race condition in `endSessionAction` (lines 165-187):** The stale-read path is not a Phase 2 target. Note for future phases if concurrent session termination becomes a real scenario.

3. **`getSessionEvents` userId scoping:** `sessionEvents` has no direct `userId` column — userId would need to be verified via a JOIN to `sessionResults`. This adds complexity to the fix. Plan should choose: either add a JOIN to filter via sessionResults.userId, or validate userId in the caller (matching the page's current pattern).
