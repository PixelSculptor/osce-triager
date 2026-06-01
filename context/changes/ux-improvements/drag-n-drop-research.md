---
date: 2026-06-01T00:00:00+02:00
researcher: Kacper Nadstoga
topic: "DnD library selection for Next.js 16 App Router — S-04 UX improvements"
tags: [research, external, drag-and-drop, dnd-kit, next-js, app-router]
status: complete
last_updated: 2026-06-01
last_updated_by: Kacper Nadstoga
parent_research: research.md
---

# Research: DnD Library for Next.js App Router (S-04)

## Question

Is `@dnd-kit/core` the right DnD library for this project's Next.js 16 App Router stack?

## Candidates Evaluated

| Library | Bundle | Downloads/wk | Status | App Router |
|---------|--------|-------------|--------|------------|
| `@dnd-kit/core` | 6 KB | ~2.8 M | ✅ Active (v6.3.1) | ✅ `'use client'` required |
| `@atlaskit/pragmatic-drag-and-drop` | 3.5 KB | ~180 K | ✅ Active (Atlassian) | ✅ Framework-agnostic |
| `react-beautiful-dnd` | 30 KB | ~1.2 M | ❌ **Deprecated** | ❌ Do not use |

## App Router / RSC Compatibility

`@dnd-kit/core` uses React hooks (`useDraggable`, `useDroppable`) — it **cannot run in Server Components**. The solution is straightforward: wrap the drag-and-drop list in a Client Component with `'use client'`. In this project the relevant container (`SessionView`) is already a client component (it uses `useState` / `useEffect`), so no architectural change is needed. `DndContext` + `SortableContext` sit at the top of the client subtree; `TestCard` items become `useSortable` consumers.

## Maintenance Nuance

`@dnd-kit/core` v6.3.1 was last published roughly a year ago. There is an in-development `@dnd-kit/react` package (a rearchitected successor), but the maintainer has not answered community questions about deprecation timelines or production readiness. **Assessment**: `@dnd-kit/core` is stable and battle-tested; the new package is pre-stable. For a small sortable list (≤ 20 test cards), `@dnd-kit/core` + `@dnd-kit/sortable` is safe to use today. Migrate to `@dnd-kit/react` once it reaches stable.

## Pragmatic DnD vs dnd-kit for This Use Case

`@atlaskit/pragmatic-drag-and-drop` is lower-level — animations, drag handles, and drop indicators all require custom implementation. For a simple **reorderable list** (test cards in a session), that overhead is unwarranted. `@dnd-kit/sortable` ships a ready-made `SortableContext` + `useSortable` hook that covers the exact use case.

## Decision

**Use `@dnd-kit/core` + `@dnd-kit/sortable`.**

- 6 KB core + ~3 KB sortable ≈ 9 KB total client bundle impact — acceptable.
- `useSortable` covers reorderable lists out of the box.
- Keyboard navigation and screen-reader announcements built in.
- `SessionView` is already a client component — zero RSC boundary changes needed.
- Avoid `react-beautiful-dnd` (deprecated) and `pragmatic-drag-and-drop` (overkill, low-level).

## Sources

- [dnd-kit vs react-beautiful-dnd vs Pragmatic DnD 2026 — PkgPulse](https://www.pkgpulse.com/guides/dnd-kit-vs-react-beautiful-dnd-vs-pragmatic-drag-drop-2026)
- [@dnd-kit/core — npm](https://www.npmjs.com/package/@dnd-kit/core)
- [NextJS Compatibility? · Issue #801 · clauderic/dnd-kit](https://github.com/clauderic/dnd-kit/issues/801)
- [Roadmap: @dnd-kit/react vs @dnd-kit/core · Discussion #1842](https://github.com/clauderic/dnd-kit/discussions/1842)
- [Active Maintenance Status · Issue #1830 · clauderic/dnd-kit](https://github.com/clauderic/dnd-kit/issues/1830)
- [Top 5 Drag-and-Drop Libraries for React in 2026 — Puck](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
- [Atlassian Pragmatic DnD — atlassian.design](https://atlassian.design/components/pragmatic-drag-and-drop)
