---
change_id: first-playable-session
title: First diagnostic session with real-time validator
status: preparing
created: 2026-05-31
updated: 2026-05-31
archived_at: null
---

## Notes

S-02 from roadmap.md — the guiding-star milestone. Student opens a hardcoded clinical scenario with a countdown timer, picks diagnostic tests from a list, and gets instant validator feedback — including the session being irreversibly marked negative if a life-saving test is skipped.

Prerequisites done: S-01 (auth-flow) + F-02 (data-schema) both merged.

GitHub: issue #11, milestone "Sprint 2: Guiding Star ★" — https://github.com/PixelSculptor/osce-traiger/issues/11

Key constraints from roadmap.md:
- Validator must respond in <1 s (NFR); classification logic must be deterministic and server-side only — client-side validation violates PRD determinism rule.
- Session marked irreversibly negative after any critical test is skipped.
- Optional pre-start: add `drizzle-kit migrate` step to `deploy.yml` (2-3 lines + DATABASE_URL secret in GitHub) to avoid manual DB migration on each deploy.

PRD refs: FR-003, FR-004, FR-005, FR-006, FR-007, US-01, Business Logic section.
