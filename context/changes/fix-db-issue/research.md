---
date: 2026-06-17T21:19:27Z
researcher: Kacper Nadstoga
git_commit: 4d8fc0e050f1f14fe30e34dcce767c0393a6bdf6
branch: fix-prod-db
repository: osce-traiger
topic:
  "Production 'Worker hung' errors on Next.js + OpenNext + Cloudflare — is it
  the DB-connection-singleton antipattern from TanStack/router#5323?"
tags:
  [
    research,
    codebase,
    cloudflare-workers,
    opennext,
    postgres-js,
    drizzle,
    hyperdrive,
    db-connection,
  ]
status: complete
last_updated: 2026-06-17
last_updated_by: Kacper Nadstoga
---

# Research: Production "Worker hung" errors — is it the DB-connection-singleton antipattern?

**Date**: 2026-06-17T21:19:27Z **Researcher**: Kacper Nadstoga **Git Commit**:
4d8fc0e050f1f14fe30e34dcce767c0393a6bdf6 **Branch**: fix-prod-db **Repository**:
osce-traiger

## Research Question

App misbehaves only in production (works locally). Symptoms: first navigation
shows a "can't load page, click reload" screen; second attempt loads
`/dashboard`; entering a session hangs with HTTP 500 in the Network tab; a
manual refresh lands in `/dashboard/session/[id]`; ordering investigations
("zlecać badania") again returns HTTP 500. Cloudflare always logs the same
error:

> Error: The Workers runtime canceled this request because it detected that your
> Worker's code had hung and would never generate a response.
> https://developers.cloudflare.com/workers/observability/errors/

