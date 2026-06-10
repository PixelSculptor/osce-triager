---
name: 10x-tdd
description: Drive an approved plan from context/changes/<change-id>/plan.md phase by phase, test-first, through red→green→refactor — only for TDD'able phases not yet implemented; everything else routes to /10x-implement. Use when the user says "tdd", "test-first", "red green refactor", or wants to execute a plan via TDD.
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

# 10x TDD — Wykonanie planu w pierwszej kolejności testów

Realizujesz zatwierdzony plan techniczny z `context/changes/<change-id>/plan.md` **faza po fazie, zaczynając od testów**. Ta umiejętność ma zastosowanie tylko wtedy, gdy implementacja produkcyjna danej fazy jest jeszcze nieobecna. Dla każdej kwalifikującej się fazy uruchamiasz klasyczną pętlę:

```
CZERWONY    →  napisz test, który zawiedzie, wskazując następne zachowanie
ZIELONY     →  napisz minimalny kod produkcyjny, aby test przeszedł
REFAKTORYZACJA →  posprzątaj, utrzymując test w stanie zielonym
```

Ta umiejętność jest **test-first odpowiednikiem `/10x-implement`**. Odczytuje ten sam plan, modyfikuje tę samą kanoniczną sekcję `## Progress` i używa tego samego rytuału commitowania na koniec fazy oraz przekazywania do schowka. Jedyną różnicą jest kolejność: tutaj test, który zawodzi, jest pisany **przed** kodem produkcyjnym. Ponieważ ta kolejność jest kluczowa, nie używaj tej umiejętności do dodawania testów po tym, jak implementacja już istnieje. Ponieważ obie umiejętności współdzielą `## Progress`, możesz je swobodnie przeplatać — TDD jednej fazy tutaj, przekazanie następnej fazy do `/10x-implement`, powrót, a stan nigdy nie zostanie utracony.

Ścieżka planu: `$ARGUMENTS`

## Co zakłada ta umiejętność — i czego nie zrobi

- **Infrastruktura testowa już istnieje.** Zakłada się, że istnieje runner (Vitest / Playwright / Jest / pytest / …), sposób uruchamiania pojedynczego pliku oraz konwencje testowe projektu. Ta umiejętność je **odkrywa**; **nie** instaluje runnera, nie tworzy konfiguracji, nie tworzy fixture'ów ani nie podłącza CI. Jeśli runner w ogóle nie istnieje, zatrzymaj się i powiedz użytkownikowi, aby najpierw go skonfigurował (wskaż mu `/10x-test-plan` dla fazowego wdrożenia testów lub `/10x-bootstrapper` dla tworzenia szkieletu).
- **Implementacja produkcyjna jeszcze nie istnieje.** TDD działa tylko wtedy, gdy test, który zawodzi, może prowadzić implementację. Jeśli odpowiednie zachowanie, endpoint, komponent, migracja, okablowanie lub inna zmiana produkcyjna dla danej fazy już istnieje, zatrzymaj się natychmiast; nie pisz testów retrospektywnych i nie kontynuuj fazy pod etykietą TDD. Powiedz użytkownikowi, aby użył `/10x-implement <change-id> phase N`, aby kontynuować już rozpoczętą fazę.
- **Prowadzi implementację, a nie tylko szkielet testowy.** W przeciwieństwie do starego przepływu "napisz wszystkie testy z góry", ta umiejętność pisze mały test, który zawodzi, a następnie natychmiast sprawia, że przechodzi, faza po fazie. Nie ma oddzielnej partii osieroconych testów, które zawiodły.
- **Każda faza jest sprawdzana pod kątem tego, czy test-first faktycznie pasuje i czy implementacja jest nieobecna.** Niektóre fazy (konfiguracja, tworzenie szkieletu, wizualne dopracowanie, okablowanie infrastruktury) nie mogą być sensownie prowadzone przez test, który zawodzi. Już rozpoczęta implementacja również nie może zostać przywrócona do prawdziwego TDD. Te przypadki są przekierowywane lub zatrzymywane, jak opisano poniżej.

## Przegląd faz

