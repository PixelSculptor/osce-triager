# E2E Main Session Flow — Plan implementacji

## Przegląd

Dwa pliki spec Playwright chroniące Ryzyko #7 (pełny flow diagnostyczny w
przeglądarce) i Ryzyko #8 (formularz logowania) z Fazy 4
`context/foundation/test-plan.md`. Aplikacja jest zbudowana i uruchamialna;
warstwa E2E dla tych ryzyk jeszcze nie istnieje.

## Analiza stanu obecnego

Playwright ^1.60.0 jest zainstalowany. `playwright.config.ts` konfiguruje
projekt `setup` (`auth.setup.ts`) i projekt `chromium` (zależny od setup, używa
`storageState: 'playwright/.auth/user.json'`). Testy trafiają do
`src/__tests__/e2e/`.

`auth.setup.ts` już wypełnia formularz logowania przez `page.getByLabel` — Risk
#8 jest obsługiwane na poziomie infrastruktury, ale bez dedykowanego testu z
risk-tied name.

Istniejące testy E2E:

- `seed.spec.ts` — dźwignia jakości (wzorzec referencyjny)
- `auth-boundary.spec.ts` — Ryzyko #6 (przekierowanie middleware)

Brakuje testów dla Ryzyka #7 (full session flow w przeglądarce) i Ryzyka #8
(formularz logowania jako jawny test).

Dane seed: Scenariusz 1 "Ostry ból w klatce piersiowej" (5 min), dt-001 "EKG
12-odprowadzeniowe" → klasyfikacja `critical` → oczekiwany wynik walidatora:
`"Poprawne"`.

## Pożądany stan końcowy

Dwa nowe pliki spec w `src/__tests__/e2e/`:

- `session-flow.spec.ts` — zielony test: DnD selekcja EKG → badge "Poprawne" →
  wynik "Pozytywny" → wpis w historii
- `login-form.spec.ts` — zielony test: form fill → redirect `/dashboard` →
  "Panel studenta" widoczny

Oba weryfikowane przez intentional break (test czerwony gdy ryzyko się
zmaterializuje). Sekcja §6.4 w `context/foundation/test-plan.md` uzupełniona o
udowodnione wzorce.

### Kluczowe odkrycia

- `ScenarioCard` renderuje jako `<li>` z `<h2>{title}</h2>` i
  `<button>Rozpocznij sesję</button>` — scoping przez `getByRole('listitem')` z
  `filter({ hasText: ... })`
- `DraggableTestCard` ma `aria-label="Przeciągnij: {name}"` — lokator:
  `getByLabel('Przeciągnij: EKG 12-odprowadzeniowe')`
- `SortableTestCard` ma `aria-label="Zmień kolejność: {name}"` — scoping badge:
  `getByLabel('Zmień kolejność: EKG...').getByText('Poprawne')`
- Badge text w `TestCard`: `correct → "Poprawne"`,
  `suboptimal → "Akceptowalne"`, `unnecessary → "Zbędne"`
- Po zakończeniu sesji `SessionView` renderuje `<h1>Sesja zakończona</h1>` +
  `<p>Wynik: Pozytywny ✓</p>` + link "Wróć do panelu" → `/dashboard`
- Historia: `/dashboard/history`, wyświetla tytuł scenariusza i badge
  "Pozytywny"/"Negatywny"
- `auth.setup.ts` już wypełnia formularz — Risk #8 spec to dedykowany test z
  jawną asercją, nie zmiana w pliku setup

## Czego NIE robimy

- Nie zmieniamy `auth.setup.ts` (już wypełnia formularz przez `page.getByLabel`)
- Nie testujemy flow auto-zakończenia przez timer — test zawsze klika "Zakończ
  sesję"
