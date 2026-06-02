# Account Deletion with 30-Day RODO Retention — Plan Brief

> Full plan: `context/changes/account-deletion/plan.md`
> Research: `context/changes/account-deletion/research.md`

## What and Why

S-05: students can request deletion of their OSCE Triager account to satisfy RODO (EU GDPR) right-to-be-forgotten. Data is retained for a 30-day cancellable grace period, then permanently purged by a nightly automated job.

## Point of Entry

The codebase has no soft-delete infrastructure. The `user` table has 6 columns; all FK child tables (`account`, `session`, `session_result`, `session_event`) already use `ON DELETE CASCADE`. There is no `/account/settings` route. `DATABASE_URL` is already a GitHub Secret used in the deploy workflow.

## Desired End State

A student can open `/account/settings` (Nav link), type `DELETE` to confirm, and submit a deletion request. The settings page switches to a "pending deletion" banner showing the purge date. The student can cancel at any time within 30 days. After 30 days, a nightly GitHub Actions workflow hard-deletes their row; the cascades clean up all related data. Login with a hard-deleted account is rejected naturally (user row gone).

## Key Decisions

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Soft-delete column name | `deletionRequestedAt` timestamp (nullable) | Explicit name avoids confusion with the eventual hard delete; follows schema camelCase/snake_case convention | Research |
| Cleanup scheduler | GitHub Actions nightly cron | `DATABASE_URL` is already a GitHub Secret — Cloudflare Cron Trigger would require a new Worker secret | Research |
| Login during grace period | Allowed | User must be able to log in and cancel within 30 days | Plan |
| Cancellation | Yes — `deletionRequestedAt = NULL` | Standard UX; RODO doesn't prohibit it; prevents accidental permanent deletion | User input |
| UI placement | New `/account/settings` page + Nav link | Dedicated settings page; room to grow (future: change password) | User input |
| Confirmation UX | Type `DELETE` to enable submit | Industry standard for irreversible-seeming actions; prevents accidental clicks | User input |
| Confirmation email | Out of scope | No email provider in codebase; on-screen confirmation is sufficient for MVP | User input |
| signOut on deletion request | No | User must stay authenticated to reach the cancel button on the settings page | Plan |

## Scope

**In scope:** `deletionRequestedAt` schema column + migration, settings page, request + cancel server actions, Nav link, nightly GitHub Actions cleanup script.

**Out of scope:** Cloudflare Cron Trigger, email confirmation, password re-entry, login block during 30-day window, WCAG polish, i18n.

## Architecture / Approach

```
User                Settings Page (RSC)          DB                   GH Actions (nightly)
 |                        |                        |                         |
 |── GET /account/settings──>                      |                         |
 |                    auth() + getAccountSettings()──>                       |
 |<── render (delete form OR pending banner) ──────|                         |
 |                        |                        |                         |
 |── submit "DELETE" ─────>                        |                         |
 |              requestDeletionAction()             |                         |
 |                    UPDATE user SET deletion_requested_at = NOW()──>        |
 |<── page revalidates (pending banner) ───────────|                         |
 |                        |                        |                         |
 |                        |   (30 days later)       |                         |
 |                        |                        |  DELETE user WHERE      |
 |                        |                        |  deletion_requested_at  |
 |                        |                        |  < NOW()-30 days ───────>
 |                        |                        |  (CASCADE cleans rest)  |
```

New files: `src/modules/account/queries.ts`, `src/modules/account/actions.ts`, `src/app/account/settings/page.tsx`, `src/app/account/settings/DeleteAccountSection.tsx`, `src/app/account/settings/CancelDeletionSection.tsx`, `scripts/cleanup-expired-accounts.mjs`, `.github/workflows/cleanup.yml`.

Modified files: `src/shared/lib/schema.ts`, `src/shared/components/Nav/Nav.tsx`, `src/shared/components/Nav/Nav.module.css`.

## Phases in Brief

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema migration | `deletionRequestedAt` column in `user` table; Drizzle types updated | Migration must apply before Phase 2 deploys |
| 2. Settings page + actions | Full UI and server actions; Nav link | `revalidatePath` must fire after DB update or UI won't reflect new state |
| 3. Cleanup workflow | Nightly hard-delete of expired accounts | `postgres` package must be installed in GH Actions (`npm ci` step); `prepare: false` required for Supabase PgBouncer |

**Prerequisites:** F-01 (auth), F-02 (schema baseline), F-03 (CI/CD) — all done.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks and Assumptions

- JWT default maxAge is 30 days (not set in `auth.ts`). A user who is hard-deleted after 30 days may still hold a valid JWT cookie briefly. `signOut()` on hard-delete is not triggered server-side — but with no user row, all DB queries return empty, and re-login is naturally rejected. Acceptable for MVP.
- Cleanup script requires `postgres` in `node_modules`. The `npm ci` step in the workflow handles this.

## Success Criteria (Summary)

- Student can request deletion from `/account/settings` and see a pending-deletion state with the purge date.
- Student can cancel the deletion request from the same page.
- Nightly GH Actions workflow successfully hard-deletes accounts older than 30 days (verified via `workflow_dispatch`).
