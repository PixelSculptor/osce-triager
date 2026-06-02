---
date: 2026-06-02T05:51:11+00:00
researcher: Claude Sonnet 4.6
git_commit: 57bb06dc60ed6c98e53a6b54ef3c0be5ec5db954
branch: plan-retention-data
repository: osce-traiger
topic: "Account deletion with 30-day RODO retention — soft-delete mechanism and Cloudflare scheduling"
tags: [research, codebase, account-deletion, rodo, drizzle, cloudflare-workers, auth]
status: complete
last_updated: 2026-06-02
last_updated_by: Claude Sonnet 4.6
---

# Research: Account Deletion with 30-Day RODO Retention

**Date**: 2026-06-02T05:51:11+00:00
**Git Commit**: 57bb06dc60ed6c98e53a6b54ef3c0be5ec5db954
**Branch**: plan-retention-data
**Repository**: osce-traiger

## Research Question

What existing patterns and infrastructure shape the S-05 account-deletion implementation? Specifically: which soft-delete mechanism (`deleted_at` flag) and which scheduled cleanup approach (Cloudflare Cron Trigger vs. GitHub Actions) should be used?

## Summary

**Soft-delete decision: add `deletionRequestedAt` timestamp column to the `user` table.** All FK relations already use `ON DELETE CASCADE` — the hard delete after 30 days will automatically cascade to `account`, `session`, `session_result`, and `session_event`. No cascade changes needed.

**Cleanup scheduler decision: GitHub Actions scheduled workflow.** `DATABASE_URL` is already in GitHub Secrets and used by the deploy workflow. Adding a nightly GH Actions job avoids exposing the secret to the Worker runtime. Cloudflare Cron Triggers are viable but require adding `DATABASE_URL` as a Worker secret via `wrangler secrets:put` — unnecessary complexity for a single daily cleanup.

**JWT caveat: tokens cannot be revoked server-side.** Signing the user out at deletion-request time clears the client token, but any token already issued remains valid until expiration. The plan must call `signOut()` as part of the deletion flow; JWT expiry should be verified to be short (check `maxAge` in auth config).

## Detailed Findings

### DB Schema — User Table and Relations

`src/shared/lib/schema.ts:11-20` defines the `user` table:
```
id, name, email (unique), emailVerified, image, hashedPassword
```
No `deleted_at`, `deletionRequestedAt`, or `isActive` column exists anywhere in the schema. Soft-delete must be added from scratch.

**FK relations with ON DELETE CASCADE** (all cascade — hard-deleting the user row triggers full cleanup):

| Table | FK column | Cascade | Schema line |
|---|---|---|---|
| `account` | `userId` | CASCADE | `schema.ts:27` |
| `session` | `userId` | CASCADE | `schema.ts:50` |
| `session_result` | `user_id` | CASCADE | `schema.ts:106` |

`session_event` rows cascade via `session_result` (FK → session_result → user). No additional constraint changes needed.

**Migration files**:
- `drizzle/migrations/0000_robust_dragon_lord.sql` — Auth.js tables (`user`, `account`, `session`, `verificationToken`)
- `drizzle/migrations/0001_secret_nicolaos.sql` — domain tables (`scenario`, `diagnostic_test`, `test_classification`, `session_result`, `session_event`)

A new migration (0002) is needed to add `deletionRequestedAt` to `user`.

### Auth.js Sessions — JWT Strategy with Drizzle Adapter

- **Session strategy**: `"jwt"` — `src/modules/auth/auth.ts:22` and `src/modules/auth/auth.config.ts:4`
- **Adapter**: `DrizzleAdapter` from `@auth/drizzle-adapter@^1.11.2` — `auth.ts:1,16-21`
- **JWT callbacks**: user ID stored in `token.sub` on login, extracted to `session.user.id` on every request — `auth.ts:23-31`
- **Logout**: `logoutAction()` calls `signOut({ redirectTo: "/" })` — `src/modules/auth/actions.ts:90-96`

**JWT revocation constraint**: JWT tokens are stateless. Deleting the user row removes all DB `session` rows (via cascade), but any JWT already in the user's browser cookie remains valid until it expires. The deletion flow must call `signOut()` to clear the client token before the user leaves the page.

**Login bypass for pending-deletion accounts**: A check `deletionRequestedAt IS NOT NULL → reject Credentials login` must be added to the `authorize` callback in `auth.config.ts`. The Credentials provider is where password validation happens (`src/modules/auth/actions.ts` → `authorize`).

**`auth()` call sites** that will need no changes (they already scope by `session.user.id` which will not resolve for deleted users):
- `src/modules/session/actions.ts:26,58,107`
- `src/app/dashboard/page.tsx:7`
- `src/shared/components/Nav/Nav.tsx`

### Cloudflare Workers Runtime — Scheduling Capability

`wrangler.jsonc` (31 lines) has **no `triggers.crons`** section currently. Key config:
```jsonc
"compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
"compatibility_date": "2026-05-24"
```