```
SETUP            →  Rozwiąż plan, przeczytaj w całości, potwierdź istnienie infrastruktury testowej, utwórz zadania dla każdej fazy
Dla każdej fazy:
  ├─ BRAMKA       →  Czy ta faza jest TDD'owalna i czy implementacja jest nieobecna? Jeśli nie → przekieruj lub zatrzymaj
  ├─ CZERWONY/ZIELONY/REFAKTORYZACJA  →  Pętla dla każdego zachowania w fazie, aż do spełnienia kryteriów sukcesu
  └─ KONIEC FAZY  →  Cały pakiet zielony → bramka ręczna → rytuał commitowania → decyzja o następnej fazie (schowek)
Po wszystkich fazach →  Podsumowanie ukończenia + opcjonalny /10x-impl-review
```

Każda faza kończy się punktem kontrolnym użytkownika. Nigdy nie pomijaj fazy po cichu ani nie łącz dwóch faz w jeden commit.

---

## Konfiguracja

Gdy ta umiejętność zostanie wywołana:

1. **Rozwiąż plan**:
   - `/10x-tdd <change-id> [phase N]` → `context/changes/<change-id>/plan.md`.
   - `@context/changes/<change-id>/plan.md` lub pełna ścieżka → zaakceptuj bez zmian.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wydrukuj "This change is archived. Open a new change with `/10x-new` instead." i ZATRZYMAJ.
   - Jeśli nic nie zostało podane, wydrukuj poniższą wiadomość i **ZATRZYMAJ i czekaj**:

```
Będę realizować zatwierdzony plan test-first (czerwony → zielony → refaktoryzacja), faza po fazie. Proszę podać:

1. Identyfikator zmiany (np. `/10x-tdd oauth-login phase 1`), lub
2. Pełną ścieżkę (np. `@context/changes/oauth-login/plan.md`).

Możesz wyświetlić aktywne zmiany za pomocą: `ls context/changes/`

Wskazówka: plan powinien być już przejrzany i zatwierdzony — ta umiejętność go implementuje, a nie pisze.
```

2. **Przeczytaj plan w całości** — każdą fazę, każdy blok Changes Required, każdy element Success Criteria. Nigdy nie używaj limit/offset; potrzebujesz pełnego kontekstu. Sekcja `## Progress` na dole jest **autorytatywna dla stanu wykonania** — znaczniki (`- [x]`) znajdują się TYLKO tam (patrz `references/progress-format.md`). Bloki faz zawierają zwykłe punktorzy `- `, bez pól wyboru.

3. **Przeczytaj `context/foundation/lessons.md`** jeśli istnieje i przyswój każdy wpis przed rozpoczęciem jakiejkolwiek fazy — są to zaakceptowane powtarzające się zasady zespołu i muszą kształtować każdy wybór implementacyjny w tym przebiegu.

4. **Potwierdź istnienie infrastruktury testowej (lekkie sprawdzenie — nie badaj całego świata):**
   - Jeśli `context/foundation/test-stack.md` istnieje, przeczytaj go — zawiera on informacje o runnerze, środowisku, konwencjach i poleceniach uruchamiania. Użyj go i pomiń skanowanie. Jeśli wygląda na nieaktualny (odwołuje się do narzędzi/konfiguracji, które już nie istnieją), zanotuj to dla użytkownika i wróć do szybkiego skanowania.
   - W przeciwnym razie wykonaj **szybkie** skanowanie konwencji (to nie jest faza intensywnych badań infrastruktury): znajdź konfigurację testową i 1-2 reprezentatywne istniejące pliki testowe, aby poznać styl importu, zagnieżdżanie describe/it, wzorce mockowania i polecenie do uruchamiania **pojedynczego** pliku testowego. Wystarczy pojedynczy `Glob` dla `*.test.*` / `*.spec.*` plus przeczytanie jednego przykładu.
   - **Jeśli nie ma runnera i w ogóle żadnej konfiguracji testowej**, ZATRZYMAJ:

```
Ten plan wymaga runnera testowego, zanim będę mógł go realizować test-first — nie znalazłem żadnego
(brak konfiguracji vitest/jest/playwright/pytest, brak skryptów testowych, brak istniejących plików *.test.*).

Ta umiejętność zakłada, że infrastruktura testowa już istnieje; nie będzie jej konfigurować. Opcje:
  • Najpierw skonfiguruj runnera, a następnie ponownie uruchom /10x-tdd.
  • Użyj /10x-implement, aby zbudować plan bez test-first.
  • Użyj /10x-test-plan dla fazowej strategii wdrożenia testów.
```

