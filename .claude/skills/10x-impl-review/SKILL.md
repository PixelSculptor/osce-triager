---
name: 10x-impl-review
description: Review implementation against plan for drift, dangerous decisions, and pattern compliance
argument-hint: <plan-path> [phase N] | <saved-review-path>
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# Przegląd implementacji

Porównaj rzeczywistą pracę implementacyjną z oryginalnym planem, aby wychwycić odchylenia, niebezpieczne decyzje, naruszenia architektury i niewłaściwe użycie wzorców, zanim się one skumulują.

Dwie ziarnistości:
- **Przegląd fazy**: po pojedynczej fazie — szybki, skupiony na zmianach w tej fazie
- **Pełny przegląd planu**: po wszystkich fazach — kompleksowe sprawdzenie

Dwa tryby:
- **Świeży przegląd**: analiza → ustalenia → interaktywne sortowanie
- **Wznowienie sortowania**: załaduj zapisany raport i przejdź do sortowania poszczególnych problemów

## Rozwiązanie wejścia

1. Argument wskazuje na zapisany plik przeglądu (zawiera `<!-- IMPL-REVIEW-REPORT -->`) → **wznów sortowanie** (przejdź do kroku 5)
2. Argument to `<change-id>` i istnieje `context/changes/<change-id>/plan.md` → świeży przegląd tego planu
3. Podano ścieżkę do planu (np. `@context/changes/<change-id>/plan.md`) → świeży przegląd tego planu
4. Podano numer fazy (np. "phase 3") → przegląd tylko tej fazy
5. Brak argumentu → wylicz `context/changes/*/change.md`; wybierz ostatnio `updated` zmianę ze `status` w `{implementing, implemented}` i potwierdź za pomocą AskUserQuestion

Jeśli rozwiązana ścieżka planu zaczyna się od `context/archive/`, odmów: wydrukuj "This change is archived. Reviews are not appended to archived plans." i ZATRZYMAJ.

## Krok 1: Załaduj plan i wykryj zakres zmian

TaskCreate: "Implementation Review" / activeForm "Loading context"

1. **Wczytaj cały plik planu** — bez limitu/offsetu.
2. **Wczytaj `context/foundation/lessons.md` jeśli istnieje** i użyj zaakceptowanych reguł jako priorytetów podczas skanowania w poszukiwaniu ustaleń — odchylenie, które narusza znaną, powtarzającą się regułę, jest silniejszym sygnałem niż ogólna uwaga stylistyczna.
3. **Wczytaj kanoniczny stan z sekcji `## Progress` planu** (patrz `references/progress-format.md`): ukończenie = `count([x]) / count([ ] + [x])`; bieżąca faza = faza zawierająca pierwszy `- [ ]` (lub ostatnia faza, jeśli wszystkie są ukończone). Wczytaj również sąsiedni `change.md` dla `status` i `updated`.
4. **Zakres**: żądana konkretna faza → tylko ta faza; w przeciwnym razie wszystkie fazy, których pola wyboru postępu są w pełni `[x]` (tj. ukończone fazy).
5. **Wyodrębnij** z przeglądanych faz: ścieżki plików z "Changes Required", decyzje architektoniczne, kryteria sukcesu (punkty Automatyczne/Ręczne w blokach faz + ich lustrzane odbicie `[ ]`/`[x]` w Progress) oraz listę "What We're NOT Doing" (bariery zakresu).
6. **Wykrywanie zakresu Git** — co faktycznie się zmieniło:
   ```bash
   PLAN_DATE="<YYYY-MM-DD from filename>"
   git log --oneline --after="${PLAN_DATE}" -- .
   git diff --name-only $(git log --reverse --after="${PLAN_DATE}" --format="%H" | head -1)^..HEAD 2>/dev/null
   ```
   Jeśli zakres nie może być czysto określony, wróć do commitów, których komunikaty odwołują się do planu/funkcji.

