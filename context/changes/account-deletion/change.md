---
change_id: account-deletion
title: Account deletion with 30-day data retention (RODO)
status: planned
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

Student może zażądać usunięcia konta; dane usuwane trwale po 30-dniowym okresie retencji — wymóg RODO (prawo do bycia zapomnianym). Mechanizm soft-delete do rozstrzygnięcia w research (flaga `deleted_at` + scheduled cleanup vs. Cloudflare Workers cron trigger).
