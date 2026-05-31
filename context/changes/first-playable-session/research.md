---
date: 2026-05-31T19:26:29+0000
researcher: Claude Sonnet 4.6
git_commit: 913506f63c79e48a3a53d95fc16ddb6dcae1f2d5
branch: north-star-first-playable-flow
repository: PixelSculptor/osce-traiger
topic: "Algorithm compatibility check: pre-classified lookup table + rule engine vs current data model for S-02"
tags: [research, codebase, validator, data-model, schema, seed, server-actions, s-02]
status: complete
last_updated: 2026-05-31
last_updated_by: Claude Sonnet 4.6
---

# Research: Algorithm Compatibility Check for S-02 Validator

**Date**: 2026-05-31T19:26:29+0000  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: `913506f63c79e48a3a53d95fc16ddb6dcae1f2d5`  
**Branch**: `north-star-first-playable-flow`  
**Repository**: PixelSculptor/osce-traiger

---

## Research Question

Can the **pre-classified lookup table + pure rule engine** algorithm (identified in `classification-algorithm-research.md`) be implemented directly against the existing codebase and data model, and is it compatible with the schema and patterns already in place?

---

## Summary

**Verdict: Compatible — with one schema gap requiring a deliberate decision before planning.**

The algorithm family selected in the external research (pre-classified lookup table + pure rule engine, <1 ms, deterministic, server-side) maps almost perfectly onto the existing data model. The seed data, classification tiers, `isFailed` flag, and Server Action pattern are all in place. The single friction point is a 3-vs-4 vocabulary mismatch between `sessionEvents.validatorResult` (3 values: `correct | suboptimal | critical_miss`) and the algorithm's 4-tier input (`critical | optimal | acceptable | unnecessary`). This is resolvable without a full re-design: either extend the enum or define a deliberate 4→3 mapping. Everything else is directly usable.

---

## Detailed Findings

### 1. Classification tiers — EXACT MATCH

The schema's `testClassifications.classification` column (`src/shared/lib/schema.ts:93–95`) is typed as:

```typescript
.$type<"critical" | "optimal" | "acceptable" | "unnecessary">()
```

This is **byte-for-byte identical** to the research document's proposed `TestCategory` union (`classification-algorithm-research.md:98`). No type coercion or mapping needed when reading from the database into the validator function.

The seed data (`src/shared/lib/seed.ts:50–69`) populates 36 classification rows (18 tests × 2 scenarios) using these exact values. The lookup table the algorithm needs already exists in the DB and is correctly seeded:

| Test | Scenario 1 (chest pain) | Scenario 2 (consciousness) |
|------|------------------------|---------------------------|
| dt-001 EKG | **critical** | acceptable |
| dt-002 Troponiny | **critical** | unnecessary |
| dt-003 Glukoza | acceptable | **critical** |
| dt-004 KT głowy | unnecessary | **critical** |
| dt-005 Morfologia | optimal | optimal |
| dt-006 Elektrolity | optimal | optimal |
| ... | ... | ... |

**Code reference:** `src/shared/lib/schema.ts:84–98` — `testClassifications` table definition.

### 2. `isFailed` flag — EXACT MATCH

`sessionResults.isFailed` (`src/shared/lib/schema.ts:114`) is a `boolean`, defaulting to `false`. This is the exact storage location for the research's `irreversibleFail` concept (non-compensatory model: session forced to 0 if any `critical` test was not ordered by session end).

The `evaluateSessionEnd()` function proposed in the research writes directly to this field. The `outcome` column (`"in_progress" | "positive" | "negative"`) provides the session state machine needed to know when to run the end-of-session evaluation.

**Code reference:** `src/shared/lib/schema.ts:100–117` — `sessionResults` table.

### 3. Server Action pattern — COMPATIBLE

The codebase uses a consistent Server Action pattern established in `src/modules/auth/actions.ts:1`:

```
"use server" → async function(prevState, formData) → returns typed state
```

