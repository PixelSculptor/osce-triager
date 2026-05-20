---
bootstrapped_at: 2026-05-20T21:17:00Z
starter_id: next
starter_name: Next.js
project_name: osce-triager
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: next
package_manager: npm
project_name: osce-triager
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: false
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Solo developer building an OSCE medical simulation MVP in 3 weeks (after hours),
deploying to Cloudflare Pages with email+password authentication as the only
technology-forcing feature. Custom path chosen after declining the recommended
10x-astro-starter (Tailwind CSS conflict) and the T3 stack (same conflict). Next.js
cleared all four agent-friendly gates, carries the largest training-data corpus in the
JS family, and has verified bootstrapper confidence — the strongest combination for
solo + short-timeline work. Cloudflare Pages is the second deployment default in the
Next.js card, requiring the @cloudflare/next-on-pages adapter at scaffolding time; the
default cmd_template includes --tailwind which bootstrapper must override to --no-tailwind
to honour the explicit stack preference for clean CSS Modules or SCSS. Auth.js (NextAuth)
pairs cleanly with Next.js App Router for the email+password requirement; Prisma or Drizzle
handles PostgreSQL. GitHub Actions with auto-deploy-on-merge is the CI/CD shape. The
five-point self-check returned 4/5 true — can_judge_agent was false, indicating the user
should review AI-generated Next.js output with extra care.

---

## Pre-scaffold verification

| Signal       | Value                                           | Severity | Notes                                                          |
| ------------ | ----------------------------------------------- | -------- | -------------------------------------------------------------- |
| npm package  | create-next-app v16.2.6 published 2026-05-20    | fresh    | resolved from cmd_template; published today                    |
| GitHub repo  | not run                                         | n/a      | docs_url (https://nextjs.org/docs) is not a GitHub URL; skipped |

---

## Scaffold log

**Resolved invocation**: `npx create-next-app@latest bootstrap-scaffold --ts --no-tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`

> Note: the skill's default temp dir name `.bootstrap-scaffold` was rejected by `create-next-app` due to npm naming restrictions on period-prefixed names. Adapted to `bootstrap-scaffold` (no dot prefix) — same `subdir-then-move` mechanic, different temp directory name.

> `--no-tailwind` applied: the hand-off body explicitly requests replacing the card's default `--tailwind` flag to honour the CSS Modules / SCSS preference.

> `create-next-app` noted that `--agents-md` defaulted to true; an `AGENTS.md` was scaffolded and moved to cwd.

**Strategy**: subdir-then-move (scaffold into temp dir, apply conflict matrix, move files up, delete temp dir)
**Exit code**: 0
**Files moved**: 14 top-level items (including `node_modules/`, `src/`, `public/`, `.next/`, config files)
**Conflicts (.scaffold siblings)**:
- `CLAUDE.md` → existing wins; scaffold copy saved as `CLAUDE.md.scaffold`
- `README.md` → existing wins; scaffold copy saved as `README.md.scaffold`

**.gitignore handling**: moved silently (cwd had no existing `.gitignore`)
**Temp dir cleanup**: deleted (empty after move-up)

---

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 2 MODERATE, 0 LOW

**Direct vs transitive**: 1 MODERATE direct, 1 MODERATE transitive

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

**next** (direct)
- Severity: moderate
- Via: postcss
- Range affected: 9.3.4-canary.0 – 16.3.0-canary.5
- Advisory: see postcss entry below
- Fix available: `next@9.3.3` (semver major downgrade — not recommended for new projects)

**postcss** (transitive — pulled in by `next`)
- Severity: moderate
- Advisory: GHSA-qx2v-qp2m-jg93 — PostCSS XSS via unescaped `</style>` in CSS Stringify Output
- CVSS: 6.1 (AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N)
- CWE: CWE-79
- Affected range: `postcss < 8.5.10`
- Fix: available upstream; `next` must ship a patched bundled version

#### LOW / INFO findings

None.

---

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | verified             |
| quality_override        | false                |
| path_taken              | custom               |
| self_check_answers      | typed: true, from_official_starter: true, conventions: true, docs_current: true, can_judge_agent: false |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

Note: user added "remember to set up CSS modules" at the Step 0 confirmation. This is a runtime note logged here for future reference; bootstrapper v1 does not modify scaffold output based on runtime user notes.

---

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- Review the two `.scaffold` siblings: `diff CLAUDE.md CLAUDE.md.scaffold` and `diff README.md README.md.scaffold` to see what the starter shipped vs what you had. The project `CLAUDE.md` (your existing one) is intact.
- Add the `@cloudflare/next-on-pages` adapter when you are ready to wire up Cloudflare Pages deployment (the hand-off noted this as a required step).
- Add `Auth.js` (NextAuth) and a database ORM (Prisma or Drizzle) for the email+password authentication requirement.
- The 2 MODERATE audit findings are transitive; both trace to postcss bundled inside `next`. No immediate action required — monitor the `next` release channel for a patched version.
- CSS Modules are supported out of the box in Next.js; no additional package needed. Create `*.module.css` files alongside your components to start using them.
- `git add` and commit the scaffolded files when you are satisfied with the layout.
