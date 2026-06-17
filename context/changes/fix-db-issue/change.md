---
change_id: fix-db-issue
title:
  Fix unstable Supabase DB communication from Cloudflare Worker (hung-request
  errors)
status: planned
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

Database URL is now confirmed correct (validated by manual research). The
remaining problem is runtime instability in production: communication with the
Supabase DB fails intermittently, many requests cannot complete or must be
retried several times.

Recurring error:

> Error: The Workers runtime canceled this request because it detected that your
> Worker's code had hung and would never generate a response.
> https://developers.cloudflare.com/workers/observability/errors/

Reference: similar problem reported in TanStack Router issue #5323, with a
well-rated solution comment:

- https://github.com/TanStack/router/issues/5323
- https://github.com/TanStack/router/issues/5323#issuecomment-3548779998

Goal: research whether a similar fix can resolve the Next.js-on-Cloudflare ↔
Supabase communication issue. Related prior context: prod DB connection required
Hyperdrive (workerd does not trust Supabase certs over raw sockets); see memory
project-prod-db-connection.
