# UX Improvements (S-04) — Implementation Plan

## Overview

Upgrade the OSCE Triager UI from a raw black-and-white minimal interface to a polished, interactive experience: a coherent colour palette with shadows and depth, smooth CSS transitions on all interactive surfaces, a reusable CSS spinner replacing text-only loading states, and cross-container drag-and-drop in the session view so students can drag tests from the available list directly into their ordered list.

## Current State

- Zero CSS transitions, animations, or DnD anywhere in the codebase.
- Loading states are text-only label swaps (`"…"`, `"Ładowanie…"`, `"Kończenie…"`).
- `globals.css` has only two design tokens (`--background`, `--foreground`); all semantic colours are hardcoded per module file.
- `SessionView` renders two columns — left (available tests, click-to-select) and right (ordered tests, result badges). No drag capability.
- `SessionView.tsx` is already `'use client'`; `orderedTests` is a plain `useState` array — DnD integration requires no RSC boundary changes.

## Desired End State

- A student opens any screen and sees cards with subtle shadows, hover lift effects, and smooth transitions on all buttons and interactive surfaces.
- Buttons show an animated CSS spinner instead of text while an async operation is in flight.
- During a session the student can drag a test card from the available list (left column) onto the ordered list (right column) to select it — the existing click-to-select button remains as a fallback. Cards within the ordered list can also be reordered by dragging.

### Key Findings

- `src/modules/session/components/SessionView.tsx:1` — already `'use client'`; `orderedTests` state at line 36; `handleSelectTest` at line 101 (calls `selectTestAction` server action; has `loadingTestId` guard).
- `src/modules/session/components/TestCard.tsx` — two render modes: selectable (left) and result-badged (right). Props: `name`, `validatorResult?`, `onSelect?`, `isLoading?`.
- `src/app/globals.css` — 50 lines, only `--background`/`--foreground` tokens; safe to extend.
- `package.json` — no animation or DnD libraries; confirmed scripts: `typecheck`, `lint`, `build`.

## What We Are NOT Doing

- Full token refactor (replacing existing hardcoded hex/rgba values in 8 module files) — additive tokens only.
- Skeleton screens / shimmer loaders for page-level content.
- Drag-from-right-back-to-left (unselect via drag) — click interaction only.
- `framer-motion` or any JS animation library.
- Dark mode token updates beyond what `@media (prefers-color-scheme: dark)` already handles for the base tokens.
- Reordering the available (left) list.

## Implementation Approach

Three sequential phases, each independently verifiable:

1. **Design tokens + CSS transitions** — extend `globals.css` with 7 new custom properties; add `transition`, `box-shadow`, and hover states across all interactive CSS modules.
2. **CSS spinner** — build a zero-dependency spinner component, wire it into the four existing loading-state call sites.
3. **Cross-container DnD** — install `@dnd-kit/core` + `@dnd-kit/sortable`; wrap both session columns in `DndContext`; create `DraggableTestCard` and `SortableTestCard` wrappers; implement cross-container and within-container drag handlers.

## Critical Implementation Details

**Phase 3 — drag optimism**: `handleSelectTest` is async (server action). When a user drops a card from left to right, the item must visually stay in the left column until the action resolves — the existing `loadingTestId` state already shows a loading indicator on the dragged card. Do not optimistically move the item; let the existing `setOrderedTests` call inside `handleSelectTest` handle the state update on success.

**Phase 3 — drag guard**: `handleSelectTest` guards against concurrent drags with `if (loadingTestId || sessionState !== 'in_progress') return`. `onDragEnd` must respect this same guard — cancel the drop silently if `loadingTestId` is already set.

---

## Phase 1: Design Tokens + CSS Transitions

### Overview

Extend `globals.css` with a 7-token palette covering primary accent, shadows, and transition durations. Apply transitions and hover states across all CSS module files. Add card shadows for depth.

### Required Changes

#### 1. globals.css — new design tokens

**File**: `src/app/globals.css`

**Goal**: Provide shared palette tokens for the new visual treatments added in S-04. Tokens are additive — existing `--background`/`--foreground` declarations are untouched.

