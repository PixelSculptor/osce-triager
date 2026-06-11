---
date: 2026-06-11T00:00:00+00:00
researcher: Claude Sonnet 4.6
git_commit: 1e9f4b99b1752291562bf8015462755a35c8208f
branch: e2e-tests
repository: osce-traiger
topic:
  'Auth boundary gate — ground Risk #6 (unauthenticated access to /dashboard/*)'
tags: [research, auth, middleware, e2e, cloudflare-workers, nextjs]
status: complete
last_updated: 2026-06-11
last_updated_by: Claude Sonnet 4.6
---

# Research: Auth boundary gate — Risk #6

**Date**: 2026-06-11  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: 1e9f4b99b1752291562bf8015462755a35c8208f  
**Branch**: e2e-tests  
**Repository**: osce-traiger

## Research Question

Ground rollout Phase 3 of `context/foundation/test-plan.md`. Verify how
middleware blocks unauthenticated access, whether the auth.config.ts Edge split
works on Cloudflare Workers, which routes the matcher covers, and what the
cheapest test layer is for Risk #6.

---

## Summary

**Risk #6 is lower-risk than assessed.** The implementation is correct
end-to-end:

- Middleware matcher covers every route except `_next/static`, `_next/image`,
  `favicon.ico`.
- `auth.config.ts` is fully Edge-safe (no DB, pure JWT check via `req.auth`).
- `AUTH_URL` and `AUTH_TRUST_HOST` are correctly wired in `wrangler.jsonc`.
- All four dashboard pages independently guard with `auth()` +
  `redirect("/login")`.

**The seed E2E test already exists** at `src/__tests__/e2e/seed.spec.ts` and
covers the `/dashboard` case for Risk #6 exactly as specified.

**Two gaps remain before Phase 3 can be marked complete:**

1. `auth.setup.ts` is missing — the Playwright `setup` project references
   `auth.setup.ts` but no such file exists. Without it, the `chromium` project
   cannot run (it depends on `setup`).
2. The session sub-route (`/dashboard/session/[sessionId]`) is not covered by
   any E2E test. The risk response guidance names it explicitly.

**One test-plan correction:** the risk response guidance says "returns HTTP 302
to `/login`", but middleware actually redirects to `"/"` (root). The seed test
correctly uses `waitForURL('/')`. Tests for session sub-routes must also assert
redirect to `"/"`, not `"/login"`.

---

## Detailed Findings

### 1. Middleware — `src/middleware.ts`

```
Line 1:  import { NextResponse } from "next/server"
Line 2:  import NextAuth from "next-auth"
Line 3:  import { authConfig } from "@/modules/auth/auth.config"
Line 5:  const { auth } = NextAuth(authConfig)
Line 7:  const PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth"]
Line 9:  export default auth((req) => {
Line 10:   const { pathname } = req.nextUrl
Line 11:   const isPublic = PUBLIC_PATHS.some(
Line 12:     (path) => pathname === path || pathname.startsWith(path + "/")
Line 13:   )
Line 15:   if (!req.auth && !isPublic) {
Line 16:     return NextResponse.redirect(new URL("/", req.url))   // ← redirects to "/", NOT "/login"
Line 17:   }
Line 20: export const config = {
Line 21:   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
Line 22: }
```

**Matcher scope:** Covers everything except `_next/static/*`, `_next/image/*`,
`favicon.ico`. `/dashboard` and all sub-routes are fully inside the matcher.

**Auth check:** `req.auth` is the JWT object populated by
`NextAuth(authConfig)`. If falsy and path is not in PUBLIC_PATHS → redirect to
`"/"`.

**Redirect target is `"/"` (root), not `"/login".** The risk response guidance
in `test-plan.md §2` says "returns HTTP 302 to /login" — this is incorrect.
Redirect is to `/`. Page-level guards (`redirect("/login")` inside each
`page.tsx`) fire only if middleware passes, which it will not for
unauthenticated requests.

### 2. Edge-safe split — `src/modules/auth/auth.config.ts`

```
Line 3:  export const authConfig: NextAuthConfig = {
Line 4:    session: { strategy: "jwt" },
Line 5:    providers: [],
Line 6:    callbacks: {
Line 7:      authorized({ auth }) {
Line 8:        return !!auth        // pure boolean — no DB access
Line 9:      },
Line 10:   },
Line 11: }
```

No DB adapter, no Drizzle import, no providers. Safe to execute in Cloudflare
Workers Edge runtime. The full `src/modules/auth/auth.ts` (with
`DrizzleAdapter`, `bcryptjs`, credentials provider) is used only in pages,
server actions, and API routes — never imported by `middleware.ts`.

### 3. Cloudflare Workers wiring — `wrangler.jsonc`

```
Line 3:  "main": ".open-next/worker.js"         // @opennextjs/cloudflare adapter
Line 6:  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"]
Line 28: "AUTH_URL": "https://osce-triager.kapix007.workers.dev"
Line 29: "AUTH_TRUST_HOST": "true"
```

Both required vars are present. `AUTH_SECRET` is in `.env.local` (local) and
must exist as a Worker secret in production — this is not checked by a test but
is a deploy prerequisite.

The risk note "Edge runtime config issues on Cloudflare Workers can cause
middleware to silently pass" is addressed by this configuration. The most likely
real failure mode is `AUTH_SECRET` missing from Worker secrets (would cause JWT
verification to fail silently rather than redirect).

### 4. Dashboard route coverage

| Route                                    | File                                                     | Auth check line | Redirect target |
| ---------------------------------------- | -------------------------------------------------------- | --------------- | --------------- |
| `/dashboard`                             | `src/app/dashboard/page.tsx`                             | L7-8            | `/login`        |
| `/dashboard/history`                     | `src/app/dashboard/history/page.tsx`                     | L8-9            | `/login`        |
| `/dashboard/session/[sessionId]`         | `src/app/dashboard/session/[sessionId]/page.tsx`         | L20-21          | `/login`        |
| `/dashboard/session/[sessionId]/details` | `src/app/dashboard/session/[sessionId]/details/page.tsx` | L35-36          | `/login`        |

No `dashboard/layout.tsx` exists — auth is per-page, not layout-level. This is
fine because middleware catches unauthenticated requests before any page code
runs. The page-level `redirect("/login")` is defence-in-depth for the case where
middleware is misconfigured or bypassed (e.g., direct server render without
Edge).

### 5. Existing E2E test — `src/__tests__/e2e/seed.spec.ts`

```ts
// Line 21-22: scopes no-session state to this describe block only
test.describe('auth boundary — unauthenticated access is blocked', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated request to /dashboard is redirected and never serves protected content', async ({
    page,
  }) => {
    await page.goto('/dashboard'); // Line 38
    await page.waitForURL('/'); // Line 44 — correct: middleware → "/"
    await expect(
      page
        .getByRole('navigation', { name: 'Nawigacja główna' })
        .getByRole('link', { name: 'Zaloguj się' }),
    ).toBeVisible(); // Line 54-58
    await expect(
      page.getByRole('heading', { name: 'Panel studenta' }),
    ).not.toBeVisible(); // Line 63-65 — core Risk #6 guard
  });
});
```

This test correctly:

- overrides storageState to empty (no session cookies)
- waits for redirect to `"/"` (not `"/login"`)
- asserts the login link is visible in the nav
- asserts the protected heading is absent (core guard)

**Coverage gap:** only `/dashboard` is tested. `/dashboard/session/[sessionId]`
is named in the risk but has no test.

### 6. Playwright configuration — `playwright.config.ts`

```ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },   // ← auth.setup.ts does NOT exist
  {
    name: 'chromium',
    use: { storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
],
```

`auth.setup.ts` is referenced by the `setup` project but the file does not exist
at `src/__tests__/e2e/auth.setup.ts` or anywhere in the repo. The `chromium`
project depends on `setup`. Without `auth.setup.ts`:

- The `setup` project runs zero tests (no error, but
  `playwright/.auth/user.json` is never written).
- The `chromium` project's default `storageState: 'playwright/.auth/user.json'`
  will fail to load the file.
- `seed.spec.ts` overrides storageState to `{ cookies: [], origins: [] }` — its
  unauthenticated test can run independently without the file.

**Consequence:** The unauthenticated test in `seed.spec.ts` can be run and
validated now. Any future authenticated tests (e.g., testing that a logged-in
user CAN access `/dashboard`) need `auth.setup.ts` first.

---

## Code References

- `src/middleware.ts:15-16` — unauthenticated redirect to `"/"`
- `src/middleware.ts:21` — matcher pattern (all routes except static)
- `src/modules/auth/auth.config.ts:4-10` — Edge-safe JWT-only config
- `src/modules/auth/auth.ts:15-57` — full config (DB adapter, credentials,
  callbacks)
- `src/app/dashboard/page.tsx:7-8` — page-level auth guard
- `src/app/dashboard/session/[sessionId]/page.tsx:20-21` — session page auth
  guard
- `wrangler.jsonc:28-29` — AUTH_URL + AUTH_TRUST_HOST for Workers
- `src/__tests__/e2e/seed.spec.ts:21-73` — existing Risk #6 E2E test
- `playwright.config.ts` — setup project references missing `auth.setup.ts`

---

## Architecture Insights

**Double-layer auth pattern:** Middleware (Edge, JWT-only) is the first gate —
catches unauthenticated requests before page code executes. Page-level
`auth()` + `redirect("/login")` is a second gate, defence-in-depth. The two
layers redirect to different targets:

- Middleware → `"/"` (root)
- Pages → `"/login"`

This is intentional: middleware runs on Edge without DB access, so it cannot
know the `/login` route structure. The root redirect works because `"/"` is
public and displays login/register CTAs.

**auth.config.ts split is correctly implemented.** The pattern described in
`roadmap.md:F-03` (auth.config.ts Edge split for Cloudflare Workers) is in place
and working as designed.

**No dashboard layout.tsx auth guard.** Auth is not centralised at the layout
level. This is acceptable because middleware provides the real barrier. If
middleware were removed, all four dashboard pages would still individually
redirect. The gap is style/DRY, not a security hole.

---

## Historical Context

- `context/changes/auth-scaffold/plan.md` — F-01 established the middleware
  split; noted that `AUTH_URL`/`AUTH_TRUST_HOST` are required on Cloudflare
  Workers (a "gotcha" call-out in the plan).
- `context/changes/auth-flow/plan.md` — S-01 added `/login` and `/register` to
  `PUBLIC_PATHS` (they were absent in F-01); changed matcher to the current
  inverted-regex pattern.
- `context/foundation/roadmap.md:F-03` — documented the proxy.ts → middleware.ts
  migration for Edge compatibility.

---

## Open Questions

1. **`auth.setup.ts` implementation** — Phase 3 plan must include creating this
   file so the Playwright `chromium` project can run authenticated tests. The
   setup file needs to: navigate to `/login`, fill credentials, save cookies to
   `playwright/.auth/user.json`.

2. **Session sub-route coverage** — an E2E test for unauthenticated access to
   `/dashboard/session/fake-id` is missing. The plan should add it (same pattern
   as seed.spec.ts, different `page.goto` path).

3. **`AUTH_SECRET` in Worker secrets** — not testable via E2E but must be
   documented as a deploy prerequisite. If the secret is absent, JWT
   verification fails; the symptom would be authenticated users being redirected
   to `"/"` rather than unauthenticated users being passed through.

---

## Test-Plan Correction (backport candidate)

**§2 Risk Response Guidance, Risk #6, "What would prove protection" column:**

Current text: "...returns HTTP 302 to `/login`..."  
Correct text: "...returns redirect to `/` (root), never serves content..."

Middleware (`src/middleware.ts:16`) redirects to `"/"`. The page-level guard
(`redirect("/login")`) only fires if middleware passes — which it does not for
unauthenticated requests. The seed test (`seed.spec.ts:44`) correctly uses
`waitForURL('/')` and should be taken as the authoritative reference.

This should be backported into `test-plan.md §2` before planning begins.
