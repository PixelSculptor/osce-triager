<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First Diagnostic Session with Validator

- **Plan**: context/changes/first-playable-session/plan.md
- **Scope**: All Phases (0–5)
- **Date**: 2026-06-01
- **Verdict**: REJECTED
- **Findings**: 1 critical | 6 warnings | 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Notes on unplanned files

- `src/modules/session/queries.ts` — justified extraction of shared DB queries used by both RSC pages; includes `import "server-only"`. Architecturally better than inline queries.
- `package.json` — `server-only` package added; required by `validator.ts` and `queries.ts`.
- `src/modules/auth/auth.ts` — pre-existing; `jwt`/`session` callbacks added to propagate `user.id`. Correct and necessary.

## Automated verification

- `npm run typecheck` — ✅ PASS
- `npm run lint` — ✅ PASS
- `npm run build` — ✅ PASS

## Findings

### F1 — Classification answer key serialized to client

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/app/dashboard/session/[sessionId]/page.tsx:51, src/modules/session/components/SessionView.tsx:22
- **Detail**: The full `classifications` record is passed as a prop to the client component `SessionView` and visible in the RSC flight response (browser devtools). The plan acknowledged this as MVP-acceptable in "What We Are NOT Doing", so this is documented debt rather than an oversight.
- **Fix A ⭐ Recommended**: Accept as documented MVP debt; track as follow-up for next slice — remove `classifications` from `SessionViewProps`, derive per-event category from the server instead.
  - Strength: Plan already bounds the risk; no unplanned work blocks this slice.
  - Tradeoff: Risk remains live until addressed.
  - Confidence: HIGH — plan's own "NOT Doing" list covers this.
  - Blind spot: Whether the exam audience can exploit devtools in supervised vs. remote use-case.
- **Fix B**: Remove `classifications` prop now; derive per-event category server-side via `selectTestAction` return value and pre-mapped `initialEvents`.
  - Strength: Closes the leak entirely.
  - Tradeoff: Delays ship; requires prop threading refactor.
  - Confidence: MED — no other callers today.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — accepted as documented MVP debt; follow-up added to context/changes/first-playable-session/follow-ups/review-fixes.md

---

### F2 — selectTestAction accepts any testId, not just scenario tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/modules/session/actions.ts:77–89
- **Detail**: `testId` not in the scenario's classifications map falls back to `"unnecessary"` (validator.ts:28) and gets persisted. A user can forge requests with arbitrary test UUIDs, polluting audit data.
- **Fix**: Add membership guard after building classifications map: `if (!(testId in classifications)) return { error: "Test not in scenario" }`
  - Strength: Two-line fix; closes test-ID enumeration; consistent with duplicate guard already in the same action.
  - Tradeoff: Negligible.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED

---

### F3 — Session actions throw on DB errors; no try/catch anywhere

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/modules/session/actions.ts (entire file)
- **Detail**: Canonical pattern (src/modules/auth/actions.ts) wraps all external calls in try/catch and returns typed `{ error }`. Session actions have zero try/catch. DB errors throw unhandled, producing a generic 500. Client components check `result.error` but cannot receive it if the action throws — directly causing the stuck UI states in F4.
- **Fix**: Wrap each action body in try/catch following auth pattern: `try { ... } catch { return { error: "Internal error" } }`
  - Strength: Matches canonical pattern; makes F4 largely self-resolving.
  - Tradeoff: Boilerplate to add to three functions.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED

---

### F4 — Client action handlers leave UI permanently frozen on thrown exception

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Reliability
- **Location**: src/modules/session/components/SessionView.tsx:82–105
- **Detail**: `handleEndSession` sets `endingRef.current = true` before the await; if the action throws, it never resets — button stays "Kończenie..." permanently and timer auto-end silently no-ops. `handleSelectTest` leaves `loadingTestId` set on throw, freezing all further test selection. Both are defense-in-depth issues that F3's fix reduces but does not eliminate.
- **Fix**: Add try/finally to both handlers to always reset loading state.
  - Strength: Guarantees UI is always recoverable regardless of server behaviour.
  - Tradeoff: If session end genuinely fails user can retry — better than silent freeze.
  - Confidence: HIGH — standard async UI pattern.
  - Blind spot: None significant.
- **Decision**: FIXED

---

### F5 — critical_miss events inserted outside the session-finalization transaction

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Data Safety
- **Location**: src/modules/session/actions.ts:133–169
- **Detail**: Session outcome UPDATE and critical_miss event INSERTs are separate DB operations with no enclosing transaction. A crash between them leaves `outcome = "negative"` but no audit records for missed critical tests — the session page on reload shows "Negatywny" with an empty skipped-critical list.
- **Fix A ⭐ Recommended**: Accept as MVP debt; add follow-up to wrap in `db.transaction()` in next slice.
  - Strength: Outcome correctness preserved; only audit detail is lossy in rare crash window.
  - Tradeoff: Race window persists.
  - Confidence: HIGH — PgBouncer Transaction mode supports explicit transactions.
  - Blind spot: None significant.
- **Fix B**: Wrap both operations in `db.transaction()` now.
  - Strength: Full data integrity.
  - Tradeoff: Adds complexity; needs PgBouncer compatibility verification (it does work).
  - Confidence: MED.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — accepted as MVP debt; follow-up added to context/changes/first-playable-session/follow-ups/review-fixes.md

---

### F6 — endSessionAction does no early return for already-ended sessions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/modules/session/actions.ts:100–110
- **Detail**: When called on a session with `outcome !== "in_progress"`, the action still fetches all events, re-fetches all classifications, and re-runs the evaluator before the no-op UPDATE. `selectTestAction` already guards this at line 65.
- **Fix**: Add early return after ownership check: `if (sessionRow.outcome !== "in_progress") return { outcome: sessionRow.outcome, isFailed: sessionRow.isFailed, skippedCritical: [] }`
- **Decision**: PENDING

---

### F7 — CATEGORY_TO_RESULT not exported (plan specified export)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/shared/lib/validator.ts:17
- **Detail**: Plan Phase 2 contract listed `CATEGORY_TO_RESULT` as an exported const. Implementation declares it without `export`. No consumer imports it today — zero runtime impact.
- **Fix**: Add `export` keyword to the const declaration.
- **Decision**: PENDING

---

### F8 — `category` prop declared in TestCardProps but never used

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/modules/session/components/TestCard.tsx:9,21
- **Detail**: `category?: TestCategory` is in the interface and passed by SessionView (SessionView.tsx:181) but never referenced inside the component. Badge styling is driven by `data-result` CSS attribute.
- **Fix**: Remove `category` from `TestCardProps` and the call site in SessionView, or implement per-category styling if that was the intent.
- **Decision**: PENDING

---

### F9 — startedAt typed as Date but runtime value is string

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/modules/session/components/SessionView.tsx:20
- **Detail**: Next.js serializes Date objects to ISO strings across the RSC→client boundary. Prop is typed `Date` but arrives as `string`. No runtime bug (`new Date(startedAt)` at line 50 handles it) but the TypeScript type is misleading.
- **Fix**: Change prop type to `startedAt: string`.
- **Decision**: PENDING