Porównaj listę zmienionych plików z listą plików planu:
- **W planie ORAZ w diffie** → oczekiwana zmiana, zweryfikuj zgodność treści z zamierzeniem
- **W diffie, ale NIE w planie** → nieplanowana zmiana, zbadaj i oznacz
- **W planie, ale NIE w diffie** → potencjalnie brakująca implementacja

Nie wczytuj każdego zmienionego pliku do głównego kontekstu — pozwól pod-agentom wczytać to, czego potrzebują. Główny kontekst powinien zawierać plan i podsumowanie diffa, a nie pełne źródło 20 plików.

## Krok 2: Równoległy przegląd za pomocą pod-agentów

TaskUpdate: activeForm "Gathering evidence"

Uruchom **dwóch** pod-agentów jednocześnie. Każdy otrzymuje ukierunkowany kontekst — nie wrzucaj całego planu do obu.

**Agent 1 — Wykrywanie odchyleń od planu** (`subagent_type: "general-purpose"`)

Daj mu: tekst "Changes Required" dla przeglądanych faz, listę ścieżek plików do odczytania.

Instrukcje: dla każdej zaplanowanej zmiany, przeczytaj rzeczywisty plik i zweryfikuj zgodność implementacji z zamierzeniem. Sprawdź:
- Zmiany zaimplementowane inaczej niż planowano (niezgodność intencji, nie formatowania)
- Zaplanowane elementy pominięte bez dokumentacji
- Dodatki nieopisane w planie (rozszerzenie zakresu)

Zgłoś każdy: ścieżkę pliku, co mówił plan, co istnieje, werdykt (MATCH / DRIFT / MISSING / EXTRA).

**Agent 2 — Bezpieczeństwo, jakość i zgodność ze wzorcami** (`subagent_type: "general-purpose"`)

Daj mu: pełną listę zmienionych plików do odczytania, ścieżkę do katalogu głównego projektu.

Instrukcje:

1. **Skanowanie bezpieczeństwa i jakości** na każdym zmienionym pliku. Oznacz:
   - **Bezpieczeństwo**: ryzyka wstrzyknięcia (SQL, polecenia, XSS), zakodowane na stałe sekrety, brak autentykacji/autoryzacji na granicach systemu, zbyt liberalne CORS/uprawnienia.
   - **Wydajność**: zapytania N+1, nieograniczone iteracje/rekurencje, brak paginacji, niepotrzebne synchroniczne I/O.
   - **Niezawodność**: brak obsługi błędów na zewnętrznych granicach (wywołania API, I/O plików, DB), warunki wyścigu, wycieki zasobów.
   - **Bezpieczeństwo danych**: destrukcyjne operacje DB bez rollbacku, zmiany schematu bez ścieżki migracji, potencjalna utrata danych.

2. **Zgodność ze wzorcami** — dla każdego zmienionego pliku znajdź 1–2 podobne istniejące pliki i porównaj nazewnictwo, podejście do obsługi błędów, strukturę modułów, importy/eksporty, strukturę testów, wzorce konfiguracji. **Zgłaszaj tylko istotne niezgodności** (np. nowy moduł używa camelCase, gdzie sąsiednie używają snake_case; nowy endpoint pomija wzorzec middleware autoryzacji, którego używa reszta API). Pomiń trywialne różnice stylistyczne — jeśli kod działa i jest zgodny z planem, drobne formatowanie nie jest ustaleniem.

3. **Dostosuj pracę nad wzorcami do zakresu** — jeśli diff zmienił ≤3 pliki, poświęć minimalny czas na wzorce (niewiele do porównania). Skaluj głębokość wzorców wraz z zakresem zmian.

Zgłoś każde ustalenie z: plikiem, numerem linii, kategorią, ważnością (CRITICAL / WARNING / OBSERVATION), opisem, rekomendacją.

## Krok 3: Zweryfikuj kryteria sukcesu