The proposed `validateTestSelection()` and `evaluateSessionEnd()` from the research are pure functions (no `prevState`, no `formData`) — they are **internal utilities** called from a Server Action, not Server Actions themselves. This is the correct architectural layer:

```
Client component
  → Server Action (new: src/modules/session/actions.ts)
      → validateTestSelection() / evaluateSessionEnd() (src/shared/lib/validator.ts)
          → DB read: testClassifications lookup
          → DB write: sessionEvents + sessionResults update
```

No pattern deviation from the established auth module structure. A new `src/modules/session/` module is needed; `src/modules/auth/` is the canonical reference.

**Code reference:** `src/modules/auth/actions.ts:1–97` — established Server Action pattern.

### 4. ⚠️ SCHEMA GAP: `validatorResult` 3-vs-4 vocabulary mismatch

This is the **only compatibility gap** found.

`sessionEvents.validatorResult` (`src/shared/lib/schema.ts:129–131`) is typed as:

```typescript
.$type<"correct" | "suboptimal" | "critical_miss">()
```

The algorithm produces 4 categories; the schema stores 3. The mapping is currently ambiguous for `unnecessary`:

| Algorithm output (`TestCategory`) | DB storage (`validatorResult`) | Gap? |
|-----------------------------------|-------------------------------|------|
| `critical` ordered | `correct` | No |
| `optimal` ordered | `correct` | No |
| `acceptable` ordered | `suboptimal` | No |
| `unnecessary` ordered | **???** | **YES — no slot** |
| `critical_miss` at session end | `critical_miss` | Ambiguous (see below) |

**Two viable resolutions for planning to choose between:**

**Option A — Extend enum (requires migration):** Add `"unnecessary"` to `validatorResult`. `critical_miss` is then reserved for synthetic session-end events (one record per each critical test that was never ordered — written by `evaluateSessionEnd()`). This is semantically cleanest and preserves all audit data for S-03 scoring.

**Option B — 4→3 collapse (no migration):** Map `critical` and `optimal` → `correct`; `acceptable` → `suboptimal`; `unnecessary` → `critical_miss` (repurposed to mean "bad selection"). Session-end critical checks are performed in memory via `isFailed` flag only, not persisted per-test in `sessionEvents`. This avoids a migration but loses granularity for S-03.

**Recommendation**: Option A. The `isFailed` flag already handles the binary session outcome. `critical_miss` as currently named strongly implies "a critical test was missed", not "an unnecessary test was selected" — collapsing these in Option B creates misleading audit data and will cause confusion when implementing S-03 history.

**Code reference:** `src/shared/lib/schema.ts:119–133` — `sessionEvents` table with the 3-value enum.

### 5. No `validator.ts` exists yet — clean slate

`src/shared/lib/` currently contains only `db.ts`, `schema.ts`, and `seed.ts`. There is **no** `validator.ts`. The proposed `src/shared/lib/validator.ts` from the research is a clean addition with zero conflicts.

The file should be marked `server-only` (or simply never imported from client components) per the PRD's determinism NFR.

**Code reference:** `src/shared/lib/` — 3 files, inventory complete.

### 6. No gameplay module exists — clean slate for `src/modules/session/`

`src/modules/` contains only `auth/`. No session, gameplay, or scenario module exists. The pattern to follow:

```
src/modules/auth/
├── actions.ts          → Server Actions
├── auth.ts             → domain service instance
├── auth.config.ts      → shared config
├── user.util.ts        → domain utilities
└── components/         → feature-specific React components
    ├── LoginForm.tsx
    ├── RegisterForm.tsx
    └── SubmitButton.tsx
```

The new `src/modules/session/` will mirror this structure with session-specific actions, utilities, and components.

**Code reference:** `src/modules/auth/` — canonical feature module structure.

### 7. `dashboard` page exists but is a placeholder

`src/app/dashboard/page.tsx` exists but (based on exploration) contains no gameplay UI. The S-02 session page will likely need `src/app/dashboard/session/[scenarioId]/page.tsx` or similar — a new App Router segment. No conflicts with existing pages.