5. **Zaktualizuj `change.md`**: ustaw `status: implementing` (tylko jeśli aktualnie w `{planned, plan_reviewed}`) i `updated: <today>`.

6. **Utwórz jedno zadanie na fazę** (pojawiają się one na pasku stanu użytkownika): dla każdego nagłówka `## Phase N:`, `TaskCreate` z `subject: "Phase N: [Phase Name]"` i `activeForm: "TDD Phase N"`. Oznacz bieżącą fazę jako `in_progress` przed rozpoczęciem; oznacz ją jako `completed`, gdy jej kryteria sukcesu zostaną spełnione.

7. **Znajdź punkt początkowy**: przeskanuj `## Progress` — pierwszy `- [ ]` w kolejności dokumentu to miejsce, od którego zaczynasz. Jeśli podano argument `phase N`, przejdź do pierwszego `- [ ]` pod `### Phase N:`.

> **Konwencja schowka.** Wszędzie tam, gdzie ta umiejętność mówi *skopiuj `X` do schowka*, przekaż dokładny ciąg `X` do schowka platformy — spróbuj `pbcopy` (macOS), następnie `clip.exe` (Windows/WSL), następnie `xclip -selection clipboard` (Linux), i wróć do poprzedniego stanu po cichu, jeśli żadne nie istnieją. Następnie wyświetl skopiowane polecenie w osobnym wierszu z sufiksem `(✓ copied)`.

---

## Bramka kwalifikacji TDD — uruchamiana przed każdą fazą

Zanim napiszesz choć jeden test dla fazy, zdecyduj o dwóch rzeczach w tej kolejności:

1. **Brak implementacji** — implementacja produkcyjna fazy nie jest jeszcze obecna.
2. **Zdolność do TDD** — faza może być sensownie prowadzona przez test, który zawodzi.

Faza kwalifikuje się do tej umiejętności tylko wtedy, gdy oba warunki są prawdziwe.

### Zatrzymanie z powodu istniejącej implementacji

Najpierw sprawdź `Changes Required`, `Success Criteria` i oczekujące wiersze `## Progress` fazy, a następnie wykonaj ukierunkowane wyszukiwanie kodu dla plików, symboli, endpointów, migracji, poleceń, interfejsów użytkownika lub wpisów konfiguracyjnych, które faza ma dodać lub zmienić. Jest to szybkie sprawdzenie rzeczywistości, a nie szerokie badanie.

Jeśli podstawowa implementacja dla fazy jest już obecna lub częściowo obecna, ZATRZYMAJ się natychmiast. Nie dodawaj testów po fakcie, nie refaktoryzuj istniejącego kodu, nie oznaczaj wierszy Progress i nie oferuj kontynuowania w linii. TDD nie działa dla już istniejącego kodu, ponieważ test, który zawodzi, nie prowadzi już implementacji.

Wydrukuj ten blok, uzupełniając konkretne dowody:

```
Faza [N] ma już implementację, więc nie mogę jej prowadzić za pomocą TDD.

TDD nie działa dla już istniejącego kodu; test, który zawodzi, musi pojawić się przed kodem produkcyjnym. Tutaj znalazłem istniejącą implementację:
- [dowód pliku/symbolu/endpointu/itp.]

Użyj /10x-implement, aby kontynuować tę fazę:
→ /10x-implement <change-id> phase [N]
```

Skopiuj `/10x-implement <change-id> phase [N]` do schowka zgodnie z konwencją schowka, wyświetl go z `(✓ copied)` po pomyślnym wykonaniu i ZATRZYMAJ. `/10x-implement` może kontynuować fazę z istniejącego kodu i stanu planu.

Jeśli implementacja jest nieobecna, przejdź do sprawdzenia zdolności do TDD.

### Sprawdzenie zdolności do TDD

Po potwierdzeniu braku implementacji, zdecyduj, czy faza może być **sensownie prowadzona przez test, który zawodzi**. Faza jest TDD'owalna, gdy istnieje **obserwowalny wynik, który można potwierdzić, zanim kod będzie istniał**.