TaskUpdate: activeForm "Verifying success criteria"

Dla każdej przeglądanej fazy:

**Automatyczne**: uruchom każde polecenie z pól wyboru "Automated Verification" za pomocą Bash. Zapisz polecenie, wynik (pass/fail), rzeczywiste wyjście (obetnij, jeśli jest ogromne).

**Ręczne**: w sekcji `## Progress` sprawdź elementy ręczne jako `- [x]` vs `- [ ]`. Oznacz elementy oznaczone jako ukończone, które nie mają widocznych dowodów w diffie (możliwe "podpisywanie na ślepo"); uznaj niezaznaczone elementy za oczekujące.

## Krok 4: Skompiluj ustalenia i przedstaw raport

TaskUpdate: activeForm "Compiling findings"

Każde ustalenie ma:
- **ID**: F1, F2, F3…
- **Ważność**: CRITICAL / WARNING / OBSERVATION (jak źle, jeśli zignorowane)
- **Wpływ**: LOW / MEDIUM / HIGH (ile uwagi wymaga decyzja)
- **Wymiar**: Plan Adherence / Scope Discipline / Safety & Quality / Architecture / Pattern Consistency / Success Criteria
- **Tytuł**: jedna linia
- **Lokalizacja**: `file:line` (lub "N/A" dla brakujących elementów)
- **Szczegóły**: co jest nie tak z dowodami — plan vs. rzeczywistość, lub kod vs. oczekiwania
- **Opcje naprawy**: 1 lub 2 (patrz poniżej)

### Wpływ

Ortogonalny do ważności. CRITICAL z LOW wpływem (oczywista jednowierszowa poprawka) jest tania; WARNING z HIGH wpływem (przebudowa architektury) wymaga starannego przemyślenia.

| Wpływ | Znaczenie |
|---|---|
| 🏃 **NISKI** | Szybka decyzja. Poprawka jest oczywista i wąsko zakrojona. Bezpieczne do grupowania. |
| 🔎 **ŚREDNI** | Warto się zatrzymać. Prawdziwy kompromis lub nietrywialna edycja — pomyśl przed podjęciem decyzji. |
| 🔬 **WYSOKI** | Stawka architektoniczna. Szeroki promień rażenia, strategiczne implikacje lub niejasna najlepsza ścieżka. |

### Opcje naprawy

Domyślnie **jedna** poprawka. Oferuj dwie tylko wtedy, gdy istnieje prawdziwy kompromis, który inteligentny recenzent chciałby rozważyć (np. "załataj miejsce wywołania" vs. "napraw to u źródła"). Jeśli wymyślasz słabą drugą opcję, nie rób tego — przedstaw jedną i idź dalej.

**Ustalenia o NISKIM wpływie**: tylko `Fix: [jedna linia]`. Hałas nie jest pomocny, gdy odpowiedź jest oczywista.

**Ustalenia o ŚREDNIM/WYSOKIM wpływie**: każda opcja otrzymuje:
```
[1-zdaniowe podejście] · Siła: [zaleta, najlepiej oparta na dowodach z kodu/planu] · Kompromis: [koszt lub ryzyko] · Pewność: HIGH|MED|LOW — [1-liniowe dlaczego] · Martwy punkt: [czego nie zweryfikowaliśmy, lub "Brak znaczących"]
```

Oferując dwie opcje, oznacz dokładnie jedną `⭐ Recommended`.

### Werdykty wymiarów