**Contract**: Append inside `:root` (and mirror in the `@media (prefers-color-scheme: dark)` block where appropriate):

```css
/* S-04 palette tokens */
--color-primary: #6366f1;
--color-primary-hover: #4f46e5;
--color-primary-muted: rgba(99, 102, 241, 0.08);
--shadow-card: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05);
--shadow-card-hover: 0 4px 8px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
--transition-fast: 120ms ease;
--transition-base: 200ms ease;
```

Dark mode shadow override (shadows flatten in dark mode):
```css
@media (prefers-color-scheme: dark) {
  --shadow-card: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --shadow-card-hover: 0 4px 8px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.25);
}
```

#### 2. TestCard.module.css — transitions + hover + shadow

**File**: `src/modules/session/components/TestCard.module.css`

**Goal**: Make test cards feel tactile — shadow on rest, lift on hover, smooth button state changes.

**Contract**:
- `.card`: add `box-shadow: var(--shadow-card)` and `transition: box-shadow var(--transition-fast), transform var(--transition-fast)`
- `.card:hover` (only when not selected): `box-shadow: var(--shadow-card-hover); transform: translateY(-1px)`
- `.button`: add `transition: opacity var(--transition-fast), background var(--transition-fast)`, upgrade background to `var(--color-primary)`, update color accordingly
- `.button:hover:not(:disabled)`: `background: var(--color-primary-hover)`
- `.button:disabled`: normalise to `opacity: 0.6` (currently 0.5 — inconsistent with other components)

#### 3. ScenarioCard.module.css — transitions + hover + shadow

**File**: `src/modules/session/components/ScenarioCard.module.css`

**Goal**: Mirror TestCard treatment for scenario selection cards.

**Contract**: Same shadow + lift pattern as TestCard. Button gets `--color-primary` background + hover transition. Disabled opacity stays at 0.6.

#### 4. Nav.module.css — transitions

**File**: `src/shared/components/Nav/Nav.module.css`

**Goal**: Smooth the existing hover state on links and logout button.

**Contract**:
- `.links a`: add `transition: text-decoration-color var(--transition-fast)`
- `.logoutButton`: add `transition: background var(--transition-fast)`

#### 5. LoginForm.module.css + RegisterForm.module.css — transitions

**Files**: `src/modules/auth/components/LoginForm.module.css`, `src/modules/auth/components/RegisterForm.module.css`

**Goal**: Input focus transition and button hover.

**Contract**:
- `.field input`: add `transition: outline var(--transition-fast), border-color var(--transition-fast)`
- `.submit button`: add `transition: opacity var(--transition-fast), background var(--transition-fast)`, upgrade to `--color-primary` background + hover state

#### 6. SessionView.module.css — header card shadow + button transition

**File**: `src/modules/session/components/SessionView.module.css`

**Goal**: Session header and end button feel polished.

**Contract**:
- `.header`: add `box-shadow: var(--shadow-card)`
- `.endButton`: add `transition: opacity var(--transition-fast)` (keep existing `#dc2626` — danger colour is intentional)
- `.backLink` on result screen: add `transition: opacity var(--transition-fast)`, upgrade background to `--color-primary`

#### 7. auth.module.css — card shadow

**File**: `src/app/(auth)/auth.module.css`

**Goal**: Auth layout card gets depth to distinguish it from the page background.

**Contract**: Add `box-shadow: var(--shadow-card)` to the card rule.

### Criteria for Success

#### Automatic

- `npm run typecheck` passes
- `npm run lint` passes
- `npm run build` completes without error

#### Manual

- Open the landing page — primary buttons have indigo background and transition smoothly on hover
- Open `/login` — card has visible shadow; input focus shows smooth outline transition
- Open `/dashboard` — scenario cards lift slightly on hover with shadow
- Open a session — header has shadow; test cards lift on hover; "Zleć" buttons transition on hover

---

## Phase 2: CSS Spinner for Loading States

### Overview

Create a shared `Spinner` component (pure CSS `@keyframes` ring, zero dependencies) and wire it into the four existing text-only loading states.

