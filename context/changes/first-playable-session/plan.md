# First Diagnostic Session with Validator — Implementation Plan

## Overview

Implement S-02: the north-star milestone. A student selects a clinical scenario on the dashboard, starts a timed session, orders diagnostic tests one-way (no undo), receives immediate inline feedback per test (correct / suboptimal / unnecessary), and when the countdown expires the session auto-submits — evaluating whether any life-saving (critical) test was skipped and marking the session irreversibly negative if so.

## Current State Analysis

- `src/app/dashboard/page.tsx` — placeholder (just shows user email); no scenario list, no start flow
- `src/modules/` — only `auth/` exists; no session module
- `src/shared/lib/` — has `schema.ts`, `db.ts`, `seed.ts`; **no `validator.ts`**
- `src/app/dashboard/session/` — does not exist
- `sessionEvents.validatorResult` enum has 3 values (`correct | suboptimal | critical_miss`) but the algorithm produces 4 categories; `"unnecessary"` has no storage slot (research gap, resolved: Option A — extend enum)
- `deploy.yml` has no `drizzle-kit migrate` step; schema changes require manual DB migration before each deploy

## Desired End State

After this plan:
1. `/dashboard` lists both hardcoded scenarios with a "Rozpocznij sesję" button each
2. Clicking Start creates a `session_result` row and redirects to `/dashboard/session/[sessionId]`
3. The session page shows: scenario title, countdown timer, ordered test list with inline badges, and a manual "Zakończ sesję" button
4. Selecting a test calls a Server Action, persists the event, and returns the validator result — the test card immediately shows a badge (colour + label)
5. When the timer hits 0 (or manual end): `endSessionAction` runs, writes `isFailed` + `outcome` + synthetic `critical_miss` events for each skipped critical test, and the page shows the session outcome inline
6. Verification: `npm run typecheck` and `npm run lint` pass; `npm run build` succeeds

### Key Findings

- `testClassifications` composite PK has **no Drizzle `relations()`** — lookups require raw `db.select().where(eq(testClassifications.scenarioId, ...))`, no `with` clause (`schema.ts:84–98`)
- `sessionResults.isFailed` + `outcome` are the binary session outcome stores (`schema.ts:100–117`)
- Server Action pattern to follow: `"use server"` → `async function(prevState, formData) → typed state` (`src/modules/auth/actions.ts:1–97`)
- `src/shared/lib/db.ts` uses `prepare: false` (required for Supabase PgBouncer) — do not change
- Drizzle config: `drizzle.config.ts` → output to `./drizzle/migrations`, dialect `postgresql`

## What We Are NOT Doing

- No S-03 scoring UI (session history, cumulative scores) — that is the next slice
- No test deselection / undo — one-way ordering mirrors real clinical workflow
- No server-side timer enforcement — client countdown only; `startedAt` in DB provides audit trail
- No scenario filtering, pagination, or search — both hardcoded scenarios shown directly
- No animations, skeleton loaders, or toast notifications — inline badge is the full feedback surface
- No WCAG-AA compliance pass — basic semantic HTML is sufficient for MVP
- No unit tests — test runner not configured

## Implementation Approach

Pre-classified lookup table + pure rule engine (per external + internal research). Classification data is loaded once per session at the RSC level and passed as props to client components. Each test selection triggers a Server Action that re-validates against the DB (client cannot forge the category). Session end is evaluated server-side with the full classification map.

Architecture flow:
```
/dashboard (RSC)
  → db: SELECT * FROM scenario
  → <ScenarioCard> (Client Component)
      → startSessionAction(scenarioId) → sessionId
      → router.push(/dashboard/session/{sessionId})

/dashboard/session/[sessionId] (RSC)
  → db: session + scenario + tests + classifications + existingEvents
  → <SessionView> (Client Component)
      → countdown timer (useEffect + setInterval, computed from startedAt)
      → unordered tests → click → selectTestAction(sessionId, testId)
      → ordered tests with inline badge
      → timer=0 OR manual end → endSessionAction(sessionId)
      → shows outcome inline (no navigation)
```

## Critical Implementation Details

- `selectTestAction` must load classifications from the DB itself (do not trust the category passed from the client — validate server-side every time)
- Timer initial value must be computed as `timeLimitSeconds - floor((now - startedAt) / 1000)` so it is accurate on page refresh
- `endSessionAction` is idempotent: check `outcome === 'in_progress'` before writing; return the existing outcome if already closed (handles double-fire from timer + manual button race)
- Synthetic `critical_miss` events for skipped critical tests are written by `endSessionAction`, not `selectTestAction`

---

## Phase 0 (Optional — run before Phase 1 if CI automation is desired): CI/CD — drizzle-kit migrate in deploy.yml

Without this phase, every schema change (including Phase 1's enum extension) requires a manual `drizzle-kit migrate` run against the production DB before the deploy goes live. Adding this step to CI makes migrations automatic and repeatable.

### Required Changes

#### 1. Add DATABASE_URL to GitHub Secrets

**File**: `.github/workflows/deploy.yml` (supporting change in GitHub repo settings)

**Goal**: The `drizzle-kit migrate` CLI needs `DATABASE_URL` at CI time. Add `DATABASE_URL` (the Transaction Pooler URL, port 6543) to GitHub repo Secrets — the same value used locally in `.env.local`.

**Contract**: New secret name: `DATABASE_URL`. No code change; repo settings only.

#### 2. Add migrate step to deploy.yml

**File**: `.github/workflows/deploy.yml`

**Goal**: Run pending Drizzle migrations against the production DB before the app build so that every deploy is schema-first.

**Contract**: Insert a new step between "Install dependencies" and "Lint":

```yaml
      - name: Run DB migrations
        run: npx drizzle-kit migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Success Criteria

#### Automatic Verification

- `npm run lint` passes on the unchanged workflow file

#### Manual Verification

- On the next push to `main`, the GitHub Actions log shows "Run DB migrations" completing without error before the build step

**Note**: Stop here for manual confirmation before Phase 1 if Phase 0 is executed.

---

## Phase 1: Schema Extension + Migration

Extend the `validatorResult` enum in `sessionEvents` to include `"unnecessary"`, preserving `critical_miss` exclusively for synthetic session-end events (critical tests never ordered). Generate + apply the migration.

### Required Changes

#### 1. Extend validatorResult enum

**File**: `src/shared/lib/schema.ts`

**Goal**: Add `"unnecessary"` as a fourth valid value for `validatorResult` so the validator can persist all four algorithm outputs without collapsing them.

**Contract**: Change the `.$type<>()` call on line ~130 from:
```typescript
.$type<"correct" | "suboptimal" | "critical_miss">()
```
to:
```typescript
.$type<"correct" | "suboptimal" | "unnecessary" | "critical_miss">()
```

#### 2. Generate and apply migration

**File**: `drizzle/migrations/` (new auto-generated SQL file)

**Goal**: Produce a migration SQL file that adds `"unnecessary"` to the `validator_result` check constraint and commit it alongside the schema change.

**Contract**: Run locally:
```bash
npx drizzle-kit generate   # produces new SQL migration file
npx drizzle-kit migrate    # applies to dev/prod DB
```
Commit both `schema.ts` and the new migration file. Do not edit the generated SQL.

### Success Criteria

#### Automatic Verification

- `npm run typecheck` passes (TypeScript sees the extended union)
- `npm run lint` passes
- `npx drizzle-kit generate` produces a new migration file (no diff if re-run after migration applied)

#### Manual Verification

- `npx drizzle-kit migrate` completes with exit code 0 against the dev/prod DB
- Running `npx drizzle-kit studio` (or psql) shows `validator_result` column accepting `'unnecessary'`

**Stop here for manual confirmation before proceeding to Phase 2.**

---

## Phase 2: Validator Library

Create the pure, server-only validator functions. No I/O, no DB access — pure classification logic.

### Required Changes

#### 1. Create validator.ts

**File**: `src/shared/lib/validator.ts`

**Goal**: Encapsulate the rule engine in a single file importable only from Server Actions. Exposes two pure functions: per-test validation and session-end evaluation.

**Contract**: Export the following shape:

```typescript
import "server-only"

export type TestCategory = "critical" | "optimal" | "acceptable" | "unnecessary"

export type ValidatorResult = "correct" | "suboptimal" | "unnecessary" | "critical_miss"

export interface TestValidationResult {
  category: TestCategory
  validatorResult: ValidatorResult // stored in sessionEvents
}

export interface SessionEndResult {
  irreversibleFail: boolean
  skippedCritical: string[] // testIds of critical tests not ordered
}

// Maps TestCategory → the value stored in sessionEvents.validatorResult
const CATEGORY_TO_RESULT: Record<TestCategory, ValidatorResult> = {
  critical:    "correct",
  optimal:     "correct",
  acceptable:  "suboptimal",
  unnecessary: "unnecessary",
}

export function validateTestSelection(
  testId: string,
  classifications: Record<string, TestCategory>
): TestValidationResult {
  const category = classifications[testId] ?? "unnecessary"
  return { category, validatorResult: CATEGORY_TO_RESULT[category] }
}

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

### Success Criteria

#### Automatic Verification

- `npm run typecheck` passes (no type errors in new file)
- `npm run lint` passes

#### Manual Verification

- Import of `validator.ts` in a client component causes a build-time error (server-only enforcement works)

**Stop here for manual confirmation before proceeding to Phase 3.**

---

## Phase 3: Session Server Actions + Types

Create the session module with three Server Actions. All DB access and validator calls live here.

### Required Changes

#### 1. Create session.types.ts

**File**: `src/modules/session/session.types.ts`

**Goal**: Shared TypeScript types for the session module — action return shapes used by both Server Actions and client components.

**Contract**:

```typescript
import type { TestCategory, ValidatorResult } from "@/shared/lib/validator"

export interface StartSessionResult {
  sessionId?: string
  error?: string
}

export interface SelectTestResult {
  validatorResult?: ValidatorResult
  category?: TestCategory
  error?: string
}

export interface EndSessionResult {
  outcome?: "positive" | "negative"
  isFailed?: boolean
  skippedCritical?: string[]
  error?: string
}
```

#### 2. Create actions.ts

**File**: `src/modules/session/actions.ts`

**Goal**: Three server-side entry points for the session lifecycle. Follow the `"use server"` pattern from `src/modules/auth/actions.ts`. Actions are called directly (not via `useFormState`) since they return structured data, not form state.

**Contract** — three exported async functions:

**`startSessionAction(scenarioId: string): Promise<StartSessionResult>`**
- Validates user is authenticated (calls `auth()` from `@/modules/auth/auth`)
- Validates scenario exists in DB
- Inserts row into `sessionResults`: `{ userId, scenarioId, outcome: "in_progress", isFailed: false }`
- Returns `{ sessionId }` on success, `{ error }` on failure

**`selectTestAction(sessionId: string, testId: string): Promise<SelectTestResult>`**
- Validates session exists + belongs to current user + `outcome === "in_progress"`
- Validates test not already in `sessionEvents` for this session (duplicate guard)
- Loads `testClassifications` where `scenarioId` matches session's `scenarioId`
- Builds `Record<testId, TestCategory>` in memory
- Calls `validateTestSelection(testId, classifications)`
- Inserts row into `sessionEvents`: `{ sessionId, testId, validatorResult }`
- Returns `{ validatorResult, category }` on success

**`endSessionAction(sessionId: string): Promise<EndSessionResult>`**
- Validates session exists + belongs to current user
- If `outcome !== "in_progress"`: returns existing `{ outcome, isFailed, skippedCritical: [] }` (idempotent)
- Loads all `sessionEvents` for this session → builds `orderedTestIds` set
- Loads `testClassifications` for the scenario
- Calls `evaluateSessionEnd(orderedTestIds, classifications)`
- Inserts one `critical_miss` event per `skippedCritical` testId into `sessionEvents`
- Updates `sessionResults`: `{ outcome: isFailed ? "negative" : "positive", isFailed, completedAt: new Date() }`
- Returns `{ outcome, isFailed, skippedCritical }`

### Success Criteria

#### Automatic Verification

- `npm run typecheck` passes
- `npm run lint` passes

#### Manual Verification

- Calling `startSessionAction` with a valid scenarioId creates a row in `session_result` (verify via Supabase dashboard or `drizzle-kit studio`)
- Calling `selectTestAction` with a valid sessionId + testId creates a row in `session_event`
- Calling `endSessionAction` updates the session outcome and sets `completed_at`

**Stop here for manual confirmation before proceeding to Phase 4.**

---

## Phase 4: Dashboard — Scenario List + Start Button

Replace the `/dashboard` placeholder with a functional scenario list. Each scenario has a "Rozpocznij sesję" button that starts the session and redirects.

### Required Changes

#### 1. Create ScenarioCard component

**File**: `src/modules/session/components/ScenarioCard.tsx`

**Goal**: Client component that renders one scenario card with title, time limit, and a start button. On click: calls `startSessionAction`, then navigates to the session page.

**Contract**:
- Props: `{ id: string; title: string; description: string; timeLimitSeconds: number }`
- On button click: calls `startSessionAction(id)` → on success `router.push("/dashboard/session/${sessionId}")` → on error shows inline error text
- Button shows a loading state while the action is in-flight (disable + label change)
- Use `"use client"` directive; import `useRouter` from `"next/navigation"`

**File**: `src/modules/session/components/ScenarioCard.module.css`

**Goal**: Scoped styles for the card — minimal card layout (border, padding, flex column). Match the visual tone of the existing auth forms.

#### 2. Create components barrel export

**File**: `src/modules/session/components/index.ts`

**Goal**: Re-export all session components for clean imports.

**Contract**: `export { ScenarioCard } from "./ScenarioCard"`  (extend as phases add components)

#### 3. Update dashboard page

**File**: `src/app/dashboard/page.tsx`

**Goal**: Replace the placeholder content with an async RSC that fetches all scenarios and renders `<ScenarioCard>` for each.

**Contract**:
- Add `db.select().from(scenarios).orderBy(scenarios.createdAt)` query
- Render a `<ul>` of `<ScenarioCard>` components with props from the DB row
- Keep the existing `auth()` call; redirect to `/login` if no session (guard already present via middleware but explicit redirect is cleaner)

### Success Criteria

#### Automatic Verification

- `npm run typecheck` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- `/dashboard` shows two scenario cards (Ból klatki piersiowej + Zaburzenia świadomości)
- Clicking "Rozpocznij sesję" on either card creates a DB row and redirects to `/dashboard/session/[id]`
- The redirected URL contains a valid UUID

**Stop here for manual confirmation before proceeding to Phase 5.**

---

## Phase 5: Session Page — Timer, Test Selection, Inline Feedback, End Flow

The main gameplay screen. RSC loads all session data; `<SessionView>` handles the interactive loop client-side.

### Required Changes

#### 1. Create SessionView component

**File**: `src/modules/session/components/SessionView.tsx`

**Goal**: Main client component for the session. Manages: countdown timer, ordered/unordered test state, per-test action dispatch, session end (timer or manual), and inline result display.

**Contract**:
```typescript
"use client"

interface SessionViewProps {
  sessionId: string
  timeLimitSeconds: number
  startedAt: Date
  tests: Array<{ id: string; name: string }>
  classifications: Record<string, TestCategory>  // for client-side badge color pre-compute only
  initialEvents: Array<{ testId: string; validatorResult: ValidatorResult }> // for resume support
  sessionOutcome: "in_progress" | "positive" | "negative"  // initial state from RSC
}
```

Internal state:
- `orderedTests: Array<{ testId: string; name: string; validatorResult: ValidatorResult; category: TestCategory }>` — populated from `initialEvents` on mount, extended on each selection
- `sessionState: "in_progress" | "positive" | "negative"` — controls result display
- `remainingSeconds: number` — computed from `timeLimitSeconds - elapsed(startedAt)` on mount, decremented by `setInterval`

Timer logic:
- `useEffect` starts `setInterval(1000)`; on tick: `remainingSeconds -= 1`; if `remainingSeconds <= 0`: clear interval, call `endSessionAction(sessionId)`, update `sessionState`
- Timer stops when `sessionState !== "in_progress"`

Test selection:
- Unordered tests = all tests not in `orderedTests`
- Click → disabled during in-flight action → call `selectTestAction(sessionId, testId)` → on success push to `orderedTests` state

Session end (both paths):
- Manual "Zakończ sesję" button: calls `endSessionAction(sessionId)`, updates `sessionState`
- Timer expiry: same `endSessionAction` call
- Both paths: idempotent (server ignores second call)

Result display (when `sessionState !== "in_progress"`):
- Show outcome heading: "Sesja zakończona — wynik: Pozytywny / Negatywny"
- Show list of skipped critical tests if any
- "Wróć do panelu" link → `/dashboard`

**File**: `src/modules/session/components/SessionView.module.css`

**Goal**: Layout for the session view — two-column grid (test list left, ordered tests right), timer display, result overlay.

#### 2. Create TestCard component

**File**: `src/modules/session/components/TestCard.tsx`

**Goal**: Renders one diagnostic test. Two states: selectable (button) and selected (badge showing result).

**Contract**:
```typescript
interface TestCardProps {
  name: string
  validatorResult?: ValidatorResult  // undefined = not yet selected (selectable state)
  category?: TestCategory            // for badge colour
  onSelect?: () => void              // undefined = already selected (non-interactive)
  isLoading?: boolean                // in-flight action → disable button
}
```

Badge colour mapping:
- `correct` (critical/optimal ordered) → green
- `suboptimal` (acceptable ordered) → yellow/amber
- `unnecessary` → orange
- `critical_miss` — not shown per-test during session (only used in synthetic session-end events)

**File**: `src/modules/session/components/TestCard.module.css`

**Goal**: Card styles — selected state visually distinct from selectable; badge chip with colour variants.

#### 3. Update components barrel export

**File**: `src/modules/session/components/index.ts`

**Goal**: Add `SessionView` and `TestCard` to the barrel export.

#### 4. Create session page (RSC)

**File**: `src/app/dashboard/session/[sessionId]/page.tsx`

**Goal**: Server Component that loads all session data and renders `<SessionView>`. Handles access control (session must belong to current user) and completed sessions (shows static result if outcome already set).

**Contract**:
- Params: `{ sessionId: string }` from Next.js App Router
- Auth check: `auth()` → if no session, `redirect("/login")`
- Load `sessionResult` by `sessionId`; if not found or `userId !== currentUser.id` → `notFound()`
- Load: `scenario`, `diagnosticTests` (all), `testClassifications` (for scenario), `sessionEvents` (for session)
- Build `classifications: Record<string, TestCategory>` from classification rows
- Build `initialEvents` array from existing event rows
- Render `<SessionView>` with all props

### Success Criteria

#### Automatic Verification

- `npm run typecheck` passes (all new files, all props correctly typed)
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- Navigating to a valid session URL shows: scenario title, countdown timer, all 18 test cards as selectable buttons
- Clicking a test: button becomes non-interactive, badge appears immediately with correct colour
- Ordering an `unnecessary` test shows orange "Zbędne" badge
- Ordering all `critical` tests: timer expiry leads to "Pozytywny" outcome
- Skipping a `critical` test and letting timer expire: leads to "Negatywny" outcome and shows the missed test
- Manually clicking "Zakończ sesję" before timer expiry triggers the same evaluation
- Refreshing the session page mid-session: timer resumes from correct remaining time; already-ordered tests still show their badges
- A second user cannot access another user's session URL (returns 404)

---

## Testing Strategy

### Automatic Verification (per phase)

- `npm run typecheck` — TypeScript strict mode
- `npm run lint` — ESLint with `next/core-web-vitals` rules
- `npm run build` — full Next.js + OpenNext build

### Manual Testing Checklist

1. Start session → DB has `session_result` row with `outcome = "in_progress"`
2. Select optimal test → badge shows green "Poprawne", `session_event` row exists
3. Select unnecessary test → badge shows orange "Zbędne"
4. Select acceptable test → badge shows yellow "Akceptowalne"
5. Let timer expire (use short-limit scenario or modify `timeLimitSeconds` in dev) → session auto-ends
6. Skip all critical tests → outcome = "negative", `is_failed = true`, synthetic `critical_miss` events in DB
7. Order all critical tests → outcome = "positive", `is_failed = false`
8. Refresh mid-session → timer correct, badges preserved
9. Direct URL access as different user → 404

## Migration Notes

- Phase 1 migration must be applied to the production DB **before** the code using the new `"unnecessary"` value is deployed
- If Phase 0 (CI/CD migrate step) is done first, this is automatic
- If Phase 0 is skipped: run `npx drizzle-kit migrate` manually against the production DB before merging Phase 1

## References

- Research (internal): `context/changes/first-playable-session/research.md`
- Research (external): `context/changes/first-playable-session/classification-algorithm-research.md`
- Auth module (canonical pattern): `src/modules/auth/actions.ts:1–97`
- Schema (tables used): `src/shared/lib/schema.ts:84–133`
- DB client: `src/shared/lib/db.ts`
- Drizzle config: `drizzle.config.ts`
- Roadmap entry: `context/foundation/roadmap.md` — S-02

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Add ` — <commit sha>` when a step is realized.

### Phase 0 (Optional): CI/CD — drizzle-kit migrate

#### Automatic

- [ ] 0.1 `npm run lint` passes on updated deploy.yml

#### Manual

- [ ] 0.2 GitHub Actions "Run DB migrations" step completes without error on next push to main

### Phase 1: Schema Extension + Migration

#### Automatic

- [ ] 1.1 `npm run typecheck` passes after enum extension
- [ ] 1.2 `npm run lint` passes
- [ ] 1.3 `npx drizzle-kit generate` produces new migration file without re-diff

#### Manual

- [ ] 1.4 `npx drizzle-kit migrate` completes with exit 0 against dev/prod DB
- [ ] 1.5 `validator_result` column accepts `'unnecessary'` in DB

### Phase 2: Validator Library

#### Automatic

- [ ] 2.1 `npm run typecheck` passes
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 Importing `validator.ts` in a client component triggers build-time error (server-only enforced)

### Phase 3: Session Server Actions + Types

#### Automatic

- [ ] 3.1 `npm run typecheck` passes
- [ ] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 `startSessionAction` creates `session_result` row in DB
- [ ] 3.4 `selectTestAction` creates `session_event` row in DB
- [ ] 3.5 `endSessionAction` updates session outcome + sets `completed_at`

### Phase 4: Dashboard — Scenario List

#### Automatic

- [ ] 4.1 `npm run typecheck` passes
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 `npm run build` passes

#### Manual

- [ ] 4.4 `/dashboard` shows two scenario cards
- [ ] 4.5 "Rozpocznij sesję" creates DB row and redirects to `/dashboard/session/[uuid]`

### Phase 5: Session Page

#### Automatic

- [ ] 5.1 `npm run typecheck` passes
- [ ] 5.2 `npm run lint` passes
- [ ] 5.3 `npm run build` passes

#### Manual

- [ ] 5.4 Session page renders timer + 18 test cards
- [ ] 5.5 Selecting a test shows inline badge with correct colour
- [ ] 5.6 Timer expiry auto-submits session
- [ ] 5.7 Skipping critical test → "Negatywny" outcome
- [ ] 5.8 Ordering all critical tests → "Pozytywny" outcome
- [ ] 5.9 Page refresh preserves timer position and ordered tests
- [ ] 5.10 Different user accessing session URL gets 404