| TDD'owalne — prowadź tutaj | Nie TDD'owalne — przekieruj do `/10x-implement` |
|---|---|
| Czyste funkcje, transformacje danych, parsery, walidatory | Czyste tworzenie szkieletu: tworzenie katalogów, plików konfiguracyjnych, edycje `package.json`/manifestu |
| Maszyny stanów / reduktory / obliczanie flag | Okablowanie i infrastruktura: pliki CI, Dockerfile, konfiguracja środowiska, konfiguracja wdrożenia |
| Kontrakty żądań API → odpowiedzi (status, kształt, autoryzacja, bramkowanie) | Wizualne / stylistyczne dopracowanie bez zautomatyzowanej ścieżki asercji w stosie |
| Logika biznesowa z jasnymi wejściami/wyjściami | Eksploracyjne spiki, gdzie kontrakt nie jest jeszcze znany |
| Przepływy integracji przez granice, które można mockować (DB/KV/HTTP) | Dokumentacja, komentarze, edycje tylko treści |
| Naprawy błędów (najpierw napisz test, który zawodzi) | Cienki klej, gdzie test tylko powtórzyłby implementację (tautologiczny) |

**Jak zastosować sprawdzenie zdolności do TDD:**

- Jeśli implementacja jest nieobecna, a faza jest **wyraźnie TDD'owalna**, stwierdź to w jednym wierszu i przejdź do pętli red-green-refactor.
- Jeśli faza jest **wyraźnie nie TDD'owalna**, uruchom **przekierowanie** (poniżej).
- Jeśli jest **mieszana lub niejednoznaczna** (np. faza, która tworzy szkielet konfiguracji *i* dodaje walidator z prawdziwą logiką), użyj `AskUserQuestion`:

  - question: "Faza [N] to częściowo tworzenie szkieletu, częściowo logika. Jak mam ją prowadzić?"
    header: "Bramka TDD"
    options:
    - label: "TDD testowalną część (Zalecane)"
      description: "Będę red-green-refactor [logiki] i implementować szkielet w linii jako zwykłe kroki."
    - label: "Przekieruj całą fazę do /10x-implement"
      description: "Przekaż całą fazę — skopiuj polecenie wznowienia do schowka."
    - label: "I tak TDD całą fazę"
      description: "Wymuś test-first nawet dla cienkich części. Może generować testy o niskiej wartości."
    multiSelect: false

### Przekieruj fazę nie TDD'owalną do `/10x-implement`

Podaj *dlaczego* faza nie pasuje (jedno lub dwa zdania, oparte na powyższej tabeli), a następnie użyj `AskUserQuestion`:

- question: "Faza [N] nie jest dobrym kandydatem do test-first. Jak chcesz to rozwiązać?"
  header: "Nie TDD'owalne"
  options:
  - label: "Przekaż do /10x-implement (Zalecane)"
    description: "Skopiuj `/10x-implement <change-id> phase N` do schowka. Wyczyść kontekst, uruchom, a następnie wznów TDD na następnej fazie."
  - label: "Implementuj w linii tutaj (bez test-first)"
    description: "Zbuduję tę fazę bezpośrednio z planu i uruchomię jej kryteria sukcesu — a następnie przejdę do bramki następnej fazy."
  - label: "Pomiń — już zrobione"
    description: "Oznacz wiersze Progress fazy i przejdź do następnej fazy."
  multiSelect: false

**W przypadku "Przekaż":** skopiuj `/10x-implement <change-id> phase [N]` do schowka (zgodnie z konwencją schowka), wydrukuj poniższy blok i ZATRZYMAJ — `/10x-implement` odwróci wiersze Progress tej fazy i uruchomi własny rytuał commitowania. Powiedz użytkownikowi, aby wznowił TDD później.

```
Faza [N] nie jest materiałem do test-first — [jednolinijkowy powód].

→ /10x-implement <change-id> phase [N] (✓ skopiowano)

Wyczyść kontekst (`/clear`), uruchom to, a następnie wróć z:
→ /10x-tdd <change-id> phase [N+1]
```