### Required Changes

#### 1. Spinner component

**File**: `src/shared/components/Spinner/Spinner.tsx`

**Goal**: A reusable inline spinner that renders a small animated ring, accessible via `role="status"` and `aria-label`.

**Contract**: Accepts a `size?: 'sm' | 'md'` prop (default `'sm'`). Renders `<span role="status" aria-label="Ładowanie" className={styles.spinner} data-size={size} />`. Exports named `Spinner`.

**File**: `src/shared/components/Spinner/Spinner.module.css`

**Contract**: `@keyframes spin` (0° → 360° on `transform: rotate`). `.spinner` is a circular element with `border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite`. `[data-size="sm"]` sets `width: 14px; height: 14px`. `[data-size="md"]` sets `width: 20px; height: 20px`. Uses `currentColor` so it inherits button text colour automatically.

#### 2. Wire Spinner into SubmitButton

**File**: `src/modules/auth/components/SubmitButton.tsx`

**Goal**: Replace the text `loadingLabel` with a spinner + text when the form is pending.

**Contract**: Import `Spinner`. When `pending` is true, render `<><Spinner size="sm" /> {loadingLabel}</>` instead of just `{loadingLabel}`. Add `display: inline-flex; align-items: center; gap: 0.375rem` to the button style (via inline style or module update) so spinner and text sit on the same baseline.

#### 3. Wire Spinner into TestCard

**File**: `src/modules/session/components/TestCard.tsx`

**Goal**: Replace the `"…"` placeholder with a spinner when `isLoading` is true.

**Contract**: Import `Spinner`. In the button render: `{isLoading ? <Spinner size="sm" /> : "Zleć"}`. Button already has `disabled={isLoading}` — no change needed.

#### 4. Wire Spinner into ScenarioCard

**File**: `src/modules/session/components/ScenarioCard.tsx`

**Goal**: Replace `"Ładowanie…"` text with a spinner.

**Contract**: Import `Spinner`. In the button render: replace the text label with `<Spinner size="sm" />` when `loading` is true.

#### 5. Wire Spinner into SessionView end button

**File**: `src/modules/session/components/SessionView.tsx`

**Goal**: Replace `"Kończenie…"` with a spinner.

**Contract**: Import `Spinner`. In the end session button: `{isEnding ? <><Spinner size="sm" /> Kończenie…</> : "Zakończ sesję"}`. Use inline-flex on the button (same gap pattern as SubmitButton).

### Criteria for Success

#### Automatic

- `npm run typecheck` passes
- `npm run lint` passes

#### Manual

- On `/login`: submit the form with wrong credentials — the button shows a spinning ring during the pending state, not text
- On `/dashboard`: click a scenario's start button — spinner appears during loading
- In a session: click "Zleć" on a test card — spinner appears on that card; clicking "Zakończ sesję" shows spinner while ending

---

## Phase 3: Cross-Container Drag-and-Drop

### Overview

Install `@dnd-kit/core` + `@dnd-kit/sortable`. Wrap both session columns in a `DndContext`. Create `DraggableTestCard` (left column) and `SortableTestCard` (right column) wrappers. Implement `onDragStart`/`onDragEnd` in `SessionView` to handle two gestures: dragging from left to right (select test, calls `selectTestAction`) and reordering within the right column (local state only). Add a `DragOverlay` for the floating ghost card. Existing click-to-select button remains for mobile/accessibility.

### Required Changes

#### 1. Install packages

**Goal**: Add DnD dependencies.

**Contract**: `npm install @dnd-kit/core @dnd-kit/sortable`. Both are client-only and require no configuration. Verify in `package.json` that both appear under `dependencies`.

#### 2. DraggableTestCard

**File**: `src/modules/session/components/DraggableTestCard.tsx`

**Goal**: Wrap `TestCard` with `useDraggable` for items in the available (left) column. Applies drag transform and `data-dragging` attribute for cursor styling.