- Nie testujemy negatywnego wyniku sesji (edge cases DnD → Ryzyko #4, Faza 5)
- Nie dodajemy cleanup sesji testowej — asercja historii po nazwie scenariusza,
  kumulacja akceptowalna dla MVP
- Nie piszemy testu dla DnD na pierwszym/ostatnim elemencie — to Ryzyko #4, Faza
  5
- Nie testujemy formularza rejestracji — jawnie poza zakresem w test-plan.md §7

## Podejście do implementacji

Faza 1 tworzy `session-flow.spec.ts` (Risk #7, DnD + walidator + historia). Faza
2 tworzy `login-form.spec.ts` (Risk #8) i uzupełnia §6.4 w test-plan.md. Oba
testy są niezależne, używają risk-tied names i weryfikują przez intentional
break.

## Krytyczne szczegóły implementacji

- **URL sesji jest dynamiczny**: po kliknięciu "Rozpocznij sesję", router.push
  trafia do `/dashboard/session/{uuid}`. `waitForURL('/dashboard')` nie
  wystarczy — wymagany regex: `waitForURL(/\/dashboard\/session\//)`.
- **Async po kliknięciu "Zleć"**: `handleSelectTest` awaits `selectTestAction`
  przed aktualizacją stanu. `toBeVisible()` na badge "Poprawne" auto-czeka
  (Playwright default 5s) — nie trzeba osobnego `waitFor`.

---

## Faza 1: Main diagnostic session flow (Risk #7)

### Przegląd

Tworzy `session-flow.spec.ts`: jeden test klikający przycisk "Zleć",
przechodzący przez pełny flow diagnostyczny i chroniący Ryzyko #7 z
`test-plan.md`. Selekcja przez przycisk jest stabilna w CI; DnD regression jest
właściwym zakresem Ryzyka #4 / Fazy 5.

### Wymagane zmiany:

#### 1. Nowy plik spec

**Plik**: `src/__tests__/e2e/session-flow.spec.ts`

**Cel**: Jawny E2E test Ryzyka #7 — cross-boundary flow: cookie auth → routing →
server action → stan klienta → feedback walidatora → trwałość → historia.
Udowadnia, że główna ścieżka produktu (S-02) działa end-to-end w przeglądarce.

**Kontrakt**: Pojedynczy `test()` wewnątrz `test.describe()`, tytuł odpowiada
obserwowalnemu wyniku biznesowemu z Risk #7. Używa storageState z projektu
chromium (nie overrideuje na puste cookies). Przepływ:

1. `page.goto('/dashboard')` + `waitForURL('/dashboard')`
2. Kliknij "Rozpocznij sesję" scopując do listitem zawierającego tekst "Ostry
   ból w klatce piersiowej"
3. `waitForURL(/\/dashboard\/session\//)` — dynamiczny UUID
4. Assert `getByRole('heading', { name: /Dostępne badania/ })` widoczny (sesja
   załadowana)
5. Kliknij `getByRole('button', { name: 'Zleć' })` przy karcie "EKG
   12-odprowadzeniowe" — scope do karty zawierającej tę nazwę, aby uniknąć
   pomyłki gdy lista ma wiele kart z przyciskiem "Zleć"
6. Assert `getByLabel('Zmień kolejność: EKG 12-odprowadzeniowe')` widoczny
   (badanie w prawej kolumnie)
7. Assert badge "Poprawne" widoczny wewnątrz scoped ordered EKG card
8. Click `getByRole('button', { name: 'Zakończ sesję' })`
9. Assert `getByRole('heading', { name: 'Sesja zakończona' })` widoczny
10. Assert tekst `/Pozytywny/` widoczny na stronie
11. `page.goto('/dashboard/history')`
12. Assert `getByText('Ostry ból w klatce piersiowej')` widoczny
13. Assert `getByText('Pozytywny')` widoczny gdziekolwiek na liście historii
14. Cleanup: brak (akumulacja sesji testowych akceptowalna; asercja scopowana po
    nazwie scenariusza)

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx playwright test src/__tests__/e2e/session-flow.spec.ts` na działającej
  aplikacji → wyjście 0
- `npm run typecheck` przechodzi bez błędów
- Intentional break: tymczasowe zwrócenie `validatorResult: "unnecessary"` z
  `selectTestAction` → test czerwony na asercji badge; cofnięcie → zielony

#### Weryfikacja ręczna:

- Badge "Poprawne" jest widoczny po kliknięciu "Zleć" (przed kliknięciem
  "Zakończ sesję")
- Po zakończeniu sesji `/dashboard/history` wyświetla nowy wpis z "Pozytywny"

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne
potwierdzenie od człowieka, że testy ręczne zakończyły się sukcesem, zanim
przejdziesz do następnej fazy.

---

## Faza 2: Login form + test-plan.md §6.4 (Risk #8)

### Przegląd

Tworzy `login-form.spec.ts` jako jawny test Ryzyka #8 i uzupełnia §6.4 w
`test-plan.md` wzorcami udowodnionymi w tej zmianie.

### Wymagane zmiany:

#### 1. Nowy plik spec

**Plik**: `src/__tests__/e2e/login-form.spec.ts`

**Cel**: Jawny E2E test Ryzyka #8 — formularz logowania: form fill → POST
`/api/auth/callback/credentials` → cookie sesji → przekierowanie `/dashboard`.
Infrastruktura (`auth.setup.ts`) nie jest wystarczającą ochroną ryzyka; gdy
formularz się zepsuje, setup failure blokuje wszystkie testy bez nazwanego
sygnału. Ten spec powierzchniuje regresję z risk-tied name.

**Kontrakt**: Pojedynczy `test()` wewnątrz `test.describe()`. Używa
`test.use({ storageState: { cookies: [], origins: [] } })` — brak sesji.
Przepływ:

1. `page.goto('/login')`
2. `getByLabel('Adres email').fill(process.env.TEST_USER_EMAIL!)`
3. `getByLabel('Hasło').fill(process.env.TEST_USER_PASSWORD!)`
4. `getByRole('button', { name: 'Zaloguj się' }).click()`
5. `waitForURL('/dashboard')`
6. Assert `getByRole('heading', { name: 'Panel studenta' })` widoczny
7. Cleanup: brak (flow bezstanowy z perspektywy DB)

#### 2. Uzupełnienie §6.4 w test-plan.md

**Plik**: `context/foundation/test-plan.md`

**Cel**: Zastąpić placeholder "DO UZUPEŁNIENIA" w §6.4 udowodnionymi wzorcami,
aby przyszli współtwórcy wiedzieli jak dodawać testy E2E dla flowów sesji.

**Kontrakt**: Sekcja §6.4 powinna dokumentować: lokalizacje plików spec, wzorzec
`test.use({ storageState })` dla testów nieuwierzytelnionych, wzorzec DnD
(`dragTo` na heading Zlecone badania), wzorzec asercji na badge walidatora
(scoped przez `getByLabel` SortableTestCard), wzorzec asercji historii po nazwie
scenariusza, polecenie uruchamiania, antywzorce do uniknięcia.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx playwright test src/__tests__/e2e/login-form.spec.ts` na działającej
  aplikacji → wyjście 0
- `npm run typecheck` przechodzi
- Intentional break: zmiana tekstu przycisku w `LoginForm.tsx` na "Wyślij" →
  test czerwony; cofnięcie → zielony
- `npx playwright test src/__tests__/e2e/` — wszystkie cztery pliki spec zielone
  razem

#### Weryfikacja ręczna:

- Oba nowe testy widoczne w Playwright HTML report
  (`npx playwright test --reporter=html`)
- §6.4 w `test-plan.md` zawiera wypełnione wzorce (nie "DO UZUPEŁNIENIA")

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich
automatycznych weryfikacji, zatrzymaj się tutaj, aby uzyskać ręczne
potwierdzenie od człowieka, że testy ręczne zakończyły się sukcesem, zanim
przejdziesz do następnej fazy.

---

## Strategia testowania

Oba testy są self-contained (własny setup → action → assertion → cleanup).
Intentional break jest obowiązkowym krokiem weryfikacji przed commitem —
sprawdza, że test faktycznie chroni nazwane ryzyko, a nie tylko "przechodzi".
Nie testujemy przypadków brzegowych UI ani trybu negatywnego w tej fazie (to
Faza 5).

## Referencje

- Ryzyka #7 i #8: `context/foundation/test-plan.md` §2, wskazówki §2, Faza 4 w
  §3
- Dźwignia jakości (wzorzec): `src/__tests__/e2e/seed.spec.ts`
- Wzorzec auth boundary: `src/__tests__/e2e/auth-boundary.spec.ts`
- Konfiguracja Playwright: `playwright.config.ts`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po
> zakończeniu kroku.

### Faza 1: Main session flow (Risk #7)

#### Automatyczne

- [ ] 1.1 `npx playwright test src/__tests__/e2e/session-flow.spec.ts`
      przechodzi na zielono
- [ ] 1.2 `npm run typecheck` przechodzi
- [ ] 1.3 Intentional break: zepsuty validatorResult → test czerwony; cofnięcie
      → zielony

#### Ręczne

- [ ] 1.4 DnD widocznie przesuwa kartę EKG w trybie `--headed`
- [ ] 1.5 Badge "Poprawne" widoczny po dragowaniu (przed zakończeniem sesji)
- [ ] 1.6 Historia na `/dashboard/history` pokazuje "Pozytywny" po zakończeniu
      sesji

### Faza 2: Login form + test-plan.md §6.4 (Risk #8)

#### Automatyczne

- [ ] 2.1 `npx playwright test src/__tests__/e2e/login-form.spec.ts` przechodzi
      na zielono
- [ ] 2.2 `npm run typecheck` przechodzi
- [ ] 2.3 Intentional break: zmiana tekstu przycisku → test czerwony; cofnięcie
      → zielony
- [ ] 2.4 `npx playwright test src/__tests__/e2e/` — wszystkie cztery pliki spec
      zielone razem

#### Ręczne

- [ ] 2.5 Oba nowe testy widoczne w Playwright HTML report
- [ ] 2.6 §6.4 w `test-plan.md` zawiera wypełnione wzorce