**W przypadku "Implementuj w linii":** zbuduj fazę bezpośrednio z planu (zgodnie z `lessons.md` i istniejącymi konwencjami), uruchom jej zautomatyzowane kryteria sukcesu, a następnie przejdź do rytuału zakończenia fazy — ale pomiń ramkę CZERWONY/ZIELONY w komunikacie commitu (użyj zwykłego tematu `feat`/`chore`/`refactor`). Następnie przejdź do bramki następnej fazy.

**W przypadku "Pomiń":** odwróć wiersze Progress fazy `[ ]` → `[x]` (bez SHA, ponieważ nic nie zostało zatwierdzone) i przejdź do następnej fazy.

---

## Cykl Red-Green-Refactor

Wewnątrz fazy TDD'owalnej pracuj zachowanie po zachowaniu. Każdy krok `#### Automated` w Progress fazy (lub każde odrębne zachowanie w Changes Required) to jedno przejście przez pętlę. Utrzymuj pętlę ciasną — mały test, mały kod, uruchamiaj często.

### Budżet testowy na fazę

Napisz **ukierunkowany** zestaw, a nie wyczerpujące pokrycie — zazwyczaj **2-5 testów na fazę**. Wybierz zachowania, które dowodzą, że faza działa i wychwyciłyby rzeczywiste regresje. Ustanawiasz wzorzec; deweloper rozszerza go później. Nie pisz testu na każdy getter lub stałą.

### CZERWONY — najpierw napisz test, który zawodzi

1. Napisz **jeden** test (lub ścisłą grupę) dla następnego zachowania, zgodnie z konwencjami odkrytymi w Setup — styl importu, zagnieżdżanie describe/it, istniejące pomocniki mockowania. Nie wymyślaj nowych wzorców.
2. Nazwij go dla **wyniku**, a nie mechanizmu. Dobrze: `"zwraca 429, gdy token przekracza 20 zgłoszeń na godzinę"`. Źle: `"wywołuje rateLimiter.check()"`.
3. Testuj **wyniki, a nie wewnętrzne elementy** — sprawdzaj wartości zwracane, renderowany wynik, odpowiedzi HTTP lub kształt stanu, nigdy wywołania prywatnych metod ani kolejność wykonania.
4. **Uruchom tylko ten plik testowy** z wywołaniem pojedynczego pliku projektu odkrytym w Setup (np. forma `run <path>` runnera, wyjście przycięte do końca) i potwierdź, że **zawodzi z właściwego powodu** — błąd asercji lub "moduł nie znaleziony / nie zaimplementowany" dla kodu, który masz zamiar napisać, **a nie** błąd składniowy lub uszkodzony import w samym teście. Krótko pokaż użytkownikowi czerwony wynik.

Nigdy nie używaj `it.skip()` / `xit()` do "przejścia" fazy — pominięty test jest niewidoczny. Czerwony jest celem.

### ZIELONY — minimalny kod do przejścia

5. Napisz **najmniejszy** kod produkcyjny, który sprawi, że test, który zawodzi, przejdzie. Oprzyj się budowaniu przed testem — przyszłe zachowania mają swój własny krok CZERWONY.
6. Ponownie uruchom test. Potwierdź **zielony**. Jeśli inne testy zawiodły, zmieniłeś zachowanie — napraw kod (nie testy), aż pakiet będzie ponownie zielony.

### REFAKTORYZACJA — posprzątaj, pozostań zielony

7. Gdy test jest zielony, popraw nazwy, usuń duplikaty, uściślij typy — **bez zmiany zachowania**. Ponownie uruchom po każdej znaczącej zmianie; test musi pozostać zielony. Pomiń ten krok, gdy nie ma nic do posprzątania.

8. **Oznacz krok jako wykonany.** Odwróć dokładnie ten wiersz w `## Progress`: `- [ ] N.M <title>` → `- [x] N.M <title>` (bez SHA jeszcze — SHA ląduje na końcu fazy). Następnie wróć do CZERWONEGO dla następnego zachowania.

Powtarzaj CZERWONY→ZIELONY→REFAKTORYZACJA, aż każdy krok `#### Automated` w fazie będzie `[x]` i kryteria sukcesu fazy zostaną spełnione.

---

## Zakończenie fazy