No `scheduled()` handler exists anywhere in `src/`. The built `.open-next/cloudflare-templates/worker.js` only exports `fetch` and Durable Object classes.

**To add a Cloudflare Cron Trigger**, the plan would need to:
1. Add `triggers: { crons: ["0 2 * * *"] }` to `wrangler.jsonc`
2. Export a `scheduled()` handler from the worker entry point
3. Add `DATABASE_URL` as a Worker secret via `wrangler secrets:put DATABASE_URL`

**DATABASE_URL is NOT currently a Worker runtime secret** — it is only available to the GitHub Actions migration step (`deploy.yml:24-25`). This is the key obstacle for Cloudflare Cron Triggers.

### GitHub Actions as Cleanup Scheduler

`deploy.yml` already uses `DATABASE_URL` (GitHub Secret, line 25) for `drizzle-kit migrate`. A second scheduled workflow can reuse the same secret with zero additional secret management:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'   # 2 AM UTC daily
```

The cleanup step: connect with postgres.js + `prepare: false` (Supabase Transaction Pooler constraint), query `WHERE deletionRequestedAt < NOW() - INTERVAL '30 days'`, hard-delete. The cascade removes all related rows.

This approach needs no wrangler changes, no new Worker secrets, and no `scheduled()` export.

### Data Isolation Pattern

No RLS in Supabase — isolation enforced via `WHERE user_id = $userId` in every query (`context/changes/data-schema/plan.md:29`). The deletion flow fits this pattern: all queries already require `userId`, so a user flagged for deletion simply can't authenticate and reach any query.

### Supabase Connection Constraint

`src/shared/lib/db.ts:5-8`: `postgres(DATABASE_URL, { prepare: false })` — required by Supabase PgBouncer transaction mode (port 6543). The GitHub Actions cleanup script must use the same pooler URL with `prepare: false`.

## Code References

- `src/shared/lib/schema.ts:11-20` — User table definition
- `src/shared/lib/schema.ts:25-27` — account FK → user (CASCADE)
- `src/shared/lib/schema.ts:46-52` — session table (CASCADE)
- `src/shared/lib/schema.ts:100-110` — session_result FK → user (CASCADE)
- `src/modules/auth/auth.ts:16-31` — DrizzleAdapter + JWT callbacks
- `src/modules/auth/auth.config.ts:1-11` — Credentials authorize + middleware callback
- `src/modules/auth/actions.ts:90-96` — logoutAction / signOut
- `src/shared/lib/db.ts:5-8` — postgres.js with `prepare: false`
- `wrangler.jsonc:1-31` — no crons section currently
- `.github/workflows/deploy.yml:24-25` — DATABASE_URL already in GitHub Secrets

## Architecture Insights

1. **Soft-delete column: `deletionRequestedAt timestamp` on `user`** (nullable). Naming is explicit — records the moment the user made the request, doubles as the 30-day countdown start. Alternative `deletedAt` is also conventional but `deletionRequestedAt` avoids confusion with the eventual hard delete.

2. **Hard delete fires the existing cascades** — no schema changes to FK constraints needed. The cascades were already designed for full user removal.

3. **Login block is the critical guard** — add to `authorize` in `auth.config.ts`: if the user row has `deletionRequestedAt IS NOT NULL`, return `null` (reject login). This prevents re-login after the request window.

4. **GitHub Actions cleanup is the recommended approach** over Cloudflare Cron Triggers because `DATABASE_URL` is already a GitHub Secret and Cloudflare requires separate secret provisioning for Worker runtime access.

5. **No query changes needed for "active" users** — all existing queries are already scoped by `userId`. Once a user can't authenticate, they can't reach any data path.

## Historical Context (from prior changes)

- `context/changes/auth-scaffold/plan.md:39` — `prepare: false` is non-negotiable for Supabase PgBouncer; cleanup script must respect this.
- `context/changes/auth-scaffold/plan.md:51` — Credentials login bypasses the Drizzle adapter's `createUser`; similarly, deletion must bypass adapter and use direct Drizzle queries.
- `context/changes/data-schema/plan.md:29` — explicit `WHERE user_id` pattern (no RLS); confirmed — no RLS to worry about when deleting.
- `context/foundation/infrastructure.md:66` — `AUTH_URL` must be set in Workers; irrelevant for deletion but confirms Workers env vars require explicit wrangler config.
- `context/foundation/roadmap.md:177` — open question on mechanism is now resolved: GitHub Actions scheduler + `deletionRequestedAt` column.

## Open Questions

1. **JWT `maxAge`**: What is the current JWT expiration configured in `auth.ts`? If it is long (e.g., 30 days), there is a window where a user who requested deletion can still make authenticated requests until the JWT expires. Verify and cap to ≤ 24 hours if needed.

2. **Grace period UI**: Should the user be able to cancel the deletion request within the 30-day window? RODO does not require a cancellation window, but it is a common UX pattern. If yes, `deletionRequestedAt` can simply be set to NULL.

3. **Confirmation email**: RODO best practice is to send a deletion confirmation email. This codebase has no email provider set up — is this in scope for S-05?
