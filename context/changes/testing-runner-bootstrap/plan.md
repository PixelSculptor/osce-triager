# Testing Runner Bootstrap — Implementation Plan

## Overview

Install Vitest, prove the first test passes, and cover Risk #1 with two test layers:
1. Unit tests on `validateTestSelection` and `evaluateSessionEnd` with inline fixture objects — no DB
2. Integration test on `selectTestAction` with a real Supabase test schema

## Current State Analysis

No test runner is installed. No `test` script exists in `package.json`. The codebase has zero `.test.ts` files. `validator.ts:1` has `import "server-only"` which Vitest must resolve to an empty mock. `actions.ts:0` has `"use server"` — a no-op string in Vitest's Node.js environment.

**Key finding vs research**: The research summary stated "the caller does NOT guard against an empty classifications map." The actual code at `actions.ts:92` contradicts this: `if (!(testId in classifications)) return { error: "Test not in scenario" }`. The silent `?? "unnecessary"` default in `validateTestSelection` fires only when the function is called directly; at the action level, an unknown testId already returns an error. Both behaviours must be tested — unit test documents the pure-function default, integration test proves the action-level guard.

## Desired End State

`npm run test` passes from a clean checkout (integration tests skip gracefully when `DATABASE_URL_TEST` is not set). `npm run typecheck` and `npm run lint` continue to pass. §6.1 of `test-plan.md` has the cookbook entry filled in.

### Key Findings

- `src/shared/lib/validator.ts:1` — `import "server-only"` must be aliased to an empty mock in `vitest.config.ts`
- `src/modules/session/actions.ts:0` — `"use server"` is a no-op in Vitest Node.js environment
- `src/modules/session/actions.ts:92` — `if (!(testId in classifications)) return { error: "Test not in scenario" }` — caller guard is present (diverges from research summary)
- `src/modules/session/actions.ts:58` — `selectTestAction` calls `auth()` from `@/modules/auth/auth`; must be mocked in integration test
- `package.json` — no `test` script; `dotenv` already a devDep (`^17.4.2`)

## What We Are NOT Doing

- No component tests (Phase 4 scope — jsdom + @testing-library)
- No middleware/auth boundary tests (Phase 3 scope)
- No CI YAML changes (Module 1 Lesson 5 scope)
- No coverage reporting setup
- No seed data from `seed.ts` in tests — fixtures are inline per test suite

## Approach

Three discrete phases: infrastructure (Vitest install + config), unit tests for the pure validator, and integration test for the action-level DB path. Integration tests skip gracefully when `DATABASE_URL_TEST` is not set, so `npm run test` passes in CI before the test DB is provisioned.

## Critical Implementation Details

**`server-only` alias**: Vitest will throw on `import "server-only"` in `validator.ts` unless it resolves to an empty module. The alias must live in `vitest.config.ts`'s `resolve.alias` — it applies globally and does not require a `vi.mock()` call in every test file.

**Integration test auth mock**: `selectTestAction:58` calls `auth()` before any DB query. Without a mock returning `{ user: { id: '...' } }`, the action returns `{ error: "Unauthorized" }` and the test never reaches the classification path.

---

## Phase 1: Vitest Installation and Configuration

### Overview

Install Vitest, create config with the `server-only` alias, add npm scripts, and write a smoke test that confirms the alias resolves and the runner starts cleanly. Also verifies the `@opennextjs/cloudflare` import in `next.config.ts` does not throw in a Node.js test process.

### Required Changes

#### 1. `package.json`

**File**: `package.json`

**Purpose**: Add Vitest to devDependencies and add the `test` and `test:watch` scripts that all subsequent phases reference in their success criteria.

**Contract**: Add `"vitest": "^3"` to `devDependencies`. Add `"test": "vitest run"` and `"test:watch": "vitest"` to `scripts`. These are the only script names the plan references in success criteria.

#### 2. `__mocks__/server-only.ts` (new file, project root)

**File**: `__mocks__/server-only.ts`

**Purpose**: Empty module that satisfies `import "server-only"` in `validator.ts` when Vitest resolves the alias.

**Contract**: The file can be empty or export a single `export default undefined`. Its existence is what matters.

#### 3. `vitest.config.ts` (new file, project root)

**File**: `vitest.config.ts`

**Purpose**: Single Vitest config shared across all phases. Phase 3 adds `setupFiles`.

