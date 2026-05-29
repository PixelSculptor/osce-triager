# Repository Guidelines

OSCE Triager is a Next.js 16 (App Router) + React 19 + TypeScript 5 web app — an interactive diagnostic pathway simulator for 6th-year Polish medical students preparing for OSCE exams.

## Hard Rules

**Next.js 16 is not the Next.js from training data.** APIs, file conventions, and routing may differ significantly from prior versions. Read `node_modules/next/dist/docs/` before writing any App Router code. Heed all deprecation notices.

Use `@/*` for all internal imports (e.g., `@/app/page.tsx`, `@/components/Button`). Deep relative paths (`../../`) are forbidden.

Do not introduce a test framework or CI pipeline without explicit instruction — neither is configured yet.

Never create a `src/components/` directory — use `src/shared/components/` instead.

## Project Structure

- `src/app/` — Next.js App Router: pages (`page.tsx`), layouts (`layout.tsx`), route handlers (`route.ts`)
- `public/` — static assets
- `context/` — product context; see @context/foundation/prd.md and @context/foundation/tech-stack.md

## Build and Dev Commands

- `npm run dev` — start local dev server
- `npm run build` — production build; run before every push
- `npm run start` — serve the production build locally
- `npm run lint` — ESLint with `next/core-web-vitals` and TypeScript rules

Run `npm run lint` and `npm run build` before every commit. No test runner is configured.

## Code Style

Do not suppress errors without an inline comment explaining why. Component files use PascalCase; App Router reserved filenames (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`) take precedence over any naming preference.

## Commits and Deployment

Imperative, verb-first messages, under 72 chars; state _what_ and _why_ (e.g.`\setup bootstrap project using 10x-bootstrapper skill`).

Deployment target: Cloudflare Pages. Auth: email + password. No CI pipeline exists — verify `npm run build` passes locally before pushing.

## Naming Conventions and Directory Layout

Feature-based structure. Every file belongs to exactly one of:

- `src/modules/<feature>/` — code used only within that feature
- `src/shared/` — code used across multiple features; sub-directories mirror the types below

Each module must have a `__tests__` folder for tests. Export all components and utils from a single `index.tsx` or index file.

Co-locate all artifacts for that component inside it:

| Artifact   | Pattern                 | Example              |
| ---------- | ----------------------- | -------------------- |
| Component  | `PascalCase.tsx`        | `Counter.tsx`        |
| Constants  | `PascalCase.const.ts`   | `Counter.const.ts`   |
| Stylesheet | `PascalCase.module.css` | `Counter.module.css` |
| Hook       | `camelCase.ts`          | `useCounter.ts`      |
| Util (component-specific) | `PascalCase.util.ts` | `Counter.util.ts` — helper tightly coupled to a component (e.g. display formatting) |
| Util (domain/service)     | `camelCase.util.ts`  | `user.util.ts` — domain logic not tied to any single component (e.g. `registerUser`) |
| Types      | `PascalCase.types.ts`   | `Counter.types.ts`   |

Module-level hooks and utils shared across components within the same feature sit one level above the component directories.
