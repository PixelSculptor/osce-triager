<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Flow — Plan implementacji (S-01)

- **Plan**: context/changes/auth-flow/plan.md
- **Scope**: All 3 phases of 3
- **Date**: 2026-05-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

All 18 planned changes implemented with intent intact. The #1 documented gotcha — NEXT_REDIRECT re-throw — is correctly guarded in all three server actions (`actions.ts:44, 81, 94`). bcrypt 12 rounds, no hardcoded secrets, register logic cleanly extracted to the shared util. Automated checks pass: `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Public register API skips the validation the form enforces

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/modules/auth/user.util.ts:10 ; src/app/api/auth/register/route.ts:15
- **Detail**: The plan refactored register logic into shared `registerUser()` so the API route and `registerAction` "don't diverge." But the shared core only rejects EMPTY values (`INVALID_INPUT`, user.util.ts:10). Email-format and 8-char-minimum checks live ONLY in `registerAction` (actions.ts:60-65). The API route passes `email ?? ""` / `password ?? ""` straight through (route.ts:15), so the unauthenticated public endpoint `POST /api/auth/register` creates a user with email `"x"` and a 1-char password — exactly what the UI form rejects. The validation does diverge.
- **Fix A ⭐ Recommended**: Move email-format + length validation into `registerUser` (the shared core); `registerAction` keeps only its UX-message wording.
  - Strength: Guarantees every caller (route, action, any future one) enforces the same contract — the original point of extracting `registerUser`. Closes the public-boundary gap in one place.
  - Tradeoff: `registerUser` throws a third error type (e.g. INVALID_EMAIL/WEAK_PASSWORD); route + action must map it.
  - Confidence: HIGH — single locus, matches the existing throw/map pattern already in the file.
  - Blind spot: None significant.
- **Fix B**: Duplicate the format/length checks into the API route.
  - Strength: No change to `registerUser`'s error contract.
  - Tradeoff: Re-introduces the duplication the plan set out to eliminate; two copies to keep in sync.
  - Confidence: MED — works, but fights the plan's own intent.
  - Blind spot: Future callers still bypass validation.
- **Decision**: FIXED via Fix A — validation moved into registerUser (INVALID_EMAIL/WEAK_PASSWORD); route maps both to 400.

### F2 — Email not normalized; case-sensitive uniqueness bypass + login mismatch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/modules/auth/user.util.ts:14-26 ; src/modules/auth/auth.ts:31-32
- **Detail**: `registerUser` inserts email verbatim and dedupes with `eq(users.email, email)`; `authorize()` in auth.ts queries verbatim too. The `users.email` column is `.unique()` but Postgres `text` is case-sensitive. So `"User@x.com"` and `"user@x.com"` register as two distinct accounts (defeating the unique constraint's intent), and a user who registers with mixed case can't log in with lowercase.
- **Fix A ⭐ Recommended**: Lowercase+trim email once inside `registerUser` (before dedupe + insert) and apply the same normalization in `authorize()`. Centralize so both paths stay in sync.
  - Strength: App-level fix, no migration; pairs naturally with F1 (same file, same edit pass).
  - Tradeoff: Two call sites must use the shared normalizer; if one is missed the bug returns.
  - Confidence: HIGH — trivial string normalization, well-understood.
  - Blind spot: Any already-seeded mixed-case rows aren't retro-fixed.
- **Fix B**: Enforce at the DB layer (citext column or a `lower(email)` unique index) via a migration.
  - Strength: Impossible to bypass from any code path, ever.
  - Tradeoff: Requires a schema migration — heavier; plan said "no schema changes."
  - Confidence: MED — correct but larger blast radius for an MVP.
  - Blind spot: opennext/Workers + Drizzle citext support not verified.
- **Decision**: FIXED via Fix A — added normalizeEmail() helper; applied in registerUser (dedupe+insert) and authorize() lookup.

### F3 — Plan's "npm run typecheck" criterion references a missing script

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md:102, 186, 259 ; package.json (scripts)
- **Detail**: Criteria 1.1 / 2.1 / 3.1 ("npm run typecheck przechodzi") are all marked `[x]` passing in Progress. But there is no `typecheck` script — `npm run typecheck` errors with "Missing script: typecheck". These three boxes were signed off blind. Type-correctness itself is fine: `npx tsc --noEmit` and `next build` both pass clean (build runs TypeScript internally), and lint passes. So the code is sound; the criterion is just unrunnable as written.
- **Fix**: Either add `"typecheck": "tsc --noEmit"` to package.json, or correct the plan criterion to `npm run build` (which already type-checks). Prefer adding the script — cheap and useful.
- **Decision**: FIXED + ACCEPTED-AS-RULE — added `"typecheck": "tsc --noEmit"` to package.json scripts; recorded recurring rule "Verify every npm-script success criterion exists and runs before checking it off" in context/foundation/lessons.md.

### F4 — Unplanned change to supabase/config.toml

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/config.toml
- **Detail**: Diff sets `[edge_runtime] enabled = false` (was `true`), with a comment that there are no supabase/functions and the enabled health-check fetches Deno std from deno.land, causing 502s offline. Local-dev-only toggle; touches no auth/DB/RLS/schema. Benign but outside auth-flow scope and undocumented in the plan.
- **Fix**: Accept. Optionally note in change.md that it's an unrelated dev-env fix bundled into this branch.
- **Decision**: SKIPPED

### F5 — Post-register signIn failure shows an error-styled success message

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/modules/auth/actions.ts:82-84 ; RegisterForm.tsx (formError class)
- **Detail**: If `registerUser` succeeds but the follow-up `signIn` throws a non-redirect error, the action returns `_form: "Konto zostało utworzone. Zaloguj się na /login."` — rendered red via the error style. This edge case IS in the plan; only the red styling is slightly misleading. A retry hits EMAIL_TAKEN.
- **Fix**: Accept as documented edge case, or add a neutral "notice" state distinct from errors for this one message.
- **Decision**: SKIPPED

### F6 — User-enumeration on the register endpoint (no rate limit)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/auth/register/route.ts:20 ; actions.ts:73
- **Detail**: Login correctly returns a generic "Nieprawidłowy email lub hasło" (good — no enumeration). Registration confirms existence: API 409 "User already exists" + form "Ten adres email jest już zajęty", with no rate limiting. This is the standard, near-unavoidable tradeoff for self-service registration UX.
- **Fix**: Accept as risk for MVP. Rate-limiting is out of scope per plan / CLAUDE.md (no new infra).
- **Decision**: ACCEPTED AS RISK — standard self-service registration tradeoff; rate-limiting out of scope (no new infra per CLAUDE.md).

## Out-of-findings notes

- `next build` emits a `middleware → proxy` deprecation warning, but that's pre-existing — auth-flow only touched `PUBLIC_PATHS` in `middleware.ts`, and the filename was a deliberate Edge-runtime choice from the earlier ci-cd-pipeline change.
- The deep import `isRedirectError` from `next/dist/client/components/redirect-error` is fragile across Next versions, but the plan explicitly chose it with a documented fallback — plan-sanctioned, not a finding.
