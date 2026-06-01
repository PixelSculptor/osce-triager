# Lessons Learned

> Rejestr tylko do dodawania powtarzających się reguł i wzorców. Odczytywany ponownie na początku przez /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Use query modules for DB access in RSC — never self-calling REST routes

- **Context**: Next.js App Router — any RSC page (page.tsx) that needs data from the database
- **Problem**: Placing DB queries directly in page components scatters query logic and makes it hard to reuse/test; creating a REST API route for an RSC to call itself adds a needless HTTP round-trip and requires cookie forwarding for auth
- **Rule**: Pages import from server-only query modules (e.g. `queries.ts`); never create a REST API route just to serve data to an RSC. RSC page components run on the server — DB calls from them never reach the browser.
- **Applies to**: plan, implement, impl-review

## Verify every npm-script success criterion exists and runs before checking it off

- **Context**: Any plan phase whose success criteria reference an `npm run <script>` command for verification (typecheck / lint / build / test).
- **Problem**: A criterion named a script absent from package.json, so the command errored "Missing script", yet the [x] box was checked — verification was signed off blind across all 3 phases.
- **Rule**: Every `npm run <script>` named in a plan's success criteria must exist in package.json before the plan is written; verify each criterion actually executes before marking it [x].
- **Applies to**: all