Gdy wszystkie wiersze `#### Automated` w `### Phase N:` są `[x]`, uruchom rytuał zakończenia fazy (odzwierciedla to `/10x-implement` — jeden commit Conventional-Commits na fazę, a następnie zapisz jego krótki SHA z powrotem do wierszy, które się zmieniły).

> **Twardy niezmiennik — commituj tylko na zielono.** Nigdy nie proponuj, nie przygotowuj ani nie twórz commita, gdy jakikolwiek test w zakresie jest CZERWONY, pominięty w celu udawania przejścia lub w inny sposób uszkodzony. Commit jest oferowany **tylko po tym, jak stan ZIELONY (lub REFAKTORYZACJA) zostanie utrzymany, a cały pakiet przejdzie**. Krok CZERWONY to przejściowy punkt kontrolny, który pokazujesz użytkownikowi, nigdy granica commita. Jeśli pakiet jest czerwony na końcu fazy, napraw kod, aż będzie zielony — nie przechodź do kroku 1 rytuału z testami, które zawiodły.

Utrzymuj **zestaw zmodyfikowanych plików** przez całą fazę: każdy plik, który `Edit`/`Write` (testy *i* kod produkcyjny) trafia do niego, plus `context/changes/<change-id>/plan.md` (zawsze — edytujesz jego Progress). W **pierwszej fazie** zmiany, również zasil go wszystkimi nieśledzonymi/zmodyfikowanymi plikami w `context/changes/<change-id>/` (`change.md`, `research.md`, itp.). Zestaw **resetuje się na każdej granicy fazy**.

1. **Uruchom cały pakiet** (nie tylko pojedyncze pliki) i potwierdź zielony. Napraw wszelkie uszkodzenia międzyfazowe przed commitowaniem.

2. **Bramka ręcznego potwierdzenia.** Powiedz człowiekowi, że automatyczna weryfikacja przeszła, wymień elementy ręcznej weryfikacji planu dla tej fazy i wstrzymaj. Nie kontynuuj, dopóki nie potwierdzą.

```
Faza [N] zakończona (test-first) — Gotowa do ręcznej weryfikacji

Automatyczna weryfikacja przeszła:
- [testy teraz zielone: wymień kluczowe]
- [inne zautomatyzowane sprawdzenia: lint, typy, pełny pakiet]

Proszę wykonać kroki ręcznej weryfikacji z planu:
- [ręczne elementy dla tej fazy]

Daj mi znać, kiedy testowanie ręczne zostanie zakończone, abym mógł zatwierdzić.
```

   W **ostatniej fazie** również zsumuj wszystkie nadal oczekujące wiersze `#### Manual` z wcześniejszych faz (informacyjnie; bramka nadal tylko wstrzymuje, nie blokuje na stałe).

3. **Wykryj niezwiązane brudne ścieżki.** Uruchom `git status --porcelain`; przetnij z ścieżkami **poza** zestawem zmodyfikowanych. Jeśli takie istnieją, przedstaw je i zapytaj za pomocą `AskUserQuestion`, czy zatwierdzić tylko zaplanowany zestaw (Zalecane), przygotować wszystkie, czy przerwać. Jeśli żadne, pomiń.

4. **Przygotuj jawnie według ścieżki** — `git add` każdy plik w zestawie zmodyfikowanych według nazwy. Nigdy `git add -A` / `git add .`.

5. **Sprawdzenie pustego diffa.** `git diff --cached --quiet`; jeśli wyjście 0, wydrukuj, że faza nie miała diffa (wiersze pozostają bez SHA), ustaw `SHA=""` i przejdź do kroku 8.

6. **Zaproponuj wiadomość Conventional-Commits** i zatwierdź ją za pomocą `AskUserQuestion` (zatwierdź jako zaproponowaną / edytuj temat / nadpisz). Temat: `<type>(<change-id>): <phase title> (p<N>)`. Dla faz TDD'owanych, preferuj `test`/`feat` i wspomnij o charakterze test-first w treści. Dołącz wiersz `Refs:` jeśli rozmowa zawiera rzeczywiste odniesienia Jira/Linear/GitHub (nigdy nie wymyślaj ich z change-id lub gałęzi).

