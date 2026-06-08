---
date: 2026-06-08T18:55:19+0000
researcher: Claude Sonnet 4.6
git_commit: 7e36257bf7f1c73704e20c6ecbdd4806948b012d
branch: test-plan
repository: osce-traiger
topic: "Risk #1 — validator classification failure + Vitest bootstrap for Next.js 16 + Cloudflare Workers"
tags: [research, validator, classification, vitest, test-infrastructure, session-flow]
status: complete
last_updated: 2026-06-08
last_updated_by: Claude Sonnet 4.6
---

# Research: Risk #1 — Validator classification failure + Vitest bootstrap

**Date**: 2026-06-08T18:55:19+0000
**Git Commit**: 7e36257bf7f1c73704e20c6ecbdd4806948b012d
**Branch**: test-plan
**Repository**: osce-traiger

## Research Question

Risk #1: Student selects the correct life-saving test; validator returns "critical error" instead.
Session outcome is wrong with no crash or visible signal.

Ground the real failure path in code, verify Vitest compatibility with Next.js 16 +
Cloudflare Workers, locate the cheapest useful test layer, and flag speculative risks or
misleading hot-spot evidence.

## Summary

The risk name contains a factual inaccuracy — the validator cannot return "critical error"
or "critical_miss" during test selection. The *real* failure modes are narrower and more
testable:

1. **Primary**: `selectTestAction` loads classifications from DB; if the query returns an
   empty result (or a wrong scenarioId), `validateTestSelection` silently defaults every
   test to `"unnecessary"` (via `?? "unnecessary"`). The correct test appears tagged
   "Zbędne" with no exception and no signal. This is the true Risk #1 failure path.