PASS / WARNING / FAIL na wymiar:
- **Plan Adherence** — zaplanowane zmiany zaimplementowane zgodnie z opisem? FAIL w przypadku MISSING lub dużego DRIFT.
- **Scope Discipline** — granice "nie robimy" przestrzegane? WARNING, jeśli istnieją dodatkowe zmiany, ale są nieszkodliwe.
- **Safety & Quality** — bezpieczeństwo, wydajność, niezawodność, bezpieczeństwo danych. FAIL w przypadku każdego CRITICAL ustalenia.
- **Architecture** — granice modułów, kierunek zależności, uzasadnienie abstrakcji. FAIL w przypadku naruszeń.
- **Pattern Consistency** — zgodność z istniejącymi konwencjami. WARNING w przypadku drobnych niezgodności.
- **Success Criteria** — automatyczne testy przechodzą, ręczne testy zaadresowane. FAIL w przypadku automatycznych błędów.

### Ogólny werdykt

- **ZAAKCEPTOWANY** — wszystkie PASS, lub PASS z ≤2 drobnymi ostrzeżeniami
- **WYMAGA UWAGI** — wiele ostrzeżeń lub 1 niekrytyczny FAIL
- **ODRZUCONY** — każdy krytyczny FAIL (bezpieczeństwo, duże odchylenie, bezpieczeństwo danych, nieudane testy)

Sortuj ustalenia według ważności: CRITICAL → WARNING → OBSERVATION. Ogranicz do 10 — skonsoliduj powiązane ustalenia, jeśli jest ich więcej.

### Format raportu

Zwykły tekst, rysowanie ramek. Wymiary PASS pojawiają się tylko w tabeli werdyktów, nigdy jako ustalenia. Pomiń grupy ważności z zerową liczbą ustaleń.

```
═══════════════════════════════════════════════════════════
  PRZEGLĄD IMPLEMENTACJI: [Tytuł planu]
  Zakres: Faza [N] z [Całkowita]  |  Data: RRRR-MM-DD
  Ustalenia: [N krytycznych] [N ostrzeżeń] [N obserwacji]
═══════════════════════════════════════════════════════════

  Zgodność z planem        PASS    ✅
  Dyscyplina zakresu      WARNING ⚠️   (1 ustalenie)
  Bezpieczeństwo i jakość      FAIL    ❌   (1 ustalenie)
  Architektura          PASS    ✅
  Spójność wzorców   WARNING ⚠️   (1 ustalenie)
  Kryteria sukcesu      PASS    ✅

  ► Ogólnie: WYMAGA UWAGI

═══════════════════════════════════════════════════════════
  KRYTYCZNE USTALENIA ❌
═══════════════════════════════════════════════════════════

  F1 — Wstrzyknięcie SQL w obsłudze autoryzacji
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Ważność:  ❌ KRYTYCZNE
    Wpływ:    🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
    Wymiar: Bezpieczeństwo i jakość
    Lokalizacja:  src/auth/handler.ts:42

    Szczegóły:
    Zapytanie SQL zbudowane z konkatenacji ciągów. Plan określał
    zapytania parametryzowane, ale implementacja używa literałów szablonowych.

    Poprawka: Zastąp literał szablonowy zapytaniem parametryzowanym używając
         db.query($1, [value]).
      Siła:   Pasuje do wzorca w src/users/query.ts i całkowicie usuwa
                  klasę wstrzyknięcia.
      Kompromis:   Drobny — jedno miejsce wywołania, zmiana kilku linii.
      Pewność: WYSOKA — identyczny wzorzec używany gdzie indziej w tym repozytorium.
      Martwy punkt: Brak znaczących.

═══════════════════════════════════════════════════════════
  OSTRZEŻENIA ⚠️
═══════════════════════════════════════════════════════════

  F2 — Nieplanowany endpoint /api/status
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Ważność:  ⚠️ OSTRZEŻENIE
    Wpływ:    🔬 WYSOKI — stawka architektoniczna; pomyśl dokładnie przed podjęciem decyzji
    Wymiar: Dyscyplina zakresu
    Lokalizacja:  src/api/routes.ts:18

    Szczegóły:
    Nowy endpoint GET /api/status nie znajduje się w planie. Funkcjonalność jest
    związana z planowaną pracą, ale rozszerza publiczną powierzchnię API.

    Poprawka A ⭐ Zalecana: Udokumentuj w planie jako aneks
      Siła:   Zachowuje już wykonaną pracę; aktualizuje źródło
                  prawdy, zanim przyszłe przeglądy użyją planu jako podstawy.
      Kompromis:   Plan staje się nieco ruchomym celem.
      Pewność: WYSOKA — aktualizacje planu tego repozytorium regularnie uwzględniają
                  odkryty zakres poprzez aneksy.
      Martwy punkt: Zainteresowane strony, które przeglądały pierwotny zakres, nie są
                  powiadamiane.

    Poprawka B: Usuń i dodaj do prac uzupełniających
      Siła:   Utrzymuje ścisłą dyscyplinę zakresu.
      Kompromis:   Traci zaimplementowaną pracę; później potrzebny kolejny PR.
      Pewność: ŚREDNIA — zależy, czy coś już od tego zależy.
      Martwy punkt: Nie sprawdzono wywołań /api/status.

  ···

  F3 — camelCase vs. snake_case
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Ważność:  ⚠️ OSTRZEŻENIE
    Wpływ:    🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
    Wymiar: Spójność wzorców
    Lokalizacja:  src/utils/format.ts

    Szczegóły:
    Używa camelCase (formatDate, parseInput), podczas gdy istniejące narzędzia używają
    snake_case (format_date, parse_input).

    Poprawka: Zmień nazwy eksportów na snake_case, aby pasowały do src/utils/.

═══════════════════════════════════════════════════════════
```

