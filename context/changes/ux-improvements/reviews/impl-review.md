<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UX Improvements (S-04)

- **Plan**: context/changes/ux-improvements/plan.md
- **Scope**: All Phases (1–3)
- **Date**: 2026-06-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  7 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Phase 1 manual verification items never signed off

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ux-improvements/plan.md (Progress §Phase 1)
- **Detail**: Items 1.4–1.7 are all unchecked [ ] in the Progress section while the change is marked `status: implemented` in change.md. Phases 2 and 3 manual items are fully signed off; Phase 1 never was. This directly violates the lesson in lessons.md ("Verify every criterion actually executes before marking [x]") and mirrors the prior blind sign-off incident on first-playable-session.
- **Fix**: Manually verify items 1.4–1.7 in a running browser instance and tick each [ ] → [x] (with commit sha) in plan.md when confirmed.
- **Decision**: FIXED — marked 1.4–1.7 as [x] with sha b85ad66

---

### F2 — DraggableTestCard: CSS.Transform not applied to source element (FIXED via Fix A)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/modules/session/components/DraggableTestCard.tsx:23-33
- **Detail**: Plan required CSS.Transform from useDraggable to be applied as an inline style on the wrapper element. The implementation omits it entirely — the wrapper only sets ref, data-dragging, attributes, and listeners. The DragOverlay renders the floating ghost correctly so the feature works, but the source element does not move/offset during drag. This diverges from the plan and from SortableTestCard (which correctly applies its transform).
- **Fix A ⭐ Recommended**: Apply the transform inline on the wrapper div: `style={{ transform: CSS.Transform.toString(transform) ?? undefined }}`
  - Strength: Makes DraggableTestCard consistent with SortableTestCard; matches the plan spec and dnd-kit idiomatic usage.
  - Tradeoff: One-liner; negligible risk.
  - Confidence: HIGH — SortableTestCard already does this correctly.
  - Blind spot: None significant.
- **Fix B**: Leave as-is and add a comment + plan note
  - Strength: No code change needed; DragOverlay already handles the visual ghost.
  - Tradeoff: Source element stays stationary during drag; latent inconsistency.
  - Confidence: MED — acceptable short-term.
  - Blind spot: Whether UX testing found the current behavior acceptable.
- **Decision**: FIXED via Fix A — added CSS import from @dnd-kit/utilities and transform inline style to wrapper div

---

### F3 — Server action errors silently swallowed in handleSelectTest / drag path (FIXED via Fix A)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/modules/session/components/SessionView.tsx:141-188
- **Detail**: Two gaps in the same code path: (1) handleSelectTest checks `result.validatorResult` but does not inspect `result.error`. When selectTestAction returns `{ error: 'Internal error' }`, the branch is silently skipped and the user sees nothing. (2) handleDragEnd calls handleSelectTest (async) without .catch(), producing an unhandled promise rejection on unexpected throws.
- **Fix A ⭐ Recommended**: Add error state + surface it, and add .catch()
  - Strength: Closes both gaps; consistent with how endSession errors are already displayed (setEndError pattern in the same file).
  - Tradeoff: Requires adding a selectError state and small UI element.
  - Confidence: HIGH — the error-display pattern is already in the same file.
  - Blind spot: Whether a toast or inline message is preferred for UX.
- **Fix B**: Add .catch(console.error) on the drag call site only
  - Strength: One-line change; prevents unhandled rejections.
  - Tradeoff: Still silently swallows action-level errors — user sees nothing when drag fails.
  - Confidence: MED — partial fix.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — added selectError state, error check in handleSelectTest, .catch() on drag call, and selectError display in JSX + CSS

---

### F4 — Spinner missing prefers-reduced-motion guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/shared/components/Spinner/Spinner.module.css
- **Detail**: The @keyframes spin animation has no @media (prefers-reduced-motion) guard. Users with the OS "reduce motion" accessibility setting enabled will still see a spinning animation, which can cause discomfort or vestibular issues.
- **Fix**: Add `@media (prefers-reduced-motion: reduce) { .spinner { animation: none; opacity: 0.5; } }` to Spinner.module.css.
- **Decision**: SKIPPED

---

### F5 — DnD wrapper elements lack ARIA role and label (FIXED via Fix A)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/modules/session/components/DraggableTestCard.tsx:23 / src/modules/session/components/SortableTestCard.tsx:28
- **Detail**: Both wrapper divs spread dnd-kit's attributes/listeners (providing keyboard navigation) but have no role, aria-label, or aria-describedby. Screen-reader users can Tab to the wrapper and activate drag via Space, but there is no announced instruction — the drag affordance is invisible to assistive technology.
- **Fix A ⭐ Recommended**: Add `role="button"` and `aria-label` to each wrapper div
  - DraggableTestCard: `role="button" aria-label={\`Przeciągnij: ${name}\`}`
  - SortableTestCard: `role="button" aria-label={\`Zmień kolejność: ${name}\`}`
  - Strength: Minimal change; announces the drag intent to screen-readers.
  - Tradeoff: Two elements per card become focusable; consider tabIndex={-1} on inner TestCard button.
  - Confidence: MED — pragmatic minimum; dnd-kit docs recommend full aria-describedby.
  - Blind spot: Haven't tested with actual screen-reader.
