# UX Improvements (S-04) — Plan Brief

> Full plan: `context/changes/ux-improvements/plan.md`
> Research: `context/changes/ux-improvements/research.md`
> DnD research: `context/changes/ux-improvements/drag-n-drop-research.md`

## What and Why

S-04 replaces the raw black-and-white UI with a polished, interactive experience: coherent indigo-accented palette with depth, smooth CSS transitions, spinner loading states, and cross-container drag-and-drop in the session view. The app currently has zero transitions or animations, text-only loading indicators, and no DnD anywhere.

## Point of Departure

Pure CSS Modules, no animation library, no DnD library. Only two design tokens (`--background`, `--foreground`). `SessionView` is already `'use client'`; `orderedTests` is a plain `useState` array — DnD integration requires no RSC boundary changes.

## Desired End State

A student can drag test cards from the available list directly into their ordered list during a session. All interactive surfaces respond with hover lifts, shadows, and smooth transitions. Buttons show an animated spinner while async operations are in flight.

## Key Decisions

| Decision | Choice | Why | Source |
|---|---|---|---|
| DnD library | `@dnd-kit/core` + `@dnd-kit/sortable` | 9 KB, App Router compatible, `SessionView` already client component | Research |
| DnD scope | Drag from available → ordered + reorder within ordered | Covers the roadmap requirement; click-to-select stays as fallback | Plan |
| Animation strategy | CSS transitions only | Zero new dependencies; follows existing CSS Modules pattern | Plan |
| Colour palette scope | Additive tokens only (7 new variables in globals.css) | Small diff, zero regression risk on existing screens | Plan |
| Loading states | CSS spinner component | Zero dependencies; slots into existing `isLoading`/`pending` state machine | Plan |
| Drag drop opt-out | Server action guard preserved (`loadingTestId` check) | Prevents double-fire; existing guard in `handleSelectTest` already handles it | Plan |

## Scope

**In scope:**
- 7 new CSS custom properties in `globals.css`
- CSS `transition`, `box-shadow`, `:hover` additions across 7 module files
- `Spinner` component (new, shared, pure CSS)
- Spinner wired into 4 loading call sites
- `DraggableTestCard` + `SortableTestCard` wrappers (new)
- `SessionView` DnD wiring: `DndContext`, `onDragStart/End`, `DragOverlay`

**Out of scope:**
- Replacing existing hardcoded colour values (full token refactor)
- Skeleton screens
- `framer-motion`
- Drag-back from ordered to available
- Dark mode token updates

## Architecture

CSS Modules throughout — Phase 1 extends globals.css with palette/transition tokens and updates module files. Phase 2 adds a shared `Spinner` component under `src/shared/components/`. Phase 3 wraps the two session columns in `DndContext` with thin `DraggableTestCard`/`SortableTestCard` wrappers; `onDragEnd` branches on `source` data attribute to either call `selectTestAction` (cross-container) or `arrayMove` (within-right).

## Phases in Brief

| Phase | Delivers | Key Risk |
|---|---|---|
| 1. Design tokens + transitions | Shadows, hover lifts, indigo accent, smooth transitions everywhere | Regression on existing colour/opacity values if not purely additive |
| 2. CSS spinner | Animated ring replaces text loading labels on 4 components | None — purely additive |
| 3. Cross-container DnD | Drag to select + reorder in session view | `onDragEnd` must respect `loadingTestId` guard to prevent double action fire |

**Prerequisites:** F-01, F-02, F-03 (all done); `@dnd-kit/core` + `@dnd-kit/sortable` install (Phase 3 only)
**Estimated effort:** ~2–3 sessions across 3 phases

## Open Risks

- DnD gesture vs click conflict on mobile: `PointerSensor` with `activationConstraint: { distance: 8 }` prevents accidental drags on tap — verify on a real touch device.
- `@dnd-kit/core` v6.3.1 is ~1 year old; `@dnd-kit/react` successor exists but is pre-stable. Acceptable for this scope.

## Success Criteria

1. Student can drag a test from the left column and see it appear in the right column with a result badge (after server confirmation).
2. All interactive surfaces have visible hover states and smooth CSS transitions.
3. Every async operation shows an animated spinner, not placeholder text.