### Zasady formatowania raportu

- **Linia tytułu ustalenia** zawiera tylko ID i krótki tytuł — nic więcej. Wszystko inne znajduje się poniżej jako oznaczone pola, dzięki czemu każdy wiersz jest krótki i łatwy do zeskanowania.
- **Zawsze łącz ikony ze słowem.** Nigdy nie używaj samej ikony jako jedynego sygnału — `❌ KRYTYCZNE`, a nie tylko `❌`. Dzięki temu raport jest czytelny podczas szybkiego przeglądania i nie zmusza użytkownika do zapamiętywania znaczenia każdej ikony.
- **Wpływ zawsze zawiera swoje jednowierszowe znaczenie** (skopiuj z tabeli Wpływ — "stawka architektoniczna; pomyśl dokładnie przed podjęciem decyzji" / "prawdziwy kompromis; zatrzymaj się, aby to przemyśleć" / "szybka decyzja; poprawka jest oczywista i wąsko zakrojona"). Dzięki temu LOW/MEDIUM/HIGH są samoobjaśniające w miejscu użycia, zamiast polegać na tym, że użytkownik zapamięta tabelę.
- Ważność, Wpływ, Wymiar, Lokalizacja są każdy w osobnej linii z wyrównanymi etykietami. Szczegóły zaczynają się w osobnej linii pod etykietą `Detail:`, dzięki czemu mogą naturalnie zawijać się.

Po raporcie zapytaj:

```
question: "Przegląd zakończony. Jak chcesz postąpić?"
header: "Przegląd implementacji — [N] ustaleń"
options:
  - label: "Sortuj ustalenia"
    description: "Przejdź przez każde ustalenie i zdecyduj."
  - label: "Zapisz raport i posortuj później"
    description: "Zapisz pełny raport. Wznów za pomocą /10x-impl-review <report-path>."
  - label: "Tylko zapisz raport"
    description: "Zapisz i zakończ — sam zajmę się ustaleniami."
multiSelect: false
```

### Zapisywanie raportu

Zapisz do `context/changes/<change-id>/reviews/impl-review.md` (lub `context/changes/<change-id>/reviews/impl-review-phase-N.md` dla przeglądu ograniczonego do fazy). Zaktualizuj `change.md`: ustaw `status: impl_reviewed` i `updated: <dzisiaj>`. Jeśli użytkownik zdecyduje się na sortowanie, umieść wszelkie dalsze działania "napraw w planie/kodzie" w `context/changes/<change-id>/follow-ups/review-fixes.md`.