**Contract**:
- `'use client'` directive required.
- Accepts same props as `TestCard` plus `testId: string`.
- Uses `useDraggable({ id: testId, data: { source: 'available', name } })`.
- Applies `transform` from `CSS.Transform.toString(transform)` as inline style on the wrapping element.
- Sets `data-dragging={isDragging}` on the wrapper for CSS cursor targeting.
- Renders `<TestCard {...props} />` inside.

**File**: `src/modules/session/components/DraggableTestCard.module.css` (optional — add `[data-dragging="true"] { opacity: 0.4; cursor: grabbing; }` and `.wrapper { cursor: grab; }`)

#### 3. SortableTestCard

**File**: `src/modules/session/components/SortableTestCard.tsx`

**Goal**: Wrap `TestCard` with `useSortable` for items in the ordered (right) column. Enables both reordering within the right column and receiving drops.

**Contract**:
- `'use client'` directive required.
- Accepts same props as `TestCard` plus `testId: string`.
- Uses `useSortable({ id: testId, data: { source: 'ordered' } })`.
- Applies `transform` (via `CSS.Transform.toString`) and `transition` from sortable as inline styles.
- Sets `ref={setNodeRef}`, `{...attributes}`, `{...listeners}` on the wrapping element.
- `data-dragging={isDragging}` for CSS.

#### 4. SessionView.tsx — DnD integration

**File**: `src/modules/session/components/SessionView.tsx`

**Goal**: Wire `DndContext`, the two wrapper components, and the drag event handlers into the existing session view.

**Contract**:

Imports to add:
```
DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors
  from '@dnd-kit/core'
SortableContext, arrayMove, verticalListSortingStrategy
  from '@dnd-kit/sortable'
DraggableTestCard, SortableTestCard (local)
```

State to add:
- `activeId: string | null` — tracks which item is being dragged; initialised `null`.
- `activeName: string | null` — name of the active dragged item (for `DragOverlay` label).

`useSensors`: configure `PointerSensor` (with `activationConstraint: { distance: 8 }` to avoid conflicts with click) and `KeyboardSensor`.

`handleDragStart({ active })`: set `activeId = active.id`, `activeName = active.data.current?.name ?? null`.

`handleDragEnd({ active, over })`:
- Always reset `activeId = null`, `activeName = null`.
- Guard: if `loadingTestId || sessionState !== 'in_progress'` → return.
- If `!over` → return.
- Cross-container drop: `active.data.current?.source === 'available'` — call `handleSelectTest(active.id as string, active.data.current.name)`.
- Within-right reorder: both `source === 'ordered'` → `setOrderedTests(prev => arrayMove(prev, oldIndex, newIndex))` where indices are derived from `prev.findIndex`.

JSX changes:
- Wrap `<div className={styles.columns}>` in `<DndContext sensors={…} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>`.
- Left column: replace `<TestCard … onSelect={…} isLoading={…} />` with `<DraggableTestCard testId={test.id} name={test.name} onSelect={…} isLoading={…} />`.
- Right column: wrap the map in `<SortableContext items={orderedTests.map(t => t.testId)} strategy={verticalListSortingStrategy}>`. Replace `<TestCard …>` with `<SortableTestCard testId={test.testId} name={test.name} validatorResult={test.validatorResult} />`.
- After `</DndContext>`: add `<DragOverlay>{activeId ? <TestCard name={activeName ?? ''} /> : null}</DragOverlay>`.

### Criteria for Success

#### Automatic

- `npm run typecheck` passes
- `npm run lint` passes
- `npm run build` completes without error

#### Manual

- In a session: drag a test card from the left column and drop it onto the right column — it appears in the right column with a spinner while the server action runs, then shows a result badge when confirmed
- A test that is mid-flight (spinner visible) cannot be dragged again
- Drag a card within the right column to a different position — it reorders instantly (no server call)
- Click "Zleć" on a left column card with pointer (not drag) — still works as before
- DragOverlay shows a ghost card while dragging
- Keyboard: Tab to a left-column card, Space to pick up, arrow keys to move, Space/Enter to drop (KeyboardSensor default behaviour)
- Session end / timer expiry during drag: `handleDragEnd` guard prevents action; drag resolves cleanly

---