2. **Secondary**: `endSessionAction` swallows all DB errors in a bare `catch` (line 204).
   If the final DB update fails, the session stays `"in_progress"` forever; `handleEndSession`
   in the UI checks `result.outcome` (which is `undefined` when there's an error) and silently
   resets — no error shown to the student. This is the Risk #3 failure path surfacing in a
   different place.

`"critical_miss"` is a *synthetic* event written only by `endSessionAction` at session end
for critical tests that were never selected. It is never returned by `validateTestSelection`.
The outcome enum is `"in_progress" | "positive" | "negative"` — "critical_error" does not exist.

**Test-plan §2 correction needed**: "validator returns 'critical error'" should read
"validator defaults correct test to 'unnecessary' when classifications fail to load".

**Vitest verdict**: No blocking compatibility issues for unit + integration tests of the
validator and session actions. Edge-runtime concerns (middleware) are Phase 3 only.

## Detailed Findings

### Validator function

**File**: `src/shared/lib/validator.ts`

```typescript
// lines 3-5
export type TestCategory = "critical" | "optimal" | "acceptable" | "unnecessary"
export type ValidatorResult = "correct" | "suboptimal" | "unnecessary" | "critical_miss"

// lines 17-22
export const CATEGORY_TO_RESULT: Record<TestCategory, ValidatorResult> = {
  critical: "correct",
  optimal:  "correct",
  acceptable: "suboptimal",
  unnecessary: "unnecessary",
}

// lines 24-29
export function validateTestSelection(
  testId: string,
  classifications: Record<string, TestCategory>
): TestValidationResult {
  const category = classifications[testId] ?? "unnecessary"   // ← silent default
  return { category, validatorResult: CATEGORY_TO_RESULT[category] }
}
```

`validateTestSelection` can only return `"correct"`, `"suboptimal"`, or `"unnecessary"`.
It **never** returns `"critical_miss"`.

**Secondary function** (`validator.ts:32-41`):
```typescript
export function evaluateSessionEnd(
  orderedTestIds: string[],
  classifications: Record<string, TestCategory>
): SessionEndResult {
  const ordered = new Set(orderedTestIds)
  const skippedCritical = Object.entries(classifications)
    .filter(([id, cat]) => cat === "critical" && !ordered.has(id))
    .map(([id]) => id)
  return { irreversibleFail: skippedCritical.length > 0, skippedCritical }
}
```

This is called only at session end. It does not return error strings.

### Classification data source

**File**: `src/shared/lib/schema.ts:85-99` — `testClassifications` table
(`scenarioId TEXT + testId TEXT`, composite PK).

**Loaded in**: `src/modules/session/actions.ts:82-90` (inside `selectTestAction`):
```typescript
const classificationRows = await db
  .select()
  .from(testClassifications)
  .where(eq(testClassifications.scenarioId, sessionRow.scenarioId))

const classifications: Record<string, TestCategory> = {}
for (const row of classificationRows) {
  classifications[row.testId] = row.classification as TestCategory
}
```

**Silent failure path** (Risk #1's real mechanism): if `classificationRows` is empty
(wrong `scenarioId`, query bug, missing seed data), `classifications` is `{}`. The next call:
```typescript
const { category, validatorResult } = validateTestSelection(testId, classifications)
```
…returns `{ category: "unnecessary", validatorResult: "unnecessary" }` for *every* test,
including critical ones. No exception is thrown. DB receives `validatorResult: "unnecessary"`.
UI shows badge "Zbędne". Session ends with all critical tests counted as skipped → outcome `"negative"`.

**Seed data**: `src/shared/lib/seed.ts` — 36 rows hardcoded (2 scenarios × 18 tests).
Inserted idempotently via `onConflictDoNothing()`. Examples:
- `dt-001` (EKG): critical for Scenario 1, acceptable for Scenario 2
- `dt-003` (Glukoza): acceptable for S1, **critical** for S2
- `dt-004` (KT głowy): unnecessary for S1, **critical** for S2

Seed data is deliberately excluded from tests (test-plan §7). Fixture records in tests must
replicate the same [scenarioId, testId, classification] tuples in a test schema.

### selectTestAction — primary call site

**File**: `src/modules/session/actions.ts:54-102`

```
line 82-90:  load classifications from DB
line 94:     const { category, validatorResult } = validateTestSelection(testId, classifications)
line 96:     await db.insert(sessionEvents).values({ sessionId, testId, validatorResult })
line 98:     return { validatorResult, category }
lines 99-101: catch { return { error: "Internal error" } }   ← bare swallow, no logging
```

The caller does NOT guard against `classifications` being empty before invoking the validator.
That is the gap a test must cover.

### endSessionAction — silent error paths

**File**: `src/modules/session/actions.ts:104-207`

Relevant silent-failure lines:
- `lines 49-51`: `startSessionAction` catch — generic error, no log
- `lines 99-101`: `selectTestAction` catch — generic error, no log
- `lines 204-206`: `endSessionAction` catch — generic error, no log

If `endSessionAction` throws (DB update fails at line 151):
- Returns `{ error: "Internal error" }` to client
- **Client handler** (`SessionView.tsx:128-135`): checks `if (result.outcome)` → falsy → enters
  else branch, resets `endingRef.current = false` / `setIsEnding(false)`
- Student sees spinner disappear. Session stays `"in_progress"` in DB. No error message rendered.

This is a real failure path but it belongs to Risk #3 (session write silently fails), not Risk #1.
Phase 1 tests should cover the validator isolation case only; the endSessionAction round-trip test
belongs in Phase 2.

### `"critical_miss"` origin

**File**: `src/modules/session/actions.ts:190-197`

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

`"critical_miss"` is **only** inserted here, by `endSessionAction`, for critical tests the student
never selected. `TestCard.tsx:14-18` (`BADGE_LABELS`) has no entry for `"critical_miss"`, so if it
were ever returned during active selection, it would render as no badge — a silent failure. But
it cannot reach this path through the normal flow.

### Existing tests

None. No `.test.ts`, `.spec.ts`, `.test.tsx`, `.spec.tsx` files in `src/`. No test runner
configuration in the project root. No `test` script in `package.json`.

### Vitest compatibility assessment

**package.json key deps**:
- `next`: `16.2.6`
- `react`: `19.2.4`
- `@opennextjs/cloudflare`: `1.19.11`
- `wrangler`: `^4.94.0`
- No test runner, no test script

**tsconfig.json**:
- `target: "ES2017"`, `module: "esnext"`, `moduleResolution: "bundler"` — all Vitest-compatible
- JSX: `react-jsx` — compatible
- No `types` array blocking Vitest globals

**Compatibility verdict**:

| Concern | Phase 1 impact | Phase 3 impact |
|---------|---------------|----------------|
| RSC server/client boundary | Low — validator.ts is plain TS, no RSC imports | Medium — need to mock `"use server"` context |
| Edge runtime (Cloudflare Workers) | None — validator unit tests run in Node.js/jsdom | High — middleware runs on Edge; may need miniflare |
| Drizzle ORM in integration tests | Medium — needs real Supabase test schema URL | Medium — same |
| `moduleResolution: "bundler"` | Compatible with Vitest ≥ 1.x | Same |

**Phase 1 only needs**:
- `vitest` + `@vitest/globals` in devDeps
- A `vitest.config.ts` with `environment: "node"` (no DOM needed for validator unit tests)
- A `test` script in `package.json` (lessons.md: verify the script exists before the plan names it)
- No mocks, no Edge runtime — pure unit tests on `validateTestSelection` with fixture objects

**No blocking compatibility issues for Phase 1.**

## Code References

- `src/shared/lib/validator.ts:3-5` — `TestCategory` and `ValidatorResult` type definitions
- `src/shared/lib/validator.ts:17-22` — `CATEGORY_TO_RESULT` mapping
- `src/shared/lib/validator.ts:24-29` — `validateTestSelection` function (the primary test target)
- `src/shared/lib/validator.ts:32-41` — `evaluateSessionEnd` (session-end path, Phase 2)
- `src/modules/session/actions.ts:82-90` — DB load of classifications inside `selectTestAction`
- `src/modules/session/actions.ts:94` — `validateTestSelection` call site
- `src/modules/session/actions.ts:96` — DB insert of `validatorResult`
- `src/modules/session/actions.ts:99-101` — bare catch (no logging)
- `src/modules/session/actions.ts:190-197` — where `"critical_miss"` is generated
- `src/modules/session/actions.ts:204-206` — `endSessionAction` bare catch
- `src/modules/session/components/SessionView.tsx:128-135` — `handleEndSession` silent failure
- `src/modules/session/components/TestCard.tsx:14-18` — `BADGE_LABELS` (no entry for `critical_miss`)
- `src/shared/lib/schema.ts:85-99` — `testClassifications` table schema
- `src/shared/lib/schema.ts:111-114` — `sessionResults.outcome` enum
- `src/shared/lib/seed.ts` — 36 classification fixture rows (source for test fixtures)
- `package.json:1-46` — no test deps, no test script

## Architecture Insights

**Validator is pure**: `validateTestSelection` takes only a `testId` string and a plain
`Record<string, TestCategory>`. It has zero side effects. This makes it trivially unit-testable
with inline fixture objects — no DB mock, no module mock, no RSC context needed.

**The dangerous gap is in the caller**: `selectTestAction` does not validate that `classifications`
is non-empty before calling the validator. An empty map silently degrades every test to
"unnecessary". The test that catches Risk #1 must live at the *integration* boundary
(selectTestAction + real-or-stubbed DB), not only at the pure unit level — because the pure unit
test of `validateTestSelection` alone cannot detect the empty-map silent default.

**Two test layers needed for Phase 1**:
1. Unit test of `validateTestSelection` with fixture objects — proves the mapping table is correct
   and establishes the oracle (expected values from classification table, never from the validator
   itself).
2. Integration test of `selectTestAction` with a real test schema (or a Drizzle query stub) —
   proves that classifications are actually loaded and passed correctly, catching the empty-map
   failure mode.

**Lesson from lessons.md**: Every `npm run <script>` named in the plan must exist in
`package.json` before the plan is written. Phase 1 plan must add `"test"` to scripts first.

## Historical Context

- `context/changes/first-playable-session/plan.md:160-210` — original validator contract;
  implementation matches exactly what is in `validator.ts` today.
- `context/changes/first-playable-session/research.md:94-122` — "unnecessary" was added to
  the `validatorResult` type as a TypeScript-only change (no migration). Type annotation now:
  `"correct" | "suboptimal" | "unnecessary" | "critical_miss"`.
- `context/changes/first-playable-session/reviews/impl-review.md` — F3 fix added try/catch to
  session actions (bare catch returning `{ error: "Internal error" }`). The catch is there; it
  just doesn't log. Phase 1 tests should assert that the validator path does *not* silently
  degrade when called correctly.
- `context/changes/first-playable-session/classification-algorithm-research.md` — academic basis
  for the 4-tier model (ESR/ACR). The determinism requirement is PRD-level: validator must be
  server-side only.

## Risk Response Guidance — corrected

| Aspect | Research finding |
|--------|----------------|
| Risk name correction | "validator returns 'critical error'" → "validator silently returns 'unnecessary' when classifications fail to load" |
| What would prove protection | Unit: `validateTestSelection("dt-001", { "dt-001": "critical" })` → `{ category: "critical", validatorResult: "correct" }`. Integration: `selectTestAction` with real schema + correct scenarioId → `validatorResult: "correct"`. The empty-map case must be a separate test. |
| Must challenge | "Validator returned non-null, therefore correct" — still valid. Add: "Classifications loaded, therefore non-empty" — the map can be empty with no error thrown. |
| Required context — grounded | Classifications loaded per-request in `selectTestAction` from `testClassifications` table. Lookup keyed by `scenarioId`. Empty result → silent "unnecessary" default. No guard in caller. |
| Cheapest layer — confirmed | Pure unit test for `validateTestSelection` mapping (no DB). Separate integration test for `selectTestAction` + DB query (real test schema recommended per Risk #3 anti-pattern note; mocking Drizzle hides the empty-result gap). |
| Anti-pattern confirmed | Mirror-implementation oracle. Do NOT derive expected `validatorResult` from `CATEGORY_TO_RESULT` in the test — use the plain English classification table as the oracle ("critical test → result must be 'correct'"). |

## Open Questions

1. **Supabase test schema URL**: Phase 1 integration tests need a separate test DB
   (or at minimum a separate schema). Where should `DATABASE_URL_TEST` be configured?
   Research did not locate a `.env.test` or Supabase test project reference.

2. **Vitest workspace vs single config**: Should Phase 1 use a single `vitest.config.ts`
   with `environment: "node"`, or already set up workspaces for future Phase 4 DOM tests?
   Simpler to start with a single config and add workspaces when Phase 4 is planned.

3. **`@opennextjs/cloudflare` dev init in `next.config.ts`**: Line 9 imports a Cloudflare
   dev initializer. Vitest will import `next.config.ts` indirectly — confirm this import
   does not throw in a Node.js test process (it likely conditionally no-ops outside of
   Wrangler context, but Phase 1 plan should verify).