**Contract**:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './__mocks__/server-only.ts'),
    },
  },
})
```

The alias for `server-only` is the non-obvious part; other phases depend on it being in place here.

#### 4. `src/__tests__/smoke.test.ts` (new file)

**File**: `src/__tests__/smoke.test.ts`

**Purpose**: Minimal test that imports `validator.ts` and asserts `validateTestSelection` is a callable function. Proves the `server-only` alias resolves and the runner initialises without error. The Cloudflare dev-init in `next.config.ts` is not imported by `validator.ts` — the smoke test confirms no unexpected module-level throws occur.

**Contract**: Import `validateTestSelection` from `@/shared/lib/validator`; `expect(typeof validateTestSelection).toBe('function')`.

### Success Criteria

#### Automated

- `npm run test` exits 0 with 1 passing smoke test
- `npm run typecheck` passes
- `npm run lint` passes

#### Manual

- [ ] `npm run test:watch` starts and watches for file changes without error

---

## Phase 2: Validator Unit Tests

### Overview

Write unit tests for both exported functions in `validator.ts` using inline fixture objects. Oracle: plain English classification semantics ("a critical test must return `'correct'`") — never derive expected `validatorResult` from `CATEGORY_TO_RESULT` in the test.

### Required Changes

#### 1. `src/shared/lib/validator.test.ts` (new file)

**File**: `src/shared/lib/validator.test.ts`

**Purpose**: Unit tests for `validateTestSelection` (all four category mappings + the silent-default case) and `evaluateSessionEnd` (all-selected and one-skipped cases).

**Contract**:

`validateTestSelection` fixture mappings (oracle from classification semantics):
- `("dt-001", { "dt-001": "critical" })` → `{ category: "critical", validatorResult: "correct" }`
- `("dt-001", { "dt-001": "optimal" })` → `{ category: "optimal", validatorResult: "correct" }`
- `("dt-001", { "dt-001": "acceptable" })` → `{ category: "acceptable", validatorResult: "suboptimal" }`
- `("dt-001", { "dt-001": "unnecessary" })` → `{ category: "unnecessary", validatorResult: "unnecessary" }`
- `("dt-001", {})` → `{ category: "unnecessary", validatorResult: "unnecessary" }` — the `?? "unnecessary"` default fires when testId is absent; this test *documents* the silent-default behaviour in the pure function (protection at action level relies on the guard at `actions.ts:92`)

`evaluateSessionEnd` cases:
- All critical testIds present in `orderedTestIds` → `{ irreversibleFail: false, skippedCritical: [] }`
- One critical testId absent → `{ irreversibleFail: true, skippedCritical: ["<critical-id>"] }`
- Non-critical tests never appear in `skippedCritical`

### Success Criteria

#### Automated

- `npm run test` passes with all unit tests
- `npm run typecheck` passes

#### Manual

- [ ] Each test description reads as a sentence from the classification spec, not as a code mirror

---

## Phase 3: `selectTestAction` Integration Test

### Overview

Add `.env.test`, extend `vitest.config.ts` with a dotenv setup file, and write an integration test that calls `selectTestAction` against a real Supabase test schema. Covers the happy path (correct classification → `"correct"`) and the guard path (unknown testId → `{ error: "Test not in scenario" }`). Ends by filling in the §6.1 cookbook entry in `test-plan.md`.

### Required Changes

#### 1. `.env.test.example` (new file, project root, committed)

**File**: `.env.test.example`

**Purpose**: Template documenting which env vars the integration tests require.

**Contract**: Contains `DATABASE_URL_TEST=` (key only, no value).

#### 2. `.env.test` (new file, project root, gitignored)

**File**: `.env.test`

**Purpose**: Actual test DB connection URL, not committed.

**Contract**: Contains `DATABASE_URL_TEST=<supabase-test-project-connection-string>`. Verify `.gitignore` contains `.env.test` (or add it). Obtain the URL from the Supabase test project's connection settings (same format as the production `DATABASE_URL`).

**Prerequisite**: Before the first integration test run, apply the Drizzle schema to the test DB:
```
DATABASE_URL=<test-db-url> npx drizzle-kit push
```
This is a one-time manual step per environment — not automated in the test suite.

#### 3. `vitest.setup.ts` (new file, project root)

**File**: `vitest.setup.ts`

**Purpose**: Load `.env.test` into `process.env` before the test suite runs.

**Contract**:
```ts
import dotenv from 'dotenv'
dotenv.config({ path: '.env.test', override: true })
```
`dotenv` is already a devDep (`^17.4.2`).

#### 4. `vitest.config.ts` (update)

**File**: `vitest.config.ts`

**Purpose**: Register the setup file so `.env.test` is loaded for every test run.

**Contract**: Add `setupFiles: ['./vitest.setup.ts']` to the `test` block.

#### 5. `src/modules/session/actions.test.ts` (new file)

**File**: `src/modules/session/actions.test.ts`

**Purpose**: Integration test for `selectTestAction`. Calls the real function against a real test DB; mocks only `auth()` to supply a test user identity.

**Contract**:

Suite-level skip guard (at the top of the file):
```ts
if (!process.env.DATABASE_URL_TEST) {
  describe.skip('selectTestAction integration', () => {})
} else {
  // all tests go here
}
```

Auth mock (module level, before tests):
```ts
vi.mock('@/modules/auth/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
}))
```

`beforeAll` — insert fixtures into the test schema:
- `sessionResults`: `{ id: 'test-session-1', userId: 'test-user-id', scenarioId: 'test-s1', outcome: 'in_progress' }`
- `testClassifications`: `{ scenarioId: 'test-s1', testId: 'dt-001', classification: 'critical' }`

`afterAll` — delete inserted rows in reverse order (sessionEvents for `sessionId: 'test-session-1'`, then sessionResults, then testClassifications for `scenarioId: 'test-s1'`).

Test cases:
- **Happy path**: `await selectTestAction('test-session-1', 'dt-001')` → `{ validatorResult: 'correct', category: 'critical' }`
- **Guard path**: `await selectTestAction('test-session-1', 'dt-999')` (testId not in `test-s1` classifications) → `{ error: 'Test not in scenario' }` — proves `actions.ts:92` guard fires; the silent `?? "unnecessary"` default does not reach the DB write

#### 6. `context/foundation/test-plan.md` §6.1 (update)

**File**: `context/foundation/test-plan.md`

**Purpose**: Replace the `TBD` placeholder in §6.1 with the established cookbook pattern.

**Contract**: Replace `TBD — see §3 Phase 1 for the validator classification pattern and denial/regression oracle.` with:
- **Location**: `src/shared/lib/validator.test.ts` (unit), `src/modules/session/actions.test.ts` (integration)
- **Naming convention**: Test descriptions in sentence form — "critical test returns 'correct'" not "validates critical category"
- **Oracle rule**: Expected `validatorResult` comes from plain English classification spec ("critical → correct"), never from `CATEGORY_TO_RESULT` code
- **Run command**: `npm run test`
- **Anti-pattern**: Never derive expected values by calling `CATEGORY_TO_RESULT[category]` in the assertion

### Success Criteria

#### Automated

- `npm run test` passes all integration tests when `DATABASE_URL_TEST` is set
- `npm run test` skips integration suite and exits 0 when `DATABASE_URL_TEST` is unset
- `npm run typecheck` passes

#### Manual

- [ ] Happy-path result: `selectTestAction` returns `{ validatorResult: 'correct', category: 'critical' }` against test schema
- [ ] Guard-path result: unknown testId returns `{ error: 'Test not in scenario' }` — not silent `"unnecessary"`
- [ ] §6.1 cookbook entry in `test-plan.md` is filled in

---

## Testing Strategy

### Unit tests (Phase 2)

`src/shared/lib/validator.test.ts` — fixture `Record<string, TestCategory>` objects, no DB, oracle from classification semantics.

### Integration tests (Phase 3)

`src/modules/session/actions.test.ts` — real Supabase test schema, `auth()` mocked, per-suite fixture insert/teardown via Drizzle.

### Manual steps

1. Run `npm run test` — all pass
2. Unset `DATABASE_URL_TEST`, run `npm run test` — integration suite skips, unit tests pass
3. Run `npm run typecheck` — no errors
4. Check §6.1 in `test-plan.md` is filled in

---

## References

- Research: `context/changes/testing-runner-bootstrap/research.md`
- Test plan: `context/foundation/test-plan.md`
- Validator: `src/shared/lib/validator.ts`
- Actions: `src/modules/session/actions.ts:54-102`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Add ` — <commit sha>` when a step lands. See `references/progress-format.md`.

### Phase 1: Vitest Infrastructure

#### Automated

- [x] 1.1 `npm run test` exits 0 with 1 passing smoke test — dcae4af
- [x] 1.2 `npm run typecheck` passes — dcae4af
- [x] 1.3 `npm run lint` passes — dcae4af

#### Manual

- [x] 1.4 `npm run test:watch` starts without error — dcae4af

### Phase 2: Validator Unit Tests

#### Automated

- [x] 2.1 `npm run test` passes all validator unit tests
- [x] 2.2 `npm run typecheck` passes

#### Manual

- [x] 2.3 Each test description reads as a classification-spec sentence, not code

### Phase 3: selectTestAction Integration Test

#### Automated

- [ ] 3.1 `npm run test` passes all integration tests when `DATABASE_URL_TEST` is set
- [ ] 3.2 `npm run test` skips integration suite and exits 0 when `DATABASE_URL_TEST` is unset
- [ ] 3.3 `npm run typecheck` passes

#### Manual

- [ ] 3.4 Happy-path: `selectTestAction` returns `{ validatorResult: 'correct', category: 'critical' }` against test schema
- [ ] 3.5 Guard-path: unknown testId returns `{ error: 'Test not in scenario' }`, not silent `"unnecessary"`
- [ ] 3.6 §6.1 cookbook entry in `test-plan.md` is filled in
