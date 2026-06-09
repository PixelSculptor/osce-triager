---
change_id: session-history-save
title: Session history save
status: implemented
created: 2026-06-01
updated: 2026-06-09
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

## UI Design Debt — wymaga osobnego change'a

Po wdrożeniu S-03 (session-history-save) UI listy sesji i ogólny layout dashboardu są czytelne funkcjonalnie, ale wizualnie nieczytelne i niespójne. Brakuje spójnej palety kolorów, typografii i ogólnego design systemu. Obecny wygląd to surowe wartości domyślne — do adresowania w dedykowanym change `ui-design-system` przed pierwszymi pokazami dla użytkowników.

Zakres do omówienia w nowym change:
- Paleta kolorów (CSS custom properties — `--color-*`)
- Typografia (rozmiary, wagi, line-height)
- Spacing scale
- Badge/chip component
- Ogólna czytelność list i kart