```markdown
<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: [Tytuł planu]

- **Plan**: [ścieżka pliku planu]
- **Zakres**: Faza [N] z [Całkowita]
- **Data**: RRRR-MM-DD
- **Werdykt**: [ZAAKCEPTOWANY/WYMAGA UWAGI/ODRZUCONY]
- **Ustalenia**: [N krytycznych] [N ostrzeżeń] [N obserwacji]

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS/WARNING/FAIL |
| Dyscyplina zakresu | PASS/WARNING/FAIL |
| Bezpieczeństwo i jakość | PASS/WARNING/FAIL |
| Architektura | PASS/WARNING/FAIL |
| Spójność wzorców | PASS/WARNING/FAIL |
| Kryteria sukcesu | PASS/WARNING/FAIL |

## Ustalenia

### F1 — Wstrzyknięcie SQL w obsłudze autoryzacji

- **Ważność**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/auth/handler.ts:42
- **Szczegóły**: Zapytanie SQL zbudowane z konkatenacji ciągów. Plan określał zapytania parametryzowane.
- **Poprawka**: Zastąp literał szablonowy zapytaniem parametryzowanym używając db.query($1, [value]).
  - Siła: Pasuje do wzorca w src/users/query.ts; usuwa klasę wstrzyknięcia.
  - Kompromis: Drobny — jedno miejsce wywołania, zmiana kilku linii.
  - Pewność: WYSOKA — identyczny wzorzec używany gdzie indziej.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: OCZEKUJĄCA

### F2 — Nieplanowany endpoint /api/status

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔬 WYSOKI — stawka architektoniczna; pomyśl dokładnie przed podjęciem decyzji
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/api/routes.ts:18
- **Szczegóły**: Nowy endpoint GET /api/status nie znajduje się w planie.
- **Poprawka A ⭐ Zalecana**: Udokumentuj w planie jako aneks
  - Siła: Zachowuje pracę; aktualizuje źródło prawdy.
  - Kompromis: Plan staje się nieco ruchomym celem.
  - Pewność: WYSOKA — wzorzec aneksu regularnie używany tutaj.
  - Martwy punkt: Zainteresowane strony pierwotnego zakresu nie są powiadamiane.
- **Poprawka B**: Usuń i dodaj do prac uzupełniających
  - Siła: Utrzymuje ścisłą dyscyplinę zakresu.
  - Kompromis: Traci zaimplementowaną pracę; kolejny PR później.
  - Pewność: ŚREDNIA — zależy od wywołań.
  - Martwy punkt: Nie sprawdzono wywołań.
- **Decyzja**: OCZEKUJĄCA

### F3 — camelCase vs. snake_case

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/utils/format.ts
- **Szczegóły**: Używa camelCase, podczas gdy istniejące narzędzia używają snake_case.
- **Poprawka**: Zmień nazwy eksportów na snake_case, aby pasowały do src/utils/.
- **Decyzja**: OCZEKUJĄCA
```

Znacznik `<!-- IMPL-REVIEW-REPORT -->` i pola `Decision: PENDING` umożliwiają tryb wznowienia.

"Zapisz i posortuj później" → zapisz, wydrukuj ścieżkę, przypomnij o uruchomieniu `/10x-impl-review <saved-report-path>`.
"Sortuj" → przejdź do kroku 5.

## Krok 5: Interaktywne sortowanie

TaskUpdate: activeForm "Triage"

### Tryb wznowienia

Jeśli wejście nastąpiło przez zapisany plik: przeczytaj go, przeanalizuj nagłówki `### F`, filtruj do `Decision: PENDING`. Jeśli brak: "Wszystkie ustalenia posortowane." Gotowe.

### Pętla sortowania

