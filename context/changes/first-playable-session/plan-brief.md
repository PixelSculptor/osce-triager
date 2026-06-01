# First Diagnostic Session with Validator — Plan Brief

> Full plan: `context/changes/first-playable-session/plan.md`
> Research (internal): `context/changes/first-playable-session/research.md`
> Research (external): `context/changes/first-playable-session/classification-algorithm-research.md`

## What and Why

S-02 is the north-star: until a student can open a clinical scenario, order tests, and receive instant validator feedback — including an irreversible negative mark for skipping a life-saving test — the rest of the product is hypothetical. This plan delivers the smallest end-to-end flow that proves the simulator works: countdown timer → test selection with per-test inline badge → auto-submit on expiry → session outcome display.

## Starting Point

Auth, the Drizzle schema, and the seed data are all in place (S-01 + F-02 done). The schema has a 3-value `validatorResult` enum but the algorithm needs 4; that gap must be closed with a migration before the validator can write `"unnecessary"` events. No session module, no session page, and no scenario list exist yet.

## Desired End State

A logged-in student opens `/dashboard`, sees two scenario cards, clicks "Rozpocznij sesję", and lands on a timed session page. They click test names to order them (one-way, no undo), each card immediately shows a colour-coded badge (green/yellow/orange). When the countdown reaches 0 the session auto-submits; the page shows "Pozytywny" or "Negatywny" inline. Skipping any critical test forces the outcome to Negatywny regardless of everything else ordered.

## Key Decisions

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Algorithm | Pre-classified lookup table + pure rule engine | Only pattern satisfying <1 ms + determinism NFR; matches ESR/ACR academic standard | External research |
| validatorResult gap | Option A — extend enum to 4 values (`+ "unnecessary"`) | Keeps `critical_miss` semantically reserved for session-end synthetic events; preserves audit data for S-03 | Internal research |
| Session URL | `/dashboard/session/[sessionId]` (UUID of session_result row) | sessionId is unique per attempt; scenarioId is not | Internal research |
| Classifications loading | Once at RSC render, passed as props | Avoids a DB round-trip per test selection | Internal research |
| Timer | Client-side countdown computed from `startedAt` | Server-enforced timer unnecessary for MVP; accurate on refresh | Internal research |
| Test selection | One-way (no deselect) | Mirrors real clinical ordering; simplifies action logic | Plan |
| Timer expiry | Auto-submit (`endSessionAction` called on tick=0) | Mirrors exam conditions; no manual step needed | Plan |
| Per-test feedback | Inline badge on test card (colour + label) | Most direct feedback surface; no toast disappears | Plan |

## Scope

**In scope:**
- Phase 0 (optional): add `drizzle-kit migrate` step to `deploy.yml`
- Phase 1: Extend `validatorResult` enum + generate + apply migration
- Phase 2: `src/shared/lib/validator.ts` — pure validator functions
- Phase 3: `src/modules/session/actions.ts` — three Server Actions (start, selectTest, endSession)
- Phase 4: `/dashboard` scenario list with `<ScenarioCard>` start button
- Phase 5: `/dashboard/session/[sessionId]` session page — RSC + `<SessionView>` + `<TestCard>`

**Out of scope:**
- S-03 scoring UI and session history
- Test deselection / undo
- Server-side timer enforcement
- Toast notifications
- Animations or skeleton loaders
- WCAG-AA compliance

## Architecture / Approach

Server Actions own all DB writes and the validator calls. The session RSC loads scenario + tests + classifications once and passes them as props to the client component — no client-side DB access. `endSessionAction` is idempotent (safe to call from both timer expiry and manual button without double-write risk). The `"server-only"` import in `validator.ts` enforces the determinism NFR at compile time.

## Phases at a Glance

| Phase | Delivers | Key Risk |
|---|---|---|
| 0 (optional) | `drizzle-kit migrate` in CI | DATABASE_URL secret must be added to GitHub Secrets before running |
| 1. Schema Extension | `"unnecessary"` in enum + migration SQL committed | Migration must reach prod DB before new code is deployed |
| 2. Validator Library | Pure `validateTestSelection` + `evaluateSessionEnd` functions | Import from client component must error (server-only enforced) |
| 3. Session Actions | `startSession`, `selectTest`, `endSession` Server Actions | `endSessionAction` must be idempotent (timer + manual button race) |
| 4. Dashboard | Scenario list + start-session flow | `startSessionAction` redirect must land on correct sessionId UUID |
| 5. Session Page | Full gameplay loop: timer, badges, outcome display | Timer must compute correctly on page refresh; second-user 404 must hold |

**Prerequisites:** S-01 (auth-flow) + F-02 (data-schema) — both done as of 2026-05-29  
**Estimated effort:** ~3–4 implementation sessions across 5 phases

## Open Risks and Assumptions

- If Phase 0 is skipped: Phase 1 migration must be applied to the production DB manually before the code is deployed — forgetting this causes a runtime error on `INSERT` with `"unnecessary"`
- `testClassifications` has no Drizzle `relations()` — all lookups require explicit `.where()` clauses; no `with` shortcut available

## Success Criteria (Summary)

1. A student can complete a full session — start → order tests → receive badges → session auto-ends — without any error
2. A session that skips a critical test ends with `is_failed = true` and `outcome = "negative"` in the DB
3. `npm run typecheck`, `npm run lint`, and `npm run build` all pass after all phases