7. **Zatwierdź** za pomocą pojedynczego `git commit` z treścią heredoc, zgodnie z globalnym protokołem wiadomości commitu: zatwierdzony wiersz tematu, następnie krótka treść wymieniająca dodane testy + zmodyfikowany kod produkcyjny (i wiersz `Refs:` gdy ma zastosowanie), następnie trailer `Co-Authored-By`, którego wymaga protokół. Nigdy nie przekazuj flag `--no-verify` / `--amend` / signing-bypass. Jeśli hook pre-commit zawiedzie, napraw przyczynę i utwórz NOWY commit.

8. **Zapisz i zapisz z powrotem SHA.** `git rev-parse --short HEAD` → `SHA`. Dla każdego wiersza Progress zmienionego w tej fazie, Edytuj `- [x] N.M <title>` → `- [x] N.M <title> — <SHA>` (pomiń wiersze, które już mają SHA; jeśli `SHA=""`, pomiń — `/10x-archive` wyświetla wiersze bez SHA jako ostrzeżenia informacyjne).

9. **Zaktualizuj `change.md`**: `updated: <today>`; utrzymuj `status: implementing` do ostatniej fazy.

10. **Zresetuj zestaw zmodyfikowanych plików** przed następną fazą.

### Decyzja o następnej fazie

Użyj `AskUserQuestion`:

- question: "Faza [N] zakończona (test-first). Jak postępować?"
  header: "Następna faza"
  options:
  - label: "Kontynuuj do Fazy [N+1]"
    description: "Pozostań w tym kontekście; uruchom bramkę TDD-ability dla następnej fazy i kontynuuj."
  - label: "Najpierw wyczyść kontekst"
    description: "Skopiuj polecenie wznowienia do schowka. Zacznij od nowa dla Fazy [N+1]."
  - label: "Najpierw przejrzyj tę fazę"
    description: "Uruchom /10x-impl-review, aby zweryfikować implementację względem planu przed kontynuowaniem."
  multiSelect: false

**Kontynuuj:** przeczytaj następną fazę, ustaw jej zadanie `in_progress`, uruchom bramkę TDD, kontynuuj. Nie ma potrzeby ponownego czytania całego planu.

**Przejrzyj:** uruchom `/10x-impl-review @<path-to-plan> phase [N]`, a następnie ponownie przedstaw decyzję o kontynuowaniu/czyszczeniu (bez opcji przeglądu).

**Wyczyść:** skopiuj `/10x-tdd <change-id> phase [N+1]` do schowka (zgodnie z konwencją schowka) i wyświetl jako `→ /10x-tdd <change-id> phase [N+1] (✓ skopiowano)`.

Jeśli polecono uruchomić wiele faz kolejno, pomiń to pytanie między fazami. Nie zaznaczaj wierszy **ręcznych**, dopóki użytkownik nie potwierdzi.

---

## Śledzenie stanu

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy** — brak pliku stanu, brak znaczników komentarzy (patrz `references/progress-format.md`). Ta umiejętność modyfikuje Progress dokładnie tak samo jak `/10x-implement`: odwróć `[ ]` → `[x]` na każdym kroku, gdy zostanie wykonany; dołącz SHA zamykającego commita do każdego wiersza, który się zmienił, za jednym razem na końcu fazy. W trakcie fazy, ukończone wiersze pozostają `[x]` bez SHA — prawidłowy stan pośredni. Ponieważ obie umiejętności zapisują tę samą sekcję identycznie, zmiana może być prowadzona przez jedną lub obie, w dowolnej kolejności.

**"Gdzie jestem?" jest wywnioskowane, a nie przechowywane:** pierwszy wiersz `- [ ]` to następny krok; jego otaczający `### Phase N:` to bieżąca faza; ukończenie to `count([x]) / count([ ] + [x])`.

---

## Po wszystkich fazach

Gdy każdy `- [ ]` w całej sekcji `## Progress` jest `[x]`:

1. **Defensywne skanowanie pozostałości.** Ponownie przeskanuj w poszukiwaniu pozostałych `- [ ]`. W normalnym przepływie ich nie ma. Jeśli jakieś istnieją (ręczna edycja lub pominięty wyzwalacz je pozostawił), wymień je pogrupowane według Automated/Manual i zapytaj za pomocą `AskUserQuestion`, czy **Wstrzymać** (ZATRZYMAJ, nie dotykaj `change.md`), czy **Kontynuować do epilogu**.

