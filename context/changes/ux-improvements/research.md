---
date: 2026-06-01T00:00:00+02:00
researcher: Kacper Nadstoga
git_commit: c173c8baa1852500be9df8b380aac1e98c6b41a6
branch: ui-ux-improvements
repository: PixelSculptor/osce-traiger
topic: "Interaction patterns baseline for S-04 UX improvements"
tags: [research, codebase, ux, animations, drag-and-drop, css-modules, loading-states]
status: complete
last_updated: 2026-06-01
last_updated_by: Kacper Nadstoga
---

# Research: Interaction patterns baseline for S-04 UX improvements

**Date**: 2026-06-01  
**Researcher**: Kacper Nadstoga  
**Git Commit**: `c173c8baa1852500be9df8b380aac1e98c6b41a6`  
**Branch**: `ui-ux-improvements`  
**Repository**: PixelSculptor/osce-traiger

## Research Question

What interaction patterns (animations, transitions, hover/focus states, loading states, drag-and-drop) currently exist in the codebase, and what is the styling baseline the S-04 UX improvements must build on?

## Summary

The app is a **minimal, functional UI with no motion design**. There are zero transitions, animations, or DnD implementations. Loading states are text-only (button label swaps). The styling system is pure vanilla CSS Modules — no Tailwind, no component library, no icon set. Color palette is mostly black/white with hardcoded semantic accents scattered across individual module files. This is a clean slate for motion design, but also a fragile one: there are no shared design tokens beyond `--background`/`--foreground`.

## Detailed Findings

### Animations & Transitions

**Finding: none exist.**

- No `transition`, `animation`, `@keyframes`, or `transform` declaration in any `.css` / `.module.css` file.
- No animation libraries installed (`framer-motion`, `react-spring`, `animate.css`, GSAP).
- No inline style animations in any component.

### Hover & Focus States

Minimal coverage — two hover targets and two focus targets across the entire app:

| File | Line | Selector | Rule |
|------|------|----------|------|
| `src/shared/components/Nav/Nav.module.css` | 25–27 | `.links a:hover` | `text-decoration: underline; text-underline-offset: 2px` |
| `src/shared/components/Nav/Nav.module.css` | 45–46 | `.logoutButton:hover` | `background: rgba(128,128,128,0.1)` |
| `src/modules/auth/components/LoginForm.module.css` | 33–35 | `.field input:focus` | `outline: 2px solid rgba(99,102,241,0.6)` |
| `src/modules/auth/components/RegisterForm.module.css` | 33–35 | `.field input:focus` | same indigo outline |

No hover effects on the primary interactive surfaces: scenario cards, test cards, or the session end button.

### Disabled States

Consistent pattern across all interactive components — `opacity` reduction + `cursor: not-allowed`:

| File | Lines | Element |
|------|-------|---------|
| `src/modules/auth/components/LoginForm.module.css` | 63–66 | submit button |
| `src/modules/auth/components/RegisterForm.module.css` | 63–66 | submit button |
| `src/modules/session/components/TestCard.module.css` | 33–36 | test button |
| `src/modules/session/components/ScenarioCard.module.css` | 48–51 | start button |
| `src/modules/session/components/SessionView.module.css` | 40–43 | end session button |

Opacity varies (`0.5` in TestCard, `0.6` elsewhere) — a minor inconsistency worth normalising.

### Loading States

Text-only; no spinners, skeletons, or loaders:

| File | Lines | Component | Mechanism |
|------|-------|-----------|-----------|
| `src/modules/auth/components/SubmitButton.tsx` | 3, 11, 15 | SubmitButton | `useFormStatus()` → `pending`; shows `loadingLabel` ("Proszę czekać…") |
| `src/modules/session/components/ScenarioCard.tsx` | 22, 45–50 | ScenarioCard | `useState<boolean>` `loading`; shows "Ładowanie…" |
| `src/modules/session/components/TestCard.tsx` | 10 | TestCard | `isLoading?: boolean` prop; shows "…" |
| `src/modules/session/components/SessionView.tsx` | 63, 166 | SessionView | `loadingTestId` tracks per-test loading; "Kończenie…" for end button |

Pattern is established but purely textual — a prime target for spinners or shimmer.

### Drag-and-Drop

**Finding: none exist.**

