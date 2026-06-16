# Delete Session — Krótki plan

> Pełny plan: `context/changes/delete-session/plan.md` Badania:
> `context/changes/delete-session/research.md`

## Co i dlaczego

Aplikacja ma kompletny CRUD dla sesji poza **Delete**. Użytkownik nie ma
możliwości usunięcia sesji z historii. Implementujemy brakujące D: query +
server action + UI z modal potwierdzeniem, by domknąć pełny CRUD i dać
użytkownikom kontrolę nad ich historią.

## Punkt wyjścia

`session_result` ma już CASCADE DELETE do `session_event` w DB — żadna migracja
nie jest potrzebna. Brakuje wyłącznie warstwy aplikacyjnej: funkcji query,
server action i komponentów UI. Historia nie pokazuje sesji `in_progress` (filtr
`outcome != 'in_progress'` w `getUserSessions`).

## Pożądany stan końcowy

Użytkownik klika ikonę kosza na karcie sesji w historii, widzi modal z
potwierdzeniem, i po kliknięciu "Potwierdź" karta znika z listy (revalidatePath
odświeża RSC bez toastu). Sesje in_progress są blokowane na poziomie server
action jako defensywny guard.

## Kluczowe podjęte decyzje

| Decyzja               | Wybór                                               | Dlaczego                                                           | Źródło  |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| In_progress delete    | Blokować                                            | Defensywniejszy guard; historia ich nie pokazuje ale API je obnaża | Plan    |
| UI confirm pattern    | Modal dialog (`useModal` hook)                      | Jasny intencjonalny UX; spójny z przyszłymi operacjami delete      | Plan    |
| Post-delete feedback  | Cicha aktualizacja listy                            | Brak systemu toast w aplikacji; revalidatePath wystarczy           | Plan    |
| Modal primitive       | Native `<dialog>` HTML                              | Brak @radix-ui ani @headlessui w package.json; zero nowych dep     | Plan    |
| Cascade delete events | Przez DB CASCADE                                    | FK `session_event → session_result` ON DELETE CASCADE już istnieje | Badania |
| Ownership WHERE       | `and(eq(id), eq(userId))`                           | IDOR fix z `testing-data-isolation-session-persistence`            | Badania |
| Test scope            | R-DEL-01,02,03,05 (integration) + R-DEL-06,07 (E2E) | Pokrywa IDOR, cascade, edge cases i pełny UI flow                  | Plan    |

## Zakres

**W zakresie:**

- `deleteSessionById(sessionId, userId)` w `queries.ts`
- `deleteSessionAction(sessionId)` w `actions.ts` z in_progress guard
- `useModal` hook w `src/shared/hooks/`
- `ConfirmModal` komponent w `src/shared/components/`
- `DeleteSessionButton` komponent w `src/modules/session/components/`
- Aktualizacja `HistoryCard` (dodanie `"use client"` + DeleteSessionButton)
- Integration testy (queries + actions) — 5 nowych testów
- E2E spec `session-delete.spec.ts` — 2 testy (cancel + confirm)

**Poza zakresem:**

- Migracje DB
- Toast/notification system
- R-DEL-08 (concurrent delete)
- Testy komponentowe DeleteSessionButton/ConfirmModal w jsdom
- Usuwanie sesji in_progress z UI

## Architektura / Podejście

```
history/page.tsx (RSC)
  └── HistoryFilter (client component)
        └── HistoryCard (client component — nowe "use client")
              └── DeleteSessionButton (client component)
                    ├── useModal() — local state (isOpen)
                    ├── ConfirmModal — native <dialog> + CSS Module
                    └── deleteSessionAction(sessionId) — server action
                          ├── auth() → userId
                          ├── getSessionById() → check in_progress
                          ├── deleteSessionById() — .delete().returning()
                          └── revalidatePath('/dashboard/history')
```

## Fazy w skrócie

| Faza                 | Co dostarcza                                                            | Kluczowe ryzyko                                                      |
| -------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Backend           | `deleteSessionById` + `deleteSessionAction`                             | Ownership WHERE musi mieć `userId` — IDOR jeśli pomięty              |
| 2. Integration Tests | 5 testów: IDOR, cascade, not-found, unauthorized, in_progress           | Fixture cleanup kolejność FK (odwrotna)                              |
| 3. UI                | `useModal`, `ConfirmModal`, `DeleteSessionButton`, update `HistoryCard` | Native `<dialog>` + CSS Module bez design system — spójność wizualna |
| 4. E2E Tests         | `session-delete.spec.ts` — cancel + confirm flow                        | Locatory muszą być role-based, nie CSS (lessons.md)                  |

**Wymagania wstępne:** `DATABASE_URL_TEST` w `.env.test` dla testów
integracyjnych; serwer Next.js + Supabase dla E2E

**Szacowany nakład:** ~2 sesje implementacyjne (Fazy 1-2 razem, Fazy 3-4 razem)

## Otwarte ryzyka i założenia

- `HistoryCard` jest prawdopodobnie server component — plan zakłada dodanie
  `"use client"`, co jest bezpieczne bo parent (`HistoryFilter`) jest już client
  component
- Native `<dialog>` z `open` attr (nie `.showModal()`) — wymaga ręcznego focus
  trap jeśli potrzebny dla a11y; pomijamy dla MVP
- E2E testy tworzą sesje przez UI (pełny flow) — jeśli seed jest potrzebny, może
  wymagać skryptu pomocniczego

## Kryteria sukcesu (podsumowanie)

- Użytkownik może usunąć zakończoną sesję z historii przez UI z modal
  potwierdzeniem
- IDOR: User B nie może usunąć sesji User A (weryfikowany integration testem)
- E2E: cancel zachowuje sesję, confirm usuwa z historii
