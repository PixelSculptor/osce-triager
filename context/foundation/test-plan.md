# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-08

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/app`, `src/shared`, `src/modules`, `src/hooks`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | Student selects the correct life-saving test; validator silently returns "unnecessary" instead of "correct" because classifications failed to load (empty DB result). Session outcome is wrong with no crash or visible signal. | High | Medium | PRD Business Logic (deterministic validator guardrail); interview Q1; interview Q3 (returns-proper-feedback = most-uncertain area); hot-spot dir `src/modules/session` — 7 changes/30 days; research: `selectTestAction` does not guard against empty classifications map — `?? "unnecessary"` default fires silently |
| 2 | Student B's authenticated request to `/dashboard/session/[studentA_id]` returns a 200 with student A's data. Cross-account IDOR. | High | Low | PRD Access Control (data isolation guardrail); interview Q1; roadmap S-03 risk note (every query must filter userId); hot-spot dir `src/modules/session` — 7 changes/30 days |
| 3 | `endSessionAction` fires, DB write silently fails, completed session never appears in history. No error shown to student. | Medium | Low | PRD FR-008; roadmap S-03 depends on S-02 write being reliable; hot-spot dir `src/modules/session` — 7 changes/30 days |
| 4 | After a code change, the first or last test in the session list can no longer be dragged — only the click-button workaround remains. No error, just broken DnD. | Medium | High | Interview Q2 (burned by this exact bug); interview Q3 (DnD = most-uncertain area); hot-spot dir `src/modules/session/components` — 32 changes/30 days (hottest directory) |
| 5 | Soft-deleted account's data survives past the 30-day retention window. Cleanup job never runs or runs with wrong boundary condition. RODO violation. | High | Low | Roadmap S-05 risk note; archive `account-deletion` plan (soft-delete + scheduled cleanup) |
| 6 | Unauthenticated (or expired-session) request reaches `/dashboard/*` and receives content instead of a redirect to `/login`. Auth middleware silently passes. | High | Low | PRD Access Control; roadmap F-01 risk (AUTH_URL misconfiguration); roadmap F-03 discovery (auth.config.ts Edge split pattern); roadmap S-01 risk (middleware redirect gap) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Given scenario X + test Y (known classification), validator returns the exact expected status — not just non-null, but the correct value. Session outcome matches. Also: given an empty classifications map, the caller must not silently accept "unnecessary" as a valid result. | "Validator returned non-null, therefore correct" — it can return a wrong non-null value silently. "Classifications loaded, therefore non-empty" — the DB query can return an empty result with no error; `?? "unnecessary"` default fires silently in `validateTestSelection`. | `validateTestSelection` is pure (takes a plain Record). `selectTestAction` loads classifications per-request from `testClassifications` table keyed by `scenarioId`; it has no empty-map guard. The unit test oracle must come from the classification table data, never from the validator code itself. | Unit on `validateTestSelection` with fixture Record (no DB). Separate integration on `selectTestAction` against a real test schema (do not mock Drizzle — mocking hides the empty-result gap). | Testing only happy-path (correct test → positive); skipping the empty-map silent-default case. Mirror-implementation oracle: never derive expected `validatorResult` from `CATEGORY_TO_RESULT` in the test — use the plain English classification ("critical test must return 'correct'") as the oracle. |
| #2 | Student B's authenticated request with student A's sessionId returns null / 404 / redirect — never a 200 with data. | "Page shows session data, therefore it must be filtered" — RSC page can serve data if `WHERE userId` is absent from the query. | How does the session detail page fetch data? Does userId come from Auth.js `session.user.id`? What happens when sessionId doesn't belong to requester? | Integration test on query function: `getSessionById(userId, wrongOwnerSessionId)` → null | Testing only "authenticated user sees own data"; never testing cross-account denial. |
| #3 | After `endSessionAction` fires, `getUserSessions(userId)` returns the completed session with correct `outcome` and `completedAt`. | "Action didn't throw, therefore write succeeded" — swallowed exceptions, missing await, silent rollback. | Does `endSessionAction` use a transaction? Does it handle DB errors? What is the return shape? | Integration: `endSessionAction` + query round-trip against a real test schema | Mocking the DB write — hides the actual persistence guarantee. |
| #4 | After a code change to SessionView or `@dnd-kit` config, dragging the **first** test to a different position reorders it correctly in UI state. | "Handler fires, therefore drag works" — `over` being null at list edges is the documented past bug. | What is the `handleDragEnd` branching logic? What activation constraint is set? What happens when `over` is null for source=available? | Component interaction test: simulate pointer drag on first item, assert state reorder | Testing only that `handleSelectTest` is callable; not simulating the actual drag sequence including edge positions. |
| #5 | Given rows with `deleted_at` = (now − 31 days), cleanup function deletes them. Rows with `deleted_at` = (now − 29 days) remain. | "Soft-delete flag is set, therefore data will be cleaned up" — cron job might not run; query might skip the edge boundary. | What mechanism triggers cleanup (Workers cron vs scheduled function)? Which tables have `deleted_at`? What is the boundary condition logic? | Unit test on cleanup function with fixture rows at day 29 and day 31 | Testing only that the soft-delete flag is set on deletion; never verifying the cleanup boundary. |
| #6 | Unauthenticated request to `/dashboard` and `/dashboard/session/[id]` returns HTTP 302 to `/login`, never serves content. | "middleware.ts exists, therefore all protected routes are covered" — Edge runtime config issues on Cloudflare Workers can cause middleware to silently pass requests. | Which routes are in the middleware matcher? How is JWT verified on Edge? What does the auth.config.ts split mean for the verification path? | Integration/e2e: unauthenticated HTTP request to `/dashboard` → assert redirect | Testing only login/logout flows; not directly testing that an unauthenticated request to the protected path is blocked. |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Runner bootstrap + validator unit tests | Install vitest; prove first test passes; unit-test validator classification logic with fixture data | #1 | unit, integration | complete | context/changes/testing-runner-bootstrap |
| 2 | Data isolation + session persistence | Integration tests for userId-scoped queries + session write round-trip against real DB | #2, #3 | integration (DB) | change opened | context/changes/testing-data-isolation-session-persistence |
| 3 | Auth boundary gate | Prove middleware blocks unauthenticated access to all protected routes | #6 | integration, lightweight e2e | not started | — |
| 4 | Session UI regression baseline | Component interaction test for DnD drag on first/last item; validator feedback display in SessionView | #4 | component interaction | not started | — |
| 5 | RODO retention gate | Unit test on cleanup logic at 30-day boundary (activate once S-05 ships) | #5 | unit | not started | — |

## 4. Stack

The classic test base for this project. No test runner is installed yet —
Phase 1 establishes it. Tool choices below are the starting hypothesis;
`/10x-research` for Phase 1 must verify compatibility with Next.js 16 +
React 19 + Cloudflare Workers runtime before committing.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | ^3.2.6 (installed) | ESM-native, TypeScript-first. Compatible with Next.js 16 + Cloudflare Workers for Node.js environment tests. See §6.1 for patterns. |
| component interaction | @testing-library/react + jsdom | none yet — see §3 Phase 4 | For SessionView/DnD interaction tests. Pointer event support for @dnd-kit must be verified. |
| integration (DB) | Vitest + real Supabase test schema | none yet — see §3 Phase 2 | Do not mock Drizzle ORM — mocks hide the persistence guarantee (Risk #3 anti-pattern). |
| auth middleware | Vitest + fetch mock or Playwright | none yet — see §3 Phase 3 | Cloudflare Workers Edge runtime may require miniflare or Playwright for accurate middleware testing. Verify in Phase 3 research. |
| e2e | Playwright | none yet — see §3 Phase 3 | Reserve for flows that require the full deployed shape (auth + cookie + handler crossing). |

**Stack grounding tools (current session):**
- Docs: none — Context7 / framework docs MCP not available in current session; checked: 2026-06-08
- Search: Exa.ai — available; not queried (local manifest evidence sufficient for Phase 1 hypothesis); checked: 2026-06-08
- Runtime/browser: Playwright MCP — not available in current session; checked: 2026-06-08
- Provider/platform: GitHub/Cloudflare/Supabase MCP — not available in current session; checked: 2026-06-08

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required | syntactic / type drift |
| unit + integration | local + CI | required after §3 Phase 1 | validator logic regressions, isolation bugs |
| auth middleware check | CI on PR | required after §3 Phase 3 | unauthenticated route access |
| component interaction | local + CI | required after §3 Phase 4 | DnD interaction regressions |
| e2e on critical flows | CI on PR | required after §3 Phase 3 | broken auth + session paths end-to-end |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships.

### 6.1 Adding a unit test (validator logic)

**Locations**
- Unit tests: `src/shared/lib/validator.test.ts`
- Integration tests: `src/modules/session/actions.test.ts`

**Naming convention**: Test descriptions in sentence form — `'critical test returns correct'` not `'validates critical category'`.

**Oracle rule**: Expected `validatorResult` comes from plain English classification semantics ("critical test must return 'correct'"). Never derive expected values from `CATEGORY_TO_RESULT` in the test — that is a mirror-implementation oracle.

**Run command**: `npm run test`

**Integration test prerequisite**: Set `DATABASE_URL_TEST` in `.env.test` (see `.env.test.example`). Apply schema once: `DATABASE_URL=<test-url> npx drizzle-kit push`.

**Anti-pattern**: Testing only the happy path (`validateTestSelection` with a known classification) without covering the silent-default case (`validateTestSelection('id', {})` returns `"unnecessary"` with no error — protection relies on the `actions.ts:92` guard in the caller).

### 6.2 Adding an integration test (DB query with userId scoping)

TBD — see §3 Phase 2 for the userId-scoped query pattern and cross-account denial baseline.

### 6.3 Adding a middleware / auth boundary test

TBD — see §3 Phase 3 for the unauthenticated-route protection pattern.

### 6.4 Adding a component interaction test (session UI / DnD)

TBD — see §3 Phase 4 for the DnD drag sequence pattern and first/last-item edge case fixture.

### 6.5 Adding a retention / cleanup test

TBD — see §3 Phase 5 for the soft-delete boundary logic pattern (activate when S-05 ships).

## 7. What We Deliberately Don't Test

Exclusions agreed during the Phase 2 interview (Q5). Future contributors
should respect these unless the underlying assumption changes.

- **CSS animation layer** — visual styling changes have no failure mode that matters to product correctness. Re-evaluate if a CSS token directly gates a business-logic state. (Source: Phase 2 interview Q5.)
- **Seed data in `seed.ts`** — the hardcoded scenario + test classification data; the generator script is the test. Re-evaluate if scenarios become dynamic or user-generated. (Source: Phase 2 interview Q5.)
- **Pure presentational frontend components** — UI components with no business logic (layout, typography, static display). Re-evaluate if a component begins to own validation or access-control rendering. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-08
- Stack versions last verified: 2026-06-08
- AI-native tool references last verified: n/a — no AI-native tools in current plan

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