Przejdź przez ustalenia w kolejności ważności (CRITICAL → WARNING → OBSERVATION). Dla każdego:

**Z 2 opcjami naprawy:**
```
question: "F[N] — [tytuł]\n\nWażność: [ikona ważności] [WAŻNOŚĆ]\nWpływ: [ikona wpływu] [POZIOM] — [znaczenie]\nWymiar: [wymiar]\nLokalizacja: [lokalizacja]\n\nSzczegóły: [szczegóły]\n\n[Blok poprawki A]\n\n[Blok poprawki B]"
header: "Ustalenie [bieżące] z [całkowita pozostała liczba]"
options:
  - label: "Zastosuj poprawkę A ⭐"
    description: "[Jednowierszowa poprawka A]"
  - label: "Zastosuj poprawkę B"
    description: "[Jednowierszowa poprawka B]"
  - label: "Pomiń"
    description: "Nie warto teraz naprawiać."
  - label: "Zapisz jako lekcję"
    description: "Zapisz jako powtarzającą się regułę projektu za pomocą /10x-lesson."
multiSelect: false
```

**Z 1 opcją naprawy:**
```
question: "F[N] — [tytuł]\n\nWażność: [ikona ważności] [WAŻNOŚĆ]\nWpływ: [ikona wpływu] [POZIOM] — [znaczenie]\nWymiar: [wymiar]\nLokalizacja: [lokalizacja]\n\nSzczegóły: [szczegóły]\n\n[Blok poprawki]"
header: "Ustalenie [bieżące] z [całkowita pozostała liczba]"
options:
  - label: "Napraw teraz"
    description: "[Jednowierszowa poprawka]"
  - label: "Napraw inaczej"
    description: "Inne podejście — porozmawiajmy."
  - label: "Pomiń"
    description: "Nie warto teraz naprawiać."
  - label: "Zapisz jako lekcję"
    description: "Zapisz jako powtarzającą się regułę projektu za pomocą /10x-lesson."
multiSelect: false
```

**Obsługa odpowiedzi:**
- **Zastosuj poprawkę A/B / Napraw teraz**: pokaż dokładną zmianę kodu przed/po. Krótkie potwierdzenie ("Zastosować to?"), a następnie edytuj. Oznacz jako NAPRAWIONE (zapisz, która opcja, np. "Fixed via Fix A").
- **Napraw inaczej**: zapytaj o preferowane podejście, zastosuj, oznacz jako NAPRAWIONE.
- **Zapisz jako lekcję**: wstępnie wypełnij cztery pola wpisu lekcji bezpośrednio z ustalenia — `Context` z lokalizacji ustalenia, `Problem` ze szczegółów ustalenia, `Rule` i `Applies to` pozostaw jako puste miejsca do wypełnienia przez użytkownika. Pokaż proponowany wpis jako kompletny blok markdown i poproś użytkownika o edycję / potwierdzenie za pomocą AskUserQuestion ("Zatwierdzić ten wpis?" / "Edytuj przed zapisaniem" / "Anuluj"). Po potwierdzeniu, dołącz wpis jako nową sekcję H2 do `context/foundation/lessons.md` — jeśli plik nie istnieje, utwórz go najpierw z tym kanonicznym 5-wierszowym nagłówkiem (brak oddzielnego pliku szablonu; nagłówek jest osadzony tutaj):

  ```
  # Wyciągnięte wnioski

  > Rejestr powtarzających się reguł i wzorców, tylko do dodawania. Ponownie odczytywany na początku przez /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

  ```

  Przepływ wstępnego wypełniania, a następnie potwierdzania jest kluczowym szczegółem UX; użytkownik musi zobaczyć pełny proponowany wpis z wstępnie wypełnionym Context/Problem i mieć możliwość edycji Rule i Applies-to przed dodaniem. Po pomyślnym dodaniu, **zawsze** zadaj pytanie uzupełniające za pomocą AskUserQuestion: "Lekcja zapisana. Czy zastosować również poprawkę do bieżącego kodu?" z opcjami "Tak — napraw teraz" / "Nie — tylko lekcja". **Nigdy nie pomijaj tego pytania ani nie decyduj w imieniu użytkownika** — czy poprawka jest trywialna, poza zakresem, czy obejmuje wiele plików, decyzja należy do użytkownika. Jeśli tak: pokaż zmianę kodu przed/po, zastosuj, oznacz `FIXED + ACCEPTED-AS-RULE: <tytuł reguły>`. Jeśli nie: oznacz `ACCEPTED-AS-RULE: <tytuł reguły>` (ustalenie pozostaje nienaprawione, reguła jest zapisana do przyszłej pracy).