- No "drag", "drop", "dnd", "sortable", or "draggable" keyword anywhere in `src/`.
- No DnD library in `package.json`.

This is a **greenfield DnD implementation** — library choice must be resolved before planning.

### State-Driven Styling

The session module uses data attributes for result states — a solid pattern to extend:

```
data-selected, data-result, data-positive, data-urgent
```

These drive CSS targeting in `TestCard.module.css` and `SessionView.module.css`.

## Styling System Baseline

### Framework

Pure **CSS Modules** with hand-written vanilla CSS. No Tailwind, no PostCSS, no component library, no icon set.

### CSS Files

| File | Purpose |
|------|---------|
| `src/app/globals.css` | Root reset + `--background`/`--foreground` tokens |
| `src/app/page.module.css` | Landing page |
| `src/app/(auth)/auth.module.css` | Auth layout card |
| `src/shared/components/Nav/Nav.module.css` | Global navigation |
| `src/modules/auth/components/LoginForm.module.css` | Login form |
| `src/modules/auth/components/RegisterForm.module.css` | Register form |
| `src/modules/session/components/TestCard.module.css` | Diagnostic test card |
| `src/modules/session/components/ScenarioCard.module.css` | Scenario selection card |
| `src/modules/session/components/SessionView.module.css` | Session container + timer |

### Design Tokens (globals.css)

Only two tokens exist today:

```css
--background: #ffffff  /* dark: #0a0a0a */
--foreground: #171717  /* dark: #ededed */
```

Everything else — borders, accents, semantic badge colours — is **hardcoded per module file**.

### Current Color Palette

**Theme variables** (the only shared tokens):
- Background: `#ffffff` / `#0a0a0a`
- Foreground: `#171717` / `#ededed`

**Semantic accents** (hardcoded, not tokenised):
| Role | Background | Text/Border |
|------|-----------|-------------|
| Error / alert / timer | — | `#dc2626` |
| Correct result | `#dcfce7` | `#166534` |
| Suboptimal result | `#fef9c3` | `#854d0e` |
| Unnecessary result | `#ffedd5` | `#9a3412` |
| Negative outcome | — | `#991b1b` |
| Input focus | — | `rgba(99,102,241,0.6)` (indigo) |

**Border / surface grays** (hardcoded, not tokenised):
- `rgba(128,128,128,0.2)` — subtle (nav, auth card)
- `rgba(128,128,128,0.3)` — standard (session header, test card)
- `rgba(128,128,128,0.4)` — strong (inputs, buttons, cards)
- `rgba(128,128,128,0.1)` — hover background

## Architecture Insights

1. **No shared design token layer** — adding a colour palette means either (a) extending `globals.css` with CSS custom properties and updating all 8 module files, or (b) picking a utility framework (Tailwind). Given the existing CSS Modules pattern, the least-friction path is expanding `globals.css` tokens.

2. **No animation infrastructure** — any motion work starts from zero. CSS transitions added to `globals.css` as utility classes, or a lightweight library (`framer-motion`) imported per-component, are both viable.

3. **DnD is a greenfield choice** — the two main candidates for Next.js App Router (RSC/Client boundary) are `@dnd-kit/core` (headless, widely used) and `react-beautiful-dnd` (deprecated upstream). `@dnd-kit` is the de-facto choice for new projects. Needs external research to confirm.

4. **Loading state pattern is established** (`useFormStatus` + `useState` `loading`) — consistent extension path is to replace text labels with a spinner component rather than rebuilding the state machine.

5. **Data-attribute driven styling** is already in use for result states — a good pattern to carry forward for drag-over, drag-active, and drop-target states in the DnD implementation.

## Open Questions

1. **DnD library**: ~~`@dnd-kit/core` vs alternatives~~ — **resolved, see follow-up below.**
2. **Colour palette scope**: Should S-04 introduce a full design-token layer in `globals.css` (replacing all hardcoded values), or only add new palette tokens and leave existing values in place? Affects plan complexity significantly.
3. **Animation strategy**: CSS transitions only (zero new dependencies) vs `framer-motion` (richer but heavier) — needs decision before planning.

---

## Related Research

- **[drag-n-drop-research.md](drag-n-drop-research.md)** — External research: DnD library selection for Next.js App Router. Decision: `@dnd-kit/core` + `@dnd-kit/sortable`. Resolves Open Question #1.