A similar problem on a different stack is reported in **TanStack/router#5323**,
with a well-rated fix in
[comment 3548779998](https://github.com/TanStack/router/issues/5323#issuecomment-3548779998).
**Question:** do we have the same DB-connection-instantiation problem, and is
this really that error? This is assumed to be a Next.js ↔ OpenNext ↔ Cloudflare
boundary issue (prod-only).

## Summary

**Yes — confirmed. We have the exact antipattern from TanStack/router#5323, and
the symptoms match its signature precisely.**

`src/shared/lib/db.ts:6` creates the postgres-js client as a **module-level
singleton** (`const client = postgres(...)`, exported `db`), imported by 7+
modules across the app. On Cloudflare's `workerd` runtime, a TCP socket is an
**I/O object bound to the request context in which it was created**. A
module-scope client opens its socket inside the **first** request's I/O context
and then survives in the warm isolate; the **next** request reuses that socket,
which workerd refuses to operate on a foreign request's behalf. The query
promise never resolves, the handler awaits forever, and workerd cancels the
request with "your Worker's code had hung". This is **prod-only** because
locally (`npm run dev`) the code runs on Node.js, which has no such per-request
I/O isolation.

The intermittency ("first fails, reload works, then hangs again") is the
textbook **cold-vs-warm-isolate alternation**: a fresh isolate re-imports the
module and the first request creates a valid socket (works); the next warm hit
reuses the foreign-context socket (hangs); a hard reload may land on a new
isolate (works again).

The canonical fix from #5323
([comment 3548779998](https://github.com/TanStack/router/issues/5323#issuecomment-3548779998))
is to **instantiate the DB client per request** (in a middleware / request
handler and pass it via context) — never import a module-level singleton.

**Important second finding:** this singleton issue is a _separate, additional_
failure mode layered on top of the previously-documented transport problem. At
HEAD (reverted to baseline `27c34d2`) **none** of the prior transport fixes are
present — no Hyperdrive binding, no `serverExternalPackages: ['postgres']`, no
`ssl`/timeout/`max:1` hardening in `db.ts`. A complete fix must address **both**
layers: per-request client construction **and** the Hyperdrive transport. See
[[project-prod-db-connection]].

## Detailed Findings

### Area 1 — The DB client is a module-level singleton (root cause)

`src/shared/lib/db.ts` in full:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// prepare: false is required for Supabase PgBouncer transaction mode pooler
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });
```

- `db.ts:6` — `postgres()` is invoked at **module scope**. The socket/pool it
  owns is created lazily on first query, inside whichever request's I/O context
  fires first, then reused across all later requests in the same isolate. This
  is exactly the structure #5323 identifies as the cause of the "hung" error.
- It reads `process.env.DATABASE_URL` directly — **not**
  `getCloudflareContext().env.HYPERDRIVE.connectionString`.
- Only `prepare: false` is set: no `ssl`, no `connect_timeout`/`idle_timeout`,
  no `max: 1`.

**Consumers of the `db` singleton** (every one of these inherits the
antipattern):

| File                                                      | Line | Usage context                                                                 |
| --------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `src/modules/auth/auth.ts`                                | 7    | `DrizzleAdapter(db,…)` + credentials `authorize()` query — route handler      |
| `src/modules/auth/user.util.ts`                           | 3    | `registerUser()` server action — SELECT + INSERT users                        |
| `src/modules/account/queries.ts`                          | 3    | `getAccountSettings()` — RSC                                                  |
| `src/modules/account/actions.ts`                          | 6    | deletion request/cancel — server actions                                      |
| `src/modules/session/queries.ts`                          | 4    | 9 query fns (dashboard, session, history, details RSCs)                       |
| `src/modules/session/actions.ts`                          | 6    | `startSessionAction`, `selectTestAction`, `endSessionAction` — server actions |
| `src/modules/session/queries.test.ts` / `actions.test.ts` | —    | tests (Node, unaffected)                                                      |

### Area 2 — Mapping the symptoms to the code paths

**Symptom: first navigation fails, second loads `/dashboard`.**

- `src/app/layout.tsx:44` renders async `<Nav/>` → `await auth()` (JWT, no DB).
- `src/app/dashboard/page.tsx:11` → `getScenarios()` →
  `db.select().from(scenarios)` (`queries.ts:13-15`) — **the first DB call**. On
  a fresh isolate this creates the socket; the "click reload" page corresponds
  to a warm isolate where that socket is reused and the request hangs/cancels.

**Symptom: entering a session hangs with HTTP 500.**

- `src/app/dashboard/session/[sessionId]/page.tsx` → `getSessionById()`
  (`queries.ts:17-26`) then
  `Promise.all([getScenarioById, getDiagnosticTests, getTestClassificationsByScenario, getSessionEvents])`
  — **5 DB calls**, several concurrent. Any reused-socket hang here cancels the
  render.

**Symptom: ordering investigations ("zlecać badania") returns HTTP 500.**

- `src/modules/session/actions.ts` → `selectTestAction()` (lines 56-113): 4
  sequential DB calls (SELECT session `:64-68`, SELECT existing events `:75-84`,
  SELECT classifications `:88-91`, INSERT event `:105-107`).
- **Error masking:** `selectTestAction` ends in a bare
  `catch { return { error: 'Internal error' }; }` (≈`:110-112`) with **no
  logging** — so the real cause (hung socket / timeout) is invisible in prod. By
  contrast `endSessionAction` does log (`console.error` around `:216`). This is
  why the Cloudflare runtime log ("hung") is the only signal you get.

### Area 3 — Why it's prod-only and intermittent (the workerd mechanism)

Cloudflare's errors doc states the rule verbatim: _"Cannot perform I/O on behalf
of a different request. I/O objects … created in the context of one request
handler cannot be accessed from a different request's handler."_ A postgres-js
socket is such an object.

- **Cold isolate:** module re-imported, fresh `client`; the first request to
  query creates the socket in its own context → **works**.
- **Warm isolate:** the surviving module-scope `client` is reused; its socket
  belongs to a prior request → workerd won't run I/O on it → the query promise
  never settles → "all code executed, no events left, no Response returned" →
  workerd cancels with **"hung and would never generate a response."**
- **Local dev works** because Node.js has no per-request I/O-context isolation —
  a shared client is fine there. OpenNext runs the Next handler inside one
  Worker isolate, so the singleton is shared across requests identically to a
  raw Worker.

This is the alternation behind "first fails → reload works → hangs again."

### Area 4 — The confirmed fix (from #5323, comment 3548779998)

Reporter `iduuck`: _"It was fixed by not using a singleton in a file, but rather
passing as context through middlewares in request scope."_ Canonical fix by
`alecdwm` (the highly-rated comment) — create the driver **inside a per-request
middleware** and pass it via context:

```ts
// their dbMiddleware.ts — drizzle(...) runs once PER REQUEST
export const dbMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    config();
    return next({
      context: { db: drizzle(process.env.DATABASE_URL!, { schema }) },
    });
  },
);
```

`ElasticBottle` (same thread): _"Make sure you're instantiating your db within
the API request handler."_ The TanStack code is framework-specific, but the
principle ports directly to our Next.js/OpenNext app: **the postgres-js client
must be constructed within per-request scope, not at module scope.**

### Area 5 — Transport layer at HEAD: prior fixes are all absent

| Config item                                    | Present at HEAD? | Evidence                                                   | Implication                                            |
| ---------------------------------------------- | ---------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `serverExternalPackages: ['postgres']`         | **NO**           | `next.config.ts:3-7` (only `optimizePackageImports`)       | Build-time externalization of `postgres` unaddressed   |
| Hyperdrive binding                             | **NO**           | `wrangler.jsonc:11-19` (only `WORKER_SELF_REFERENCE`)      | workerd-can't-trust-Supabase-CA problem unaddressed    |
| `getCloudflareContext()` reading Hyperdrive    | **NO**           | grep: 0 hits; `db.ts:6` uses `process.env`                 | Even if a binding existed, `db.ts` wouldn't consume it |
| Supavisor pooler `DATABASE_URL` for prod       | **Unverifiable** | not in `wrangler.jsonc` `vars`; lives in untracked secrets | Not committed for the deployed Worker                  |
| `ssl` / `connect_timeout` / `max:1` in `db.ts` | **NO**           | `db.ts:6` only sets `prepare: false`                       | Connections can hang indefinitely; pool unbounded      |
| `nodejs_compat` flag                           | **YES**          | `wrangler.jsonc:6`                                         | Prerequisite present                                   |
| `cloudflare:sockets` raw usage                 | none             | grep: 0 hits                                               | `postgres` uses Node `net` via `nodejs_compat`         |

Versions: `postgres ^3.4.9`, `drizzle-orm ^0.45.2`,
`@opennextjs/cloudflare ^1.19.11`, `next 16.2.6`, `wrangler ^4.94.0`.
`open-next.config.ts` is the untouched default scaffold.

**Hyperdrive does not remove the per-request rule.** Cloudflare's own
Hyperdrive+postgres-js example creates the client inside the `fetch` handler:
_"Hyperdrive maintains the underlying database connection pool, so creating a
new client on each request is fast and recommended."_ The Worker→Hyperdrive
socket is itself a per-request I/O object. So a module-scope singleton over
`env.HYPERDRIVE.connectionString` would hang identically. **Both** fixes are
required.

## Code References

- `src/shared/lib/db.ts:6` — module-level `postgres()` singleton (root cause)
- `src/shared/lib/db.ts:8` — exported `db` consumed across 7 modules
- `src/modules/session/actions.ts:56-113` — `selectTestAction` ("zlecać
  badania"); 4 DB calls
- `src/modules/session/actions.ts:110-112` — bare `catch` swallowing the real
  error → HTTP 500
- `src/modules/session/queries.ts:13-15` — `getScenarios` (first DB call on
  `/dashboard`)
- `src/modules/session/queries.ts:17-26` — `getSessionById` (session entry)
- `src/app/dashboard/session/[sessionId]/page.tsx` — `Promise.all` of 4
  concurrent queries
- `src/modules/auth/auth.ts:7,15-21,42-44` — DrizzleAdapter + credentials query
- `src/middleware.ts:5` — JWT-only `authConfig`, **no** per-request DB lookup
  (confirmed)
- `next.config.ts:3-7` — no `serverExternalPackages`
- `wrangler.jsonc:5-6` — `compatibility_date 2026-05-24`, `nodejs_compat` on; no
  Hyperdrive
- `open-next.config.ts:1-9` — default scaffold, no transport overrides

## Architecture Insights

- The app cleanly separates RSC reads (`queries.ts`) from mutations
  (`actions.ts`) per the team lesson "query modules for DB access in RSC" — but
  **every** path funnels through the single module-scope `db`, so the
  antipattern is centralized in one file (which also makes the fix
  centralizable).
- Auth uses **JWT strategy**, so middleware and layout do **not** hit the DB per
  request. This rules out "auth queries on every request" as the first-load
  culprit; the first DB touch is the RSC data query (`getScenarios`), consistent
  with the symptom that the very first page fails before `/dashboard` content
  appears.
- Two independent failure layers share the same connection path: **(A)**
  transport — workerd won't TLS to Supabase's private CA over raw sockets (needs
  Hyperdrive); **(B)** lifecycle — module-scope socket reuse across requests
  (needs per-request construction). Prior debugging fixed neither at HEAD
  because the codebase was reverted to baseline `27c34d2`, and earlier
  experiments all kept the singleton.

## Historical Context (from prior changes)

- `context/changes/fix-db-issue/change.md` — frames the goal: confirm whether
  the #5323 fix applies; notes prod DB required Hyperdrive.
- Memory [[project-prod-db-connection]] — long debugging session (2026-06-17):
  Worker→prod-DB **never** worked; layers DATABASE_URL pooler → CI migration
  pooler → `serverExternalPackages` → TLS wall (private CA) → **Hyperdrive** as
  the only transport solution; ended with revert to `27c34d2`. This research
  adds the **never-touched lifecycle layer** (singleton vs per-request).
- Memory [[project-infrastructure]] — Cloudflare Workers chosen after platform
  research.
- Memory [[project-nextjs16-proxy-middleware]] — `middleware.ts` runs on Edge;
  `proxy.ts` Node-only. Relevant when deciding _where_ to construct a
  per-request client (a Node-runtime boundary, not the Edge middleware, must own
  the postgres-js socket).

## Related Research

- None prior under `context/changes/**/research.md`; this is the first research
  artifact for `fix-db-issue`.

## Open Questions

1. **Where to construct the per-request client in Next.js/OpenNext?** TanStack
   uses `createMiddleware().server()`. Our equivalent options: a request-scoped
   factory called at the top of each server action / RSC (e.g. `getDb()` using
   `getCloudflareContext()`), or React `cache()`-wrapped per-request
   memoization. Edge `middleware.ts` is the wrong place (Node-only socket). To
   resolve in `/10x-plan`.
2. **Hyperdrive provisioning** — `wrangler hyperdrive create` against the
   Supavisor pooler URL, binding `HYPERDRIVE` in `wrangler.jsonc` (+
   `localConnectionString` for dev), then `db.ts` reads
   `getCloudflareContext().env.HYPERDRIVE.connectionString` with `ssl: false`.
3. **Connection hardening** — restore `prepare: false` (pooler) + `ssl`,
   `connect_timeout`, `max: 1`; consider `ctx.waitUntil(sql.end())` for
   non-blocking cleanup per request.
4. **Error visibility** — add `console.error(error)` to `selectTestAction`'s
   catch so future prod failures surface in Workers Logs (already enabled per
   commit 4d8fc0e) instead of only the generic "hung" runtime message.
5. **Verification** — local dev cannot reproduce (Node has no per-request I/O
   isolation). Need a `wrangler dev`/preview or prod-like check to confirm the
   fix.