---

## Code References

- `src/shared/lib/schema.ts:84–98` — `testClassifications` table; 4-tier classification enum that matches `TestCategory` exactly
- `src/shared/lib/schema.ts:100–117` — `sessionResults` table; `isFailed` flag + `outcome` state machine
- `src/shared/lib/schema.ts:119–133` — `sessionEvents` table; **3-value `validatorResult`** — the gap
- `src/shared/lib/seed.ts:47` — `Classification` type in seed (identical to schema's inline enum)
- `src/shared/lib/seed.ts:50–69` — 36 classification rows across 2 scenarios — the lookup table already loaded
- `src/shared/lib/db.ts:1–8` — Drizzle client (`prepare: false` for Supabase PgBouncer)
- `src/modules/auth/actions.ts:1–97` — canonical Server Action pattern to follow

---

## Architecture Insights

### Algorithm maps cleanly onto existing schema

The pre-classified lookup table algorithm's runtime data flow:

```
1. Session start: SELECT classification FROM test_classification WHERE scenario_id = $id
   → builds Record<testId, TestCategory> in memory (once per session)

2. Per test selection (Server Action):
   → classify(testId) against in-memory map = O(1), <1 ms
   → INSERT session_event (testId, validatorResult, selectedAt)

3. Session end (Server Action):
   → evaluateSessionEnd(): find critical tests not in ordered set
   → UPDATE session_result SET is_failed = true, outcome = 'negative' WHERE ...
```

Step 1 requires a single DB read at session start. Steps 2 and 3 are writes. The schema supports all three steps with existing tables.

### `testClassifications` has composite PK — no relational shortcut in Drizzle

The schema declares FK columns but **no Drizzle `relations()`**. The classification lookup in step 1 above requires a raw `db.select()` with `.where(eq(testClassifications.scenarioId, scenarioId))` — no Drizzle `with` clause available. This is fine for a single query at session start.

### Server-only enforcement

The Cloudflare Workers runtime + Next.js App Router enforces server/client boundaries via `"use server"` and the `server-only` package. `validator.ts` functions should either use `server-only` at the top or be imported exclusively from Server Actions. The auth module does not use `server-only` explicitly — it relies on convention. For the validator, explicit `import "server-only"` is safer given the PRD's determinism NFR.

---

## Historical Context (from prior changes)

- `context/changes/data-schema/plan.md` — F-02 plan that designed `testClassifications` + `sessionEvents` schema; confirms `validatorResult` 3-value enum was intentional at design time (though the `unnecessary` gap was not noted)
- `context/changes/first-playable-session/change.md` — S-02 identity: "validator must respond in <1 s; classification logic must be deterministic and server-side only"

---

## Related Research

- `context/changes/first-playable-session/classification-algorithm-research.md` — External research that selected the algorithm; this document validates it against internal codebase

---

## Open Questions

1. **Option A or B for `validatorResult` gap?** — **DECIDED: Option A.** Add `"unnecessary"` to the `validatorResult` enum in `schema.ts`. Run `drizzle-kit generate` to produce the migration SQL, then `drizzle-kit migrate` (or add the step to `deploy.yml`). `critical_miss` is reserved exclusively for session-end synthetic events recording critical tests that were never ordered.

2. **Session page URL structure?** — `src/app/dashboard/session/[scenarioId]/page.tsx` or `src/app/session/[scenarioId]/page.tsx`? Dashboard is the only protected area today; session should live inside it (`/dashboard/session/[id]`).

3. **Timer implementation?** — Client-side countdown only (no server clock) is acceptable for MVP. Session start time is recorded in `sessionResults.startedAt`; client uses `timeLimitSeconds` from the scenario row to compute deadline.

4. **`classifications` map lifetime?** — Should the `Record<testId, TestCategory>` be loaded on page render (Server Component) and passed as props to client components, or fetched fresh in each Server Action call? Loading once at page render (RSC) is the correct pattern — avoids a DB round-trip per test selection.
