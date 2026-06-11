---
change_id: testing-auth-boundary-gate
title: Auth boundary gate — prove middleware blocks unauthenticated access
status: planned
created: 2026-06-11
updated: 2026-06-11
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md:
"Auth boundary gate". Risks covered: #6 (unauthenticated request to
/dashboard/\* serves content instead of redirecting to /login). Test types
planned: integration, lightweight e2e. Risk response intent:

- Risk #6: Unauthenticated request to `/dashboard` and `/dashboard/session/[id]`
  returns HTTP 302 to `/login`, never serves content. Challenge: "middleware.ts
  exists, therefore all protected routes are covered" — Edge runtime config
  issues on Cloudflare Workers can cause middleware to silently pass requests.
  Cheapest layer: integration/e2e — unauthenticated HTTP request to `/dashboard`
  → assert redirect.
