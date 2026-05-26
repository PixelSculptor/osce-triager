---
project: "OSCE Triager"
version: 1
created: 2026-05-26
updated: 2026-05-26
source: roadmap.md v1
---

# GitHub Task Management: OSCE Triager

> This file is a mirror of `context/foundation/roadmap.md` — it documents the full GitHub task management setup created on 2026-05-26 and serves as a stable reference for where every roadmap item lives in GitHub.
> When a roadmap item changes status, update **both** this file and `roadmap.md`.

---

## Repository

| Field         | Value                                                       |
|---------------|-------------------------------------------------------------|
| Repo          | `PixelSculptor/osce-traiger`                                |
| Issues URL    | https://github.com/PixelSculptor/osce-traiger/issues        |
| Project board | https://github.com/users/PixelSculptor/projects/1           |
| Board title   | "OSCE Triager MVP Roadmap"                                  |

---

## Session Summary (2026-05-26)

The six items from `roadmap.md` were migrated to GitHub Issues in dependency order. The following GitHub artifacts were created:

1. **5 labels** — categorise each issue by stream and readiness state.
2. **4 milestones** — group issues into sprint-sized buckets that follow the dependency chain.
3. **6 issues** — one per roadmap item, bodies written in English, cross-referenced by `#N`.
4. **1 GitHub Project board** — "OSCE Triager MVP Roadmap" (project #1), containing all 6 issues.

---

## Labels

| Label          | Color     | Meaning                                                     |
|----------------|-----------|-------------------------------------------------------------|
| `foundation`   | `#0075ca` | Horizontal enabler — not directly user-visible, unblocks slices |
| `slice`        | `#e4e669` | Vertical, user-visible end-to-end slice                     |
| `ready`        | `#0e8a16` | Roadmap status: implementation can start today              |
| `proposed`     | `#d4c5f9` | Roadmap status: scoped but blocked by a prerequisite        |
| `guiding-star` | `#e99695` | Marks S-02 — the north-star milestone; everything else is secondary until this ships |

---

## Milestones

| # | Title                      | Roadmap items | GitHub milestone URL                                                    |
|---|----------------------------|---------------|-------------------------------------------------------------------------|
| 1 | Sprint 0: Foundation       | F-01, F-03    | https://github.com/PixelSculptor/osce-traiger/milestone/1               |
| 2 | Sprint 1: Data + Auth UI   | F-02, S-01    | https://github.com/PixelSculptor/osce-traiger/milestone/2               |
| 3 | Sprint 2: Guiding Star ★   | S-02          | https://github.com/PixelSculptor/osce-traiger/milestone/3               |
| 4 | Sprint 3: Session History  | S-03          | https://github.com/PixelSculptor/osce-traiger/milestone/4               |

---

## Issue Map

Issues are numbered from #7 because six earlier issues existed in the repo and were deleted (GitHub never recycles issue numbers).

| GitHub # | Roadmap ID | Change ID              | Title                                                              | Labels                            | Milestone                  | Status   | URL                                                              |
|----------|------------|------------------------|--------------------------------------------------------------------|-----------------------------------|----------------------------|----------|------------------------------------------------------------------|
| #7       | F-01       | `auth-scaffold`        | [F-01] Auth.js scaffold with email+password on Cloudflare Workers | `foundation`, `ready`             | Sprint 0: Foundation       | ready    | https://github.com/PixelSculptor/osce-traiger/issues/7          |
| #8       | F-03       | `ci-cd-pipeline`       | [F-03] GitHub Actions CI/CD pipeline → Cloudflare Pages           | `foundation`, `ready`             | Sprint 0: Foundation       | ready    | https://github.com/PixelSculptor/osce-traiger/issues/8          |
| #9       | F-02       | `data-schema`          | [F-02] Drizzle + Supabase: domain schema + scenario seed data     | `foundation`, `proposed`          | Sprint 1: Data + Auth UI   | proposed | https://github.com/PixelSculptor/osce-traiger/issues/9          |
| #10      | S-01       | `auth-flow`            | [S-01] Email+password registration and login UI                   | `slice`, `proposed`               | Sprint 1: Data + Auth UI   | proposed | https://github.com/PixelSculptor/osce-traiger/issues/10         |
| #11      | S-02       | `first-playable-session` | [S-02] First diagnostic session with validator ★               | `slice`, `proposed`, `guiding-star` | Sprint 2: Guiding Star ★ | proposed | https://github.com/PixelSculptor/osce-traiger/issues/11         |
| #12      | S-03       | `session-history-save` | [S-03] Session history: save and display results per account      | `slice`, `proposed`               | Sprint 3: Session History  | proposed | https://github.com/PixelSculptor/osce-traiger/issues/12         |

---

## Dependency Graph

```
#7  F-01 auth-scaffold        ──┬──> #9  F-02 data-schema
#8  F-03 ci-cd-pipeline         │    (parallel with #10)
                                 │
                                 └──> #10 S-01 auth-flow
                                          │
                                 #9  ─────┴──> #11 S-02 first-playable-session ★
                                                         │
                                                    #12 S-03 session-history-save
```

- #7 and #8 have no prerequisites — they can start in parallel immediately.
- #9 and #10 both require #7; they can run in parallel with each other.
- #11 requires both #9 and #10 to be merged — it is the guiding star.
- #12 requires #11.

---

## Issue Body Format

Every issue follows this template (written in English):

```markdown
## Outcome
One sentence: what the developer/user can do once this is merged.

## Prerequisites
- #N [Title]   (or "None")

## Risks
Key risk from roadmap.md for this item.

## Open Questions
Unresolved unknowns that must be answered before implementation, or "None".

## PRD References
`FR-xxx`, `FR-xxx`

---
> Roadmap ID: `X-NN` · Change ID: `change-id-slug`
```

---

## How to Keep This in Sync

| Event                                      | Action                                                                  |
|--------------------------------------------|-------------------------------------------------------------------------|
| Roadmap item status changes to `done`      | Close the GitHub issue; update `Status` column above; add entry to `roadmap.md` § Zrobione |
| New roadmap item added                     | Create issue with `gh issue create`, add row to Issue Map above         |
| Roadmap item cancelled / moved to backlog  | Close issue as "not planned"; note reason in issue comment              |
| Open question resolved                     | Edit the relevant issue body to remove the question; update this file   |

---

## Next Actions

Per `roadmap.md` backlog handoff table, the two items ready to start immediately are:

- **#7 F-01** — run `/10x-plan auth-scaffold` to generate the implementation plan
- **#8 F-03** — run `/10x-plan ci-cd-pipeline` (can run in parallel with F-01)

Resolve the open questions in #9 (which clinical scenarios, how many, and their test classifications) before starting `data-schema`.