2. **Zaktualizuj `change.md`**: `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — to jest `/10x-archive`.)

3. **Commit epilogu.** Zapis SHA ostatniej fazy i zmiana statusu `change.md` pozostają brudne po ostatnim rytuale. Przygotuj dokładnie `plan.md` + `change.md` (jawne ścieżki), sprawdź `git diff --cached --quiet` (pomiń, jeśli puste), zaproponuj `chore(<change-id>): close out plan (epilogue)`, zatwierdź i commituj za pomocą heredoc. NIE zapisuj z powrotem własnego SHA epilogu.

4. **Podsumowanie ukończenia + opcjonalny przegląd:**

```
Wszystkie fazy zaimplementowane test-first! 🎉

Podsumowanie:
- Ukończone fazy: [N] ([k] TDD'owane, [j] przekierowane do /10x-implement)
- Dodane testy: [liczba] w [plikach]
- Zmienione pliki: [kluczowe pliki]
```

   Następnie `AskUserQuestion`: uruchomić `/10x-impl-review <change-id>` (przegląd całego planu) czy pominąć.

---

## Wytyczne TDD

### Co sprawia, że test jest dobry

- Opisuje **co** system robi, a nie **jak** to robi wewnętrznie.
- Zawodzi z **właściwego powodu** — zachowanie jeszcze nie istnieje, a nie z powodu uszkodzonego testu.
- Jest **stabilny** — przetrwa refaktoryzację, psuje się tylko wtedy, gdy zmienia się zachowanie.
- Jest **minimalny** — najmniejsze zachowanie, które ma znaczenie, najprostsza konfiguracja.

### Czego unikać

- Testowania szczegółów implementacji (prywatny stan, wewnętrzna kolejność wywołań, sekwencjonowanie efektów ubocznych).
- Nadmiernego mockowania — jeśli wszystko jest mockowane, testujesz swoje mocki. Nie mockuj testowanego elementu; mockuj jego współpracowników (KV, DB, HTTP).
- Testów migawkowych dla logiki biznesowej (migawki służą do stabilności renderowania UI).
- Prawie identycznych testów z nieco innymi nazwami; testów dla trywialnego kodu.
- Budowania kodu produkcyjnego przed testem, który zawodzi — każde zachowanie najpierw zasługuje na swój krok CZERWONY.

### Obsługa niejasności planu

Jeśli kryteria akceptacji fazy są niejasne ("działa zgodnie z oczekiwaniami"), nie zgaduj. Sprawdź Desired End State i Changes Required fazy pod kątem konkretnych danych wejściowych/wyjściowych. Jeśli nadal niejasne, zadaj użytkownikowi jedno ukierunkowane pytanie o to, jak wygląda "sukces", zanim napiszesz test CZERWONY.

### Obsługa niezgodności planu z rzeczywistością

Jeśli faza nie może zostać zaimplementowana zgodnie z opisem, ZATRZYMAJ się i przedstaw to jasno:

```
Problem w Fazie [N]:
Oczekiwano: [co mówi plan]
Znaleziono: [rzeczywista sytuacja]
Dlaczego to ma znaczenie: [wyjaśnienie]
```

Następnie `AskUserQuestion` — Dostosuj i kontynuuj / Pomiń tę część / Zatrzymaj i ponownie zaplanuj.

### Umiejscowienie plików

Postępuj zgodnie z konwencją odkrytą w Setup. Domyślne, jeśli żadna nie istnieje:

- **Testy jednostkowe** — obok pliku źródłowego (`src/[module]/thing.test.ts`).
- **Testy integracyjne / API** — w `tests/` (`tests/[feature]/thing.test.ts`).
- **Testy E2E** — katalog e2e na poziomie projektu (`tests/e2e/[feature].spec.ts`).

### Jeśli utkniesz

Używaj podzadań oszczędnie — `Explore` do szybkiego wyszukiwania plików/wzorców, `general-purpose` do wieloetapowej analizy nieznanego terenu. Najpierw upewnij się, że przeczytałeś odpowiedni kod; rozważ, że baza kodu mogła ewoluować od czasu napisania planu.