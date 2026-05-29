# Lessons Learned

> Rejestr tylko do dodawania powtarzających się reguł i wzorców. Odczytywany ponownie na początku przez /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Verify every npm-script success criterion exists and runs before checking it off

- **Context**: Any plan phase whose success criteria reference an `npm run <script>` command for verification (typecheck / lint / build / test).
- **Problem**: A criterion named a script absent from package.json, so the command errored "Missing script", yet the [x] box was checked — verification was signed off blind across all 3 phases.
- **Rule**: Every `npm run <script>` named in a plan's success criteria must exist in package.json before the plan is written; verify each criterion actually executes before marking it [x].
- **Applies to**: all
