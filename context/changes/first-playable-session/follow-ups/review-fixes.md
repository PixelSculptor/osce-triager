# Review Follow-ups — first-playable-session

Items deferred from the impl-review triage. Address in the next slice (S-03 or a dedicated hardening change).

---

## [F1] Remove `classifications` prop from SessionView

**Why**: The full classification map (answer key) is serialized into the RSC flight response and visible in browser devtools during an active session. Accepted as MVP debt — see plan's "What We Are NOT Doing".

**What to do**:
- Remove `classifications: Record<string, TestCategory>` from `SessionViewProps` in `SessionView.tsx`
- Have `selectTestAction` return `category` alongside `validatorResult` (already in `SelectTestResult` type)
- In the RSC page (`session/[sessionId]/page.tsx`), pre-map `initialEvents` to include `category` per event (look up from classifications on the server, pass only the per-event result to the client)
- Delete the `classifications` prop from the `<SessionView>` render call

**Files**: `src/modules/session/components/SessionView.tsx`, `src/app/dashboard/session/[sessionId]/page.tsx`

---

## [F5] Wrap session finalization in db.transaction()

**Why**: `endSessionAction` updates `session_result` and then inserts `session_event` rows for skipped critical tests as two separate DB operations. A crash between them leaves `outcome = "negative"` but no audit records for missed tests — student would see "Negatywny" with an empty skipped-critical list.

**What to do**:
- In `endSessionAction` (actions.ts), wrap the `claimed` UPDATE and the `skippedCritical` INSERT inside `db.transaction(async (tx) => { ... })` using Drizzle's transaction API
- PgBouncer Transaction mode is compatible with explicit transactions

**Files**: `src/modules/session/actions.ts`