- **Pomiń** → POMINIĘTE. Idź dalej, nie kłóć się.
- **Inne (dowolny tekst)**: zinterpretuj intencję użytkownika. Typowe intencje: "napraw inaczej" (zwłaszcza w kontekście podwójnej poprawki) → zapytaj o preferowane podejście, zastosuj, oznacz jako NAPRAWIONE; "zaakceptuj ryzyko" → oznacz jako ZAAKCEPTOWANE z uzasadnieniem użytkownika; "odrzuć"/"nie zgadzam się" → oznacz jako ODRZUCONE.

Po każdej decyzji, jeśli pracujesz z zapisanego pliku, zaktualizuj jego pole `Decision:`.

### Podsumowanie

```
═══════════════════════════════════════════════════════════
  SORTOWANIE ZAKOŃCZONE
═══════════════════════════════════════════════════════════

  Naprawiono:     F1, F2 (Poprawka A)   (2)
  Reguła:      F3 (+ naprawiono)     (1)
  Pominięto:   F4               (1)
  Zaakceptowano:  F5               (1)

═══════════════════════════════════════════════════════════
```

Jeśli istnieje zapisany raport, zaktualizuj go o ostateczne decyzje. Oznacz zadanie przeglądu jako ukończone.

## Uwagi

- To jest umiejętność **przeglądu**. Domyślnie analizuj i raportuj — edytuj tylko podczas sortowania, gdy użytkownik wyraźnie wybierze "Zastosuj poprawkę" lub "Napraw inaczej" dla konkretnego ustalenia.
- Bądź konkretny. "src/auth/handler.ts:42 — Zapytanie SQL zbudowane z konkatenacji ciągów, podatne na wstrzyknięcie" — a nie "może być gdzieś problem z bezpieczeństwem".
- Nie oznaczaj preferencji stylistycznych, chyba że mają znaczenie. Jeśli kod działa i jest zgodny z planem, drobne różnice stylistyczne od istniejącego kodu są obserwacjami, a nie ostrzeżeniami.
- Jeśli sam plan był wadliwy (np. zaplanowano niebezpieczne podejście), oznacz to — ten przegląd wychwytuje również problemy z planem.
- Wpływ dotyczy **wysiłku decyzyjnego**, a nie **ważności**. NISKI wpływ na KRYTYCZNE ustalenie oznacza, że poprawka jest oczywista; WYSOKI wpływ na OSTRZEŻENIE oznacza, że kompromis jest realny.
- Dwie opcje naprawy tylko wtedy, gdy istnieje prawdziwy kompromis. Nie wymyślaj alternatyw dla trywialnych poprawek.
- Podczas przeglądania pojedynczej fazy, nadal sprawdzaj, czy zmiany z tej fazy nie naruszyły założeń poprzednich faz. Fazy mogą ze sobą współdziałać.
- Podczas sortowania, utrzymuj tempo. Użytkownik już przeczytał raport.
- Podczas naprawiania, minimalne, ukierunkowane edycje. Nie refaktoryzuj otaczającego kodu ani nie "ulepszaj" rzeczy, które nie zostały oznaczone.