## Testing Strategy

### Manual testing checklist

1. Phase 1 — load each page, verify hover/shadow/transition on all interactive surfaces; no regressions in auth, dashboard, or session flows.
2. Phase 2 — trigger every loading state (login submit, start scenario, select test, end session); verify spinner appears and button is disabled.
3. Phase 3 — full drag-and-drop walkthrough; click fallback; keyboard navigation; drag during loading guard; reorder in ordered list.

### No automated test suite

There are no test scripts in `package.json`. Success criteria rely on `typecheck`, `lint`, `build`, and the manual checklist above.

## References

- Internal research: `context/changes/ux-improvements/research.md`
- DnD library research: `context/changes/ux-improvements/drag-n-drop-research.md`
- `src/modules/session/components/SessionView.tsx` — primary integration target for Phase 3
- `src/modules/session/components/TestCard.tsx` — component wrapped in Phases 2 and 3
- `src/app/globals.css` — token extension target for Phase 1
- [@dnd-kit/core docs](https://docs.dndkit.com/) — DnD library reference
- [@dnd-kit/sortable docs](https://docs.dndkit.com/presets/sortable)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step is completed. Do not rename step titles.

### Phase 1: Design Tokens + CSS Transitions

#### Automatic

- [x] 1.1 `npm run typecheck` passes — b85ad66
- [x] 1.2 `npm run lint` passes — b85ad66
- [x] 1.3 `npm run build` completes without error — b85ad66

#### Manual

- [x] 1.4 Landing page — primary buttons have indigo background, transition on hover — b85ad66
- [x] 1.5 `/login` — auth card has shadow; input focus shows smooth outline transition — b85ad66
- [x] 1.6 `/dashboard` — scenario cards lift on hover with shadow — b85ad66
- [x] 1.7 Session view — header shadow; test cards lift on hover; "Zleć" buttons transition — b85ad66

### Phase 2: CSS Spinner

#### Automatic

- [x] 2.1 `npm run typecheck` passes — f6010e7
- [x] 2.2 `npm run lint` passes — f6010e7

#### Manual

- [x] 2.3 Login form pending state shows spinner on submit button — f6010e7
- [x] 2.4 Scenario card start button shows spinner while loading — f6010e7
- [x] 2.5 Test card "Zleć" shows spinner while selecting — f6010e7
- [x] 2.6 "Zakończ sesję" button shows spinner while ending — f6010e7

### Phase 3: Cross-Container DnD

#### Automatic

- [x] 3.1 `npm run typecheck` passes — 067b164
- [x] 3.2 `npm run lint` passes — 067b164
- [x] 3.3 `npm run build` completes without error — 067b164

#### Manual

- [x] 3.4 Drag from left column drops test into right column; spinner shows; result badge appears on confirmation — 067b164
- [x] 3.5 Mid-flight guard: dragging during active `loadingTestId` has no effect — 067b164
- [x] 3.6 Drag within right column reorders without server call — 067b164
- [x] 3.7 Click "Zleć" button still works (fallback) — 067b164
- [x] 3.8 DragOverlay ghost card visible during drag — 067b164
- [x] 3.9 Keyboard drag: Tab → Space → arrows → Space/Enter — 067b164
- [x] 3.10 Session end/timer expiry during drag resolves cleanly — 067b164

---

## Unplanned Changes (discovered during implementation)

Three files outside the original plan were modified. Recorded here as source-of-truth addendum (impl-review F6, 2026-06-03):

| File | Change | Reason |
|---|---|---|
| `src/modules/session/actions.ts` | Added try/catch to `startSessionAction` and `endSessionAction`; fixed race-path `skippedCritical` to query DB instead of returning `[]` | Error handling quality improvement; race-path correctness fix |
| `src/app/dashboard/session/[sessionId]/page.tsx` | `startedAt` prop changed from `Date` to `.toISOString()` string | Required: Next.js RSC cannot pass non-serializable `Date` objects to Client Components |
| `src/shared/lib/validator.ts` | Added `export` to `CATEGORY_TO_RESULT` constant | Required by new DnD integration code |
