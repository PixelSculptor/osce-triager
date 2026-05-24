---
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
---

## Why this stack

Solo developer building an OSCE medical simulation MVP in 3 weeks (after hours),
deploying to Cloudflare Workers + Pages with email+password authentication as the only
technology-forcing feature. Custom path chosen after declining the recommended
10x-astro-starter (Tailwind CSS conflict) and the T3 stack (same conflict). Next.js
cleared all four agent-friendly gates, carries the largest training-data corpus in the
JS family, and has verified bootstrapper confidence — the strongest combination for
solo + short-timeline work. Cloudflare Workers is the deployment target, using the
@opennextjs/cloudflare adapter (GA 2025, replaces the deprecated @cloudflare/next-on-pages);
the default cmd_template includes --tailwind which bootstrapper must override to --no-tailwind
to honour the explicit stack preference for clean CSS Modules or SCSS. Auth.js (NextAuth)
pairs cleanly with Next.js App Router for the email+password requirement; Prisma or Drizzle
handles PostgreSQL via Supabase (external). GitHub Actions with auto-deploy-on-merge is the
CI/CD shape. The five-point self-check returned 4/5 true — can_judge_agent was false,
indicating the user should review AI-generated Next.js output with extra care.