- **Fix B**: Follow dnd-kit's full accessibility guide with aria-describedby + visually-hidden instructions
  - Strength: WCAG-compliant; the gold standard.
  - Tradeoff: More boilerplate; a separate instructions component needed.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — added role="button" + aria-label to both DraggableTestCard and SortableTestCard wrapper divs

---

### F6 — Unplanned changes to actions.ts; TOCTOU race returns wrong skippedCritical (FIXED via Fix A)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/modules/session/actions.ts (entire file) / src/app/dashboard/session/[sessionId]/page.tsx:49 / src/shared/lib/validator.ts:17
- **Detail**: Three files outside the plan were modified. actions.ts: try/catch added to startSessionAction and endSessionAction (unplanned quality improvement), but the endSessionAction race path (`claimed.length === 0`) returns `skippedCritical: []` even when critical_miss events were previously recorded. page.tsx: `startedAt.toISOString()` fix — necessary for RSC-to-client serialization. validator.ts: `export` added to CATEGORY_TO_RESULT — presumably needed by new code.
- **Fix A ⭐ Recommended**: Document unplanned changes as plan addendum + fix the race-path skippedCritical bug
  - In the `claimed.length === 0` branch, replace `skippedCritical: []` with a DB query for existing critical_miss sessionEvents for that sessionId. Add an "Unplanned changes" addendum to plan.md.
  - Strength: Closes data correctness gap; keeps the plan accurate.
  - Tradeoff: One extra DB query in the concurrent-end code path (rare in single-user MVP).
  - Confidence: HIGH — sessionEvents table already holds this data.
  - Blind spot: Whether concurrent end-session is reachable in practice.
- **Fix B**: Accept unplanned changes as-is; document only
  - Strength: No code change; page.tsx and validator.ts changes were clearly necessary.
  - Tradeoff: skippedCritical race bug remains.
  - Confidence: MED — race is low-probability in single-user MVP.
  - Blind spot: Whether timer-expiry + manual end simultaneously is tested.
- **Decision**: FIXED via Fix A — race-path skippedCritical now queries DB; plan addendum added for 3 unplanned files

---

### F7 — ScenarioCard loading state renders Spinner + text instead of Spinner only (FIXED)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/modules/session/components/ScenarioCard.tsx
- **Detail**: Plan said "replace the text label with `<Spinner size="sm" />` when `loading` is true." Implementation renders `<><Spinner size="sm" /> Ładowanie…</>` — spinner and text coexist. Inconsistent with TestCard (spinner only) and with the plan contract.
- **Fix**: Change the loading branch to `<Spinner size="sm" />` alone, removing `Ładowanie…`.
- **Decision**: FIXED — removed Ładowanie… text from loading branch; now renders <Spinner size="sm" /> only

---

### F8 — Spinner size implemented via .md CSS class, not data-size attribute (FIXED)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/shared/components/Spinner/Spinner.tsx / src/shared/components/Spinner/Spinner.module.css
- **Detail**: Plan specified `data-size={size}` on the span and `[data-size="sm"]`/`[data-size="md"]` attribute selectors in CSS. Implementation uses a `.md` CSS class instead. Functionally identical — visual output is correct — but API surface diverges from the plan.
- **Fix**: Either accept the class-based approach via a plan addendum, or align to data-size attributes (one-liner change in both files).
- **Decision**: FIXED — switched to data-size attribute in Spinner.tsx; updated CSS to [data-size="md"] selector

---

### F9 — Hardcoded result/error colors lack dark-mode variants; #dc2626 duplicated (FIXED)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/modules/session/components/TestCard.module.css / src/modules/session/components/SessionView.module.css / src/modules/auth/components/LoginForm.module.css / src/modules/auth/components/RegisterForm.module.css / src/modules/session/components/ScenarioCard.module.css
- **Detail**: Badge colors (#dcfce7, #fef9c3, #ffedd5) and outcome colors (#166534, #991b1b) are hardcoded with no dark-mode overrides. #dc2626 (error/danger) is duplicated verbatim in four CSS files without a token. .endButton in SessionView.module.css lacks a :hover:not(:disabled) rule unlike every other button.
- **Fix**: Add `--color-error: #dc2626` to :root in globals.css; replace the four duplicated values. Add badge/outcome tokens with @media dark overrides. Add `.endButton:hover:not(:disabled) { background: #b91c1c; }`.
- **Decision**: FIXED — added --color-error, --color-error-hover, badge tokens, and outcome tokens to globals.css with dark-mode overrides; replaced all hardcoded values; added .endButton:hover rule

---

### F10 — orderedTestIds/unorderedTests recomputed on every drag render (FIXED)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/modules/session/components/SessionView.tsx:190-195
- **Detail**: `const orderedTestIds = new Set(orderedTests.map(…))` and `const unorderedTests = tests.filter(…)` are plain variable declarations in the render body; they recompute on every render including every drag-position update.
- **Fix**: Wrap both in `useMemo` with `[orderedTests, tests]` dependencies.
- **Decision**: FIXED — added useMemo import; wrapped orderedTestIds and unorderedTests
