---
change_id: ui-design-system
title: UI design system
status: done
created: 2026-06-09
updated: 2026-06-15
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- **Zaimplementowane 2026-06-15** na branchu `ui-design-system`, commity
  `a2af3eb` (faza 1: token foundation) → `a518714` (faza 4: migracja CSS modules
  - refinements). GitHub issue #38.
- Wszystkie 4 fazy: token foundation (`globals.css`), typografia + tooling
  (`next/font` Inter + IBM Plex Mono, `lucide-react`), theme infrastructure
  (`next-themes` + `ThemeToggle`), migracja 11 modułów CSS + 4 nowe companion
  moduły (usunięcie inline styles).
- Refinementy ponad zakres planu: IBM Plex Mono dla danych numerycznych i opisów
  scenariuszy, ThemeToggle dla zalogowanych i niezalogowanych, ujednolicenie
  status badge, focus ring teal z offsetem w nawigacji, glify Unicode strzałek →
  ikony Chevron z `lucide-react` (+ lekcja w `lessons.md`).
- Weryfikacja automatyczna (typecheck/lint/build/testy) przechodzi; weryfikacja
  ręczna wizualna (kroki 4.4–4.9 w `plan.md`) pozostaje do potwierdzenia w
  przeglądarce.
