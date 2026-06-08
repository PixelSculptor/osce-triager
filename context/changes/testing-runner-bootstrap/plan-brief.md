# Testing Runner Bootstrap — Plan Brief

> Full plan: `context/changes/testing-runner-bootstrap/plan.md`
> Research: `context/changes/testing-runner-bootstrap/research.md`

## What and Why

Bootstrap the project's test infrastructure from zero and cover Risk #1 (validator silently classifies a correct life-saving test as "unnecessary" when classifications fail to load). Two test layers are required: a pure unit test on the validator function itself, and an integration test on the action that loads classifications from the DB.

## Starting Point

No test runner, no `test` script, zero test files. The validator is pure TypeScript with no side effects, making it immediately unit-testable. The dangerous caller gap (`selectTestAction` loading classifications per-request with no guard against wrong data) requires a real DB to test meaningfully — Drizzle mocks would hide the empty-result failure mode.

**Research correction**: The research summary stated the caller had no empty-map guard. The actual code at `actions.ts:92` does have one: `if (!(testId in classifications)) return { error: "Test not in scenario" }`. This changes the integration test design — the guard path now tests for an error return, not a silent "unnecessary".

## Desired End State

`npm run test` passes from a clean checkout. Integration tests skip gracefully when `DATABASE_URL_TEST` is absent. §6.1 of `test-plan.md` is filled in as the canonical "how to add a unit test" reference for future contributors.

## Key Decisions

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| `server-only` handling | Alias to empty mock in `vitest.config.ts` | `validator.ts:1` imports `server-only`; alias applies globally without per-test `vi.mock()` calls | Plan |
| Integration test DB | Real Supabase test schema (`DATABASE_URL_TEST`) | Drizzle mock hides the empty-result gap that is Risk #1's primary failure mode (test-plan §2 anti-pattern) | Plan |
| Vitest config shape | Single flat `vitest.config.ts`, `environment: node` | Workspace config adds complexity with no payoff until Phase 4 (jsdom); trivially extended later | Plan |
| CF init import | Add verification smoke test | `next.config.ts:9` imports `@opennextjs/cloudflare`; cheap to confirm it no-ops in Node.js before CI depends on it | Plan |
| Integration test auth | Mock `auth()` → `{ user: { id: 'test-user-id' } }` | Real auth session is not available in a Node.js test process; `selectTestAction:58` checks auth before any DB query | Plan |
| Integration test skip guard | `describe.skip` when `DATABASE_URL_TEST` unset | `npm run test` must pass in CI before the test DB is provisioned | Plan |

## Scope

**In scope:**
- Vitest install + config + `server-only` alias
- `test` and `test:watch` npm scripts
- Unit tests for `validateTestSelection` (4 categories + silent-default) and `evaluateSessionEnd`
- `.env.test` + `.env.test.example` + dotenv setup file
- Integration test for `selectTestAction` (happy path + guard path)
- §6.1 cookbook entry in `test-plan.md`

**Out of scope:**
- Coverage reporting
- Component tests (Phase 4)
- Auth middleware tests (Phase 3 of test-plan)
- CI YAML changes
- Any test that reads from `seed.ts` data

## Architecture

Vitest runs in `environment: node` — no jsdom, no browser APIs needed for Phases 1–3. The `server-only` alias is global via `resolve.alias`. Integration tests get a separate Supabase project/schema; dotenv loads `.env.test` via a setup file. `auth()` is mocked at the module level; the real Drizzle client connects to the test schema.

```
vitest.config.ts
  └── resolve.alias: server-only → __mocks__/server-only.ts
  └── setupFiles: vitest.setup.ts  (loads .env.test)

src/shared/lib/validator.test.ts      ← Phase 2, pure unit, no DB
src/modules/session/actions.test.ts   ← Phase 3, real test DB, auth() mocked
```

## Phases in Brief

| Phase | Delivers | Key Risk |
|-------|----------|----------|
| 1. Vitest infrastructure | Runner installed; smoke test passes; scripts exist | CF import throws in Node.js process (unlikely, verified by smoke test) |
| 2. Validator unit tests | All 4 category mappings tested; silent-default documented | Oracle drift — test mirrors `CATEGORY_TO_RESULT` code instead of classification spec |
| 3. Integration test | `selectTestAction` happy + guard paths; §6.1 filled in | `DATABASE_URL_TEST` not provisioned → integration tests silently skip forever |

**Prerequisites:** A second Supabase project (or a separate schema) for `DATABASE_URL_TEST`. Schema applied via `drizzle-kit push` before first integration test run.

**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks and Assumptions

- `drizzle-kit push` applies cleanly to a fresh Supabase test schema — assumed, not verified
- `vitest ^3` is compatible with `next 16.2.6` + `react 19.2.4` — research found no blocking issues; smoke test confirms at runtime
- `auth()` mock pattern works with the current `next-auth ^5.0.0-beta.31` import path — straightforward `vi.mock`, should work

## Success Criteria

1. `npm run test` passes from a clean checkout (integration suite skips without `DATABASE_URL_TEST`)
2. A critical test (`dt-001` with classification `critical`) returns `{ validatorResult: 'correct' }` in the integration test
3. §6.1 in `test-plan.md` is no longer "TBD"
