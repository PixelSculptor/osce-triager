---
name: 10x-implement
description: Implement technical plans from context/changes/<change-id>/plan.md with verification
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Task
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# Implementacja planu

Twoim zadaniem jest zaimplementowanie zatwierdzonego planu technicznego z `context/changes/<change-id>/plan.md`. Plany te zawierają fazy ze specyficznymi zmianami oraz kanoniczną sekcję `## Progress` na dole, która steruje stanem wykonania (patrz `references/progress-format.md`).

## Wstępna konfiguracja

Po wywołaniu tej komendy:

1. **Rozwiąż plan**:
   - Jeśli wywołano jako `/10x-implement <change-id> [phase N]`, rozwiąż do `context/changes/<change-id>/plan.md`.
   - Jeśli wywołano z `@context/changes/<change-id>/plan.md` lub pełną ścieżką, zaak