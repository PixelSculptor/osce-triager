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

Twoim zadaniem jest zaimplementowanie zatwierdzonego planu technicznego z `context/changes/<change-id>/plan.md`. Plany te zawierają fazy z konkretnymi zmianami oraz kanoniczną sekcję `## Progress` na dole, która steruje stanem wykonania (patrz `references/progress-format.md`).

## Konfiguracja początkowa

Po wywołaniu tej komendy:

1. **Rozwiąż plan**:
   - Jeśli wywołano jako `/10x-implement <change-id> [phase N]`, rozwiąż do `context/changes/<change-id>/plan.md`.
   - Jeśli wywołano z `@context/changes/<change-id>/plan.md` lub pełną ścieżką, zaakceptuj.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wydrukuj "Ta zmiana jest zarchiwizowana. Zamiast tego otwórz nową zmianę za pomocą `/10x-new`." i ZATRZYMAJ.
   - Jeśli nic nie zostało podane, odpowiedz poniższą wiadomością i **ZATRZYMAJ i czekaj**:

```
Pomogę Ci zaimplementować zatwierdzony plan techniczny. Podaj:

1. Identyfikator zmiany (np. `/10x-implement oauth-login phase 1`), lub
2. Pełną ścieżkę (np. `@context/changes/oauth-login/plan.md`).

Aktywne zmiany możesz wyświetlić za pomocą: `ls context/changes/`

Wskazówka: Upewnij się, że plan został przejrzany i zatwierdzony przed implementacją.
```

## Rozpoczęcie pracy

Po podaniu ścieżki do planu:

- Przeczytaj cały plan. Sekcja `## Progress` na dole jest autorytatywna dla stanu wykonania — znaczniki wyboru (`- [x]`) znajdują się TYLKO tam. Bloki faz zawierają zwykłe punktorzy `- ` (bez pól wyboru).
- Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i przyswój każdy wpis przed rozpoczęciem jakiejkolwiek fazy — są to zaakceptowane, powtarzające się zasady zespołu i muszą kształtować każdy wybór implementacyjny, którego dokonasz w tym przebiegu.
- Przeczytaj wszystkie pliki wymienione w planie (odwołania do badań, ram, plików źródłowych w tym samym folderze zmiany).
- **Czytaj pliki w całości** - nigdy nie używaj parametrów limit/offset, potrzebujesz pełnego kontekstu.
- Zastanów się głęboko, jak poszczególne elementy pasują do siebie.
- **Zaktualizuj `change.md`**: przy wejściu ustaw `status: implementing` (tylko jeśli aktualnie w `{planned, plan_reviewed}`) i `updated: <today>`.
- Policz całkowitą liczbę faz (z nagłówków `## Phase N:`) i utwórz jeden wpis TaskCreate dla każdej fazy (pojawiają się one na pasku stanu użytkownika):
  - Dla każdej fazy utwórz zadanie z `subject: "Phase N: [Nazwa Fazy]"` i `activeForm: "Implementing Phase N"`.
  - Ustaw bieżącą fazę na `in_progress` za pomocą TaskUpdate przed rozpoczęciem pracy.
  - Oznacz każdą fazę jako `completed` za pomocą TaskUpdate, gdy jej kryteria sukcesu zostaną spełnione.
- **Znajdź następny oczekujący krok**, skanując sekcję `## Progress`: pierwsza linia `- [ ]` w kolejności dokumentu to miejsce, od którego zaczynasz. Jeśli podano argument `phase N`, przejdź do pierwszej linii `- [ ]` wewnątrz `### Phase N:`.
- Rozpocznij implementację, jeśli rozumiesz, co należy zrobić.

## Filozofia implementacji

Plany są starannie projektowane, ale rzeczywistość może być skomplikowana. Twoim zadaniem jest:

- Postępować zgodnie z zamierzeniami planu, jednocześnie dostosowując się do tego, co znajdziesz.
- W pełni zaimplementować każdą fazę przed przejściem do następnej.
- Zweryfikować, czy Twoja praca ma sens w szerszym kontekście bazy kodu.
- Aktualizować pola wyboru w planie w miarę kończenia sekcji.

Gdy coś nie pasuje dokładnie do planu, zastanów się dlaczego i jasno to zakomunikuj. Plan jest Twoim przewodnikiem, ale Twoja ocena również ma znaczenie.

Jeśli napotkasz niezgodność:

- ZATRZYMAJ SIĘ i głęboko zastanów się, dlaczego plan nie może być przestrzegany.
- Przedstaw problem jasno w formie tekstowej:

  ```
  Problem w Fazie [N]:
  Oczekiwano: [co mówi plan]
  Znaleziono: [rzeczywista sytuacja]
  Dlaczego to ma znaczenie: [wyjaśnienie]
  ```

- Następnie użyj `AskUserQuestion`, aby uzyskać ustrukturyzowaną decyzję:

  AskUserQuestion:
  - question: "Jak powinienem postąpić z tą niezgodnością?"
    header: "Niezgodność"
    options:
    - label: "Dostosuj i kontynuuj"
      description: "Dostosuję implementację do rzeczywistości. Wyjaśnię adaptację."
    - label: "Pomiń tę część"
      description: "Przejdź do następnej sekcji/fazy. Ta zmiana nie jest potrzebna."
    - label: "Zatrzymaj i zaplanuj ponownie"
      description: "Ta niezgodność jest zbyt znacząca. Najpierw musimy zaktualizować plan."
      multiSelect: false

## Śledzenie plików dotkniętych podczas fazy

Rytuał zatwierdzania końca fazy (patrz "Podejście do weryfikacji" poniżej) przygotowuje pliki z **zestawu dotkniętych plików**, który utrzymujesz w pamięci roboczej przez całą fazę. Ten zestaw jest kanonicznym wejściem do `git add` — nigdy nie wracaj do heurystyk `git status` dla decyzji o przygotowaniu.

**Dyscyplina**:

- Za każdym razem, gdy wywołujesz `Edit` lub `Write` na pliku podczas bieżącej fazy, dodaj jego ścieżkę względną do repozytorium do zestawu dotkniętych plików.
- Zestaw zawsze zawiera `context/changes/<change-id>/plan.md`, ponieważ każda faza powoduje co najmniej jedną edycję w sekcji `## Progress`. Dodaj go przy wejściu do fazy, nawet zanim jakiekolwiek pola wyboru zostaną zmienione.
- **Uruchomienie Fazy 1**: w pierwszej fazie zmiany, również zasiej zestaw dotkniętych plików wszystkimi nieśledzonymi lub zmodyfikowanymi plikami w `context/changes/<change-id>/` — zazwyczaj `change.md`, `research.md`, `plan.md` i innymi plikami kontekstowymi utworzonymi podczas planowania. Te pliki są częścią zmiany i powinny trafić do pierwszego commita, zamiast pozostawać jako nieśledzone resztki.
- Zestaw **resetuje się na każdej granicy fazy**. Po zakończeniu commita końca fazy, wyczyść go przed rozpoczęciem następnej fazy.
- Ta lista zastępuje wszelkie heurystyki z `git status`. Jeśli zestaw dotkniętych plików to `{a.md, b.md, plan.md}`, ale `git status --porcelain` również zgłasza `c.md` jako brudny, `c.md` jest niezwiązany — obsłuż go za pomocą monitu o brudną ścieżkę w rytuale, nigdy nie dołączaj go cicho do commita.

## Śledzenie odniesień do problemów/zadań dla commitów

Przed zaproponowaniem jakiejkolwiek wiadomości commitu na koniec fazy lub epilogu, przeskanuj kontekst rozmowy w poszukiwaniu odniesień do problemów lub zadań w systemie śledzenia, związanych z tą pracą implementacyjną, w tym kluczy Jira (na przykład `ABC-123`), identyfikatorów problemów Linear (na przykład `ENG-123`), odniesień do problemów/PR GitHub (na przykład `#123`, `GH-123` lub pełnych adresów URL problemów/PR GitHub) lub jawnych linków do zadań z Jira, Linear lub GitHub.

- Jeśli obecne są jedno lub więcej odniesień, umieść je w treści wiadomości commitu pod linią `Refs:`, zachowując, jeśli to możliwe, dokładne identyfikatory/adresy URL podane przez użytkownika.
- Jeśli dotyczy wiele odniesień, wymień je oddzielone przecinkami w jednej linii `Refs:`.
- Nie wymyślaj ani nie wnioskuj odniesień do śledzenia na podstawie identyfikatora zmiany, nazwy gałęzi lub nazw plików. Używaj tylko odniesień widocznych w bieżącym kontekście rozmowy lub jawnie podanych przez użytkownika.
- Zastosuj tę samą linię `Refs:` do każdego commitu na koniec fazy i do commitu epilogu, chyba że użytkownik zawęzi odniesienie do konkretnej fazy.

## Podejście do weryfikacji

Po zaimplementowaniu fazy:

- Uruchom sprawdzenia kryteriów sukcesu (zazwyczaj `make check test` obejmuje wszystko).
- Napraw wszelkie problemy przed kontynuowaniem.
- Zaktualizuj swój postęp w swoich zadaniach i w sekcji `## Progress` planu.
- **Modyfikuj TYLKO sekcję `## Progress`.** Bloki faz (Przegląd, Wymagane zmiany, Kryteria sukcesu) są tylko do odczytu. Użyj Edit, aby zmienić `- [ ] N.M <tytuł>` → `- [x] N.M <tytuł>` w Progress, gdy każdy krok zostanie zakończony. NIE edytuj punktorów bloków faz, NIE dodawaj znaczników postępu w komentarzach HTML na dole planu i NIE zapisuj żadnego pliku stanu.
- **Uruchom rytuał zatwierdzania końca fazy**: Po pomyślnym przejściu wszystkich automatycznych sprawdzeń dla fazy, przejdź przez ten sekwencyjny rytuał, aby utworzyć jeden commit Conventional-Commits i zapisać krótki SHA z powrotem do każdego wiersza Progress zmienionego podczas fazy.

  1. **Bramka ręcznego potwierdzenia.** Poinformuj człowieka, że automatyczna weryfikacja zakończyła się pomyślnie i wymień elementy ręcznej weryfikacji z planu. Zatrzymaj się tutaj. Nie kontynuuj, dopóki człowiek nie potwierdzi, że testy ręczne zakończyły się sukcesem. Użyj tego formatu:

     ```
     Faza [N] zakończona - Gotowa do ręcznej weryfikacji

     Automatyczna weryfikacja zakończona pomyślnie:
     - [Lista automatycznych sprawdzeń, które przeszły]

     Wykonaj kroki ręcznej weryfikacji wymienione w planie:
     - [Lista elementów ręcznej weryfikacji z planu]

     Daj mi znać, kiedy testy ręczne zostaną zakończone, abym mógł przejść do kroku zatwierdzania.
     ```

     **Ręczne podsumowanie międzyfazowe (tylko faza końcowa).** Przed wydrukowaniem komunikatu bramki, określ, czy bieżąca faza jest fazą końcową: przeskanuj sekcję `## Progress` w poszukiwaniu nagłówków `### Phase M:` i traktuj bieżącą fazę jako końcową, jeśli w kolejności dokumentu nie istnieje nagłówek z `M > N`. Jeśli bieżąca faza **nie jest** końcowa, komunikat bramki ma dokładnie powyższy format — bez podsumowania. Jeśli bieżąca faza **jest** końcowa, po bloku "Wykonaj kroki ręcznej weryfikacji wymienione w planie:", przeskanuj całą sekcję Progress w poszukiwaniu wierszy `- [ ]`, które znajdują się pod podsekcją `#### Manual` w dowolnej fazie **innej niż bieżąca**. Jeśli takie wiersze istnieją, dołącz następujący blok do komunikatu bramki (w kolejności dokumentu, jeden wiersz na linię, sformatowany jako `<faza>.<indeks> <tytuł>` — usuń wszelkie prefiksy `- [ ]` i wszelkie sufiksy ` — <sha>`):

     ```
     Oczekujące ręczne sprawdzenia z wcześniejszych faz:
     - [faza.indeks tytuł]
     ```

     Jeśli nie ma oczekujących ręcznych wierszy z wcześniejszych faz, pomiń blok podsumowania całkowicie. Bramka nadal wstrzymuje się na potwierdzenie od człowieka; jest to informacja, a nie twarda blokada. Fazy pośrednie (dowolna faza, która nie jest końcową) zachowują oryginalny format bramki bez podsumowania.

  2. **Oblicz zestaw przygotowania.** Weź zestaw dotkniętych plików utrzymywany podczas fazy (patrz "Śledzenie plików dotkniętych podczas fazy" powyżej) i połącz go z `{context/changes/<change-id>/plan.md}`. Plik planu jest zawsze przygotowywany, ponieważ każda faza powoduje co najmniej jedną edycję w sekcji `## Progress`.

  3. **Wykryj niezwiązane brudne ścieżki.** Uruchom `git status --porcelain` i przetnij z ścieżkami *poza* zestawem przygotowania. Jeśli zestaw brudnych, ale nietkniętych plików nie jest pusty, przedstaw problematyczne ścieżki i użyj `AskUserQuestion`:

     - question: "<N> niezwiązanych ścieżek jest brudnych. Jak powinienem je obsłużyć?"
       header: "Brudne ścieżki"
       options:
       - label: "Kontynuuj — przygotuj tylko zaplanowany zestaw (Zalecane)"
         description: "Zatwierdź tylko pliki, które ta faza dotknęła. Pozostaw niezwiązane ścieżki brudne, abyś mógł je obsłużyć oddzielnie."
       - label: "Przygotuj wszystkie"
         description: "Dodaj niezwiązane ścieżki do tego commita. Bierzesz odpowiedzialność za szerszy zakres."
       - label: "Przerwij"
         description: "Zatrzymaj commit fazy. Najpierw rozwiąż brudne ścieżki, a następnie ponownie uruchom rytuał."
       multiSelect: false

     Jeśli zestaw brudnych, ale nietkniętych plików jest pusty, pomiń ten krok.

  4. **Przygotuj jawnie według ścieżki.** `git add` każdy plik z wybranego zestawu po nazwie. NIE używaj `git add -A` ani `git add .` — tylko jawne ścieżki.

  5. **Sprawdź pusty diff.** Uruchom `git diff --cached --quiet`. Kod wyjścia 0 oznacza brak przygotowanego diffa. Jeśli pusty, wydrukuj:

     ```
     Faza [N] nie miała diffa do zatwierdzenia; wiersze pozostają bez SHA; archiwum tylko ostrzeże o nich.
     ```

     Ustaw `SHA=""` i przejdź do kroku 8.

  6. **Zaproponuj wiadomość Conventional-Commits.** Zbuduj linię tematu w formie `<typ>(<change-id>): <tytuł fazy> (p<N>)`, gdzie `<typ>` jest jednym z `feat / fix / chore / refactor / docs` wybranym na podstawie charakteru fazy (np. `feat` dla nowego zachowania widocznego dla użytkownika, `chore` dla edycji promptów/dokumentów, `refactor` dla restrukturyzacji bez zmiany zachowania). Tytuł fazy jest znaczącą częścią i prowadzi; sufiks `(p<N>)` zawiera indeks fazy. Zbuduj krótką treść zawierającą listę dotkniętych plików, plus linię `Refs:` z "Śledzenie odniesień do problemów/zadań dla commitów", jeśli ma zastosowanie. Użyj `AskUserQuestion`:

     - question: "Zatwierdzić wiadomość commitu?"
       header: "Wiadomość commitu"
       options:
       - label: "Zatwierdź zgodnie z propozycją (Zalecane)"
         description: "Użyj wiadomości w formie roboczej."
       - label: "Edytuj linię tematu"
         description: "Zastąp temat; zachowaj treść."
       - label: "Zastąp całkowicie"
         description: "Zastąp zarówno temat, jak i treść."
       multiSelect: false

  7. **Zatwierdź za pomocą heredoc.** Uruchom `git commit` zgodnie z globalnym protokołem wiadomości commitu:

     ```bash
     git commit -m "$(cat <<'EOF'
     <typ>(<change-id>): <tytuł fazy> (p<N>)

     <krótka treść zawierająca listę dotkniętych plików>
     <Refs: odniesienia do problemów/zadań, jeśli mają zastosowanie>
     EOF
     )"
     ```

     Nigdy nie przekazuj `--no-verify`, `--amend` ani flag pomijających podpisywanie. Jeśli hak pre-commit zawiedzie, napraw podstawowy problem i utwórz NOWY commit — oryginalny commit NIE nastąpił, więc poprawianie dotknęłoby commitu poprzedniej fazy.

  8. **Zapisz krótki SHA.** Uruchom `git rev-parse --short HEAD` i zapisz jako `SHA`. Pomiń ten krok, jeśli `SHA=""` zostało ustawione w kroku 5.

  9. **Zapisz SHA z powrotem do Progress.** Dla każdego wiersza Progress zmienionego podczas tej fazy, uruchom ukierunkowaną edycję:

     - Znajdź: `- [x] N.M <tytuł>` (bez istniejącego sufiksu ` — <sha>` na końcu linii)
     - Zastąp: `- [x] N.M <tytuł> — <SHA>`

     Pomiń wiersze, które już zawierają sufiks SHA (bezpieczeństwo wznowienia: jeśli rytuał zostanie ponownie uruchomiony po częściowym przebiegu, nie dodawaj podwójnie). Jeśli `SHA=""`, pomiń całkowicie dodawanie — wiersze pozostają bez SHA, a `/10x-archive` wyświetli je jako ostrzeżenia informacyjne w ramach swojego sprawdzenia braku SHA.

  10. **Zaktualizuj `change.md`.** Ustaw `updated: <today>`; zachowaj `status: implementing` (idempotentne do ostatniej fazy). W ostatniej fazie ustaw `status: implemented` po zapisaniu SHA (patrz "Po wszystkich fazach" poniżej).

  11. **Zresetuj zestaw dotkniętych plików.** Wyczyść go przed rozpoczęciem następnej fazy. Rytuał jest samodzielny dla każdej fazy.

- **Decyzja o następnej fazie**: Jeśli jest następna faza, pomóż użytkownikowi zdecydować, czy kontynuować, czy zacząć od nowa.

  Użyj `AskUserQuestion`, aby przedstawić decyzję:

  AskUserQuestion:
  - question: "Faza [N] zakończona. Jak postępować?"
    header: "Następna faza"
    options:
    - label: "Kontynuuj do Fazy [N+1]"
      description: "Pozostań w tym kontekście i przejdź do następnej fazy."
    - label: "Najpierw wyczyść kontekst"
      description: "Skopiuj polecenie wznowienia do schowka. Zacznij od nowa dla Fazy [N+1]."
    - label: "Najpierw przejrzyj tę fazę"
      description: "Uruchom /10x-impl-review, aby zweryfikować implementację z planem przed kontynuowaniem."
      multiSelect: false

  **Jeśli użytkownik zdecyduje się na przegląd**: Uruchom `/10x-impl-review @[ścieżka-do-planu] phase [N]`, aby przejrzeć właśnie zakończoną fazę. Po zakończeniu przeglądu, ponownie przedstaw decyzję o kontynuacji/wyczyszczeniu (tym razem bez opcji przeglądu).

  **Jeśli użytkownik zdecyduje się kontynuować**: Przejdź bezpośrednio do następnej fazy — przeczytaj sekcję planu dla następnej fazy, ustaw zadanie na `in_progress` i zaimplementuj. Nie ma potrzeby ponownego czytania całego planu ani już załadowanych plików.

  **Jeśli użytkownik zdecyduje się wyczyścić**: Skopiuj polecenie wznowienia do schowka i wyświetl je:
  1. Kopiuj:
     ```bash
     echo -n "/10x-implement <change-id> phase [next-phase-number]" | pbcopy 2>/dev/null || echo -n "/10x-implement <change-id> phase [next-phase-number]" | clip.exe 2>/dev/null || echo -n "/10x-implement <change-id> phase [next-phase-number]" | xclip -selection clipboard 2>/dev/null || true
     ```

     ```powershell
     # PowerShell (Windows)
     Set-Clipboard "/10x-implement <change-id> phase [next-phase-number]"
     ```
  2. Wyświetl:
     ```
     → /10x-implement <change-id> phase [next-phase-number] (✓ skopiowano)
     ```

Jeśli polecono wykonać wiele faz kolejno, pomiń AskUserQuestion między fazami.

nie zaznaczaj elementów w krokach testowania ręcznego, dopóki użytkownik ich nie potwierdzi.

## Śledzenie stanu

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy.** Brak pliku stanu. Brak znaczników komentarzy. Zobacz `references/progress-format.md` dla kontraktu formatu.

### Po każdym kroku

Użyj Edit, aby zmienić dokładnie jedną linię Progress na raz:

- Znajdź: `- [ ] N.M <tytuł>`
- Zastąp: `- [x] N.M <tytuł>`

Nie dołączaj sufiksu SHA do edycji pojedynczego kroku — SHA jest zapisywane z powrotem na końcu fazy przez rytuał commitu (patrz "Podejście do weryfikacji" powyżej), a tylko SHA końcowego commitu trafia do każdego wiersza, który został zmieniony podczas fazy. W trakcie fazy, ukończone wiersze mają `[x]` bez sufiksu SHA; jest to prawidłowy stan pośredni.

### Po każdej fazie

Gdy wszystkie elementy `- [ ]` wewnątrz `### Phase N:` są teraz `- [x]`:

1. Uruchom rytuał zatwierdzania końca fazy (patrz "Podejście do weryfikacji" powyżej): ręczne potwierdzenie → przygotowanie → monit o brudną ścieżkę → zatwierdzenie → zapis SHA.
2. `change.md.updated` jest aktualizowany w ramach kroku 10 rytuału.

Fazy z pustym diffem (tylko weryfikacja ręczna lub zaadaptowane fazy bez operacji) nic nie zatwierdzają i pozostawiają swoje wiersze bez SHA; `/10x-archive` wyświetli je jako ostrzeżenia informacyjne w ramach swojego sprawdzenia braku SHA. Jest to celowe — nie każda faza produkuje kod.

### Po wszystkich fazach

Gdy każdy `- [ ]` w całej sekcji `## Progress` jest teraz `- [x]`:

1. **Obronne wyświetlanie oczekujących elementów.** Przeskanuj całą sekcję `## Progress` po raz ostatni w poszukiwaniu wierszy `- [ ]`. W normalnym przebiegu jest to operacja bez efektu — warunek wyzwalający dla "Po wszystkich fazach" to już "każdy `- [ ]` jest `- [x]`", więc skanowanie nie powinno nic znaleźć. Istnieje po to, aby wszelkie nieoczekiwane pozostałości były jawne, a nie cicho utracone (np. jeśli częściowe uruchomienie, ręczna edycja lub ścieżka wznowienia ominęła wyzwalacz). Jeśli liczba jest różna od zera, wymień każdy wiersz jako `<faza>.<indeks> <tytuł>` pogrupowany według podsekcji Automatyczne vs Ręczne w kolejności dokumentu, a następnie zapytaj za pomocą `AskUserQuestion`:

   - question: "<N> element(y) Progress nadal oczekują. Jak postępować?"
     header: "Pozostałości"
     options:
     - label: "Wstrzymaj (Zalecane)"
       description: "ZATRZYMAJ bez zmiany change.md.status. Ręcznie zajmij się pozostałościami, a następnie ponownie wejdź na ścieżkę epilogu."
     - label: "Przejdź do epilogu"
       description: "Zmień status: implemented i mimo to uruchom commit epilogu. Pozostałości pojawią się jako ostrzeżenia w /10x-archive."
     multiSelect: false

   W przypadku "Wstrzymaj": ZATRZYMAJ natychmiast. NIE aktualizuj `change.md`, NIE uruchamiaj commitu epilogu. W przypadku "Przejdź do epilogu": kontynuuj z krokami 2–4 poniżej. Jeśli liczba wynosi zero, pomiń ten krok i kontynuuj.

2. Zaktualizuj `change.md`: ustaw `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — to należy do `/10x-archive`.)
3. NIE zapisuj żadnego znacznika postępu w komentarzu HTML na dole planu.
4. **Uruchom commit epilogu.** Commit ostatniej fazy nie może zawierać własnego SHA (kurczak i jajko), więc zapis SHA z powrotem do wierszy Progress ostatniej fazy plus zmiana statusu `change.md` pozostają brudne w drzewie roboczym po zakończeniu rytuału ostatniej fazy. Utwórz jeden commit zamykający, aby je zatwierdzić — w przeciwnym razie twarda odmowa `/10x-archive` (niezatwierdzone ścieżki w folderze zmiany) zablokuje. Kroki:
   1. Przygotuj dokładnie `context/changes/<change-id>/plan.md` i `context/changes/<change-id>/change.md` (jawne ścieżki, bez `git add -A`).
   2. Uruchom `git diff --cached --quiet`; jeśli kod wyjścia to 0, pomiń epilog (nic do zatwierdzenia) i zatrzymaj się tutaj.
   3. Zaproponuj temat `chore(<change-id>): close out plan (epilogue)` z krótką treścią odnotowującą końcowy zapis SHA planu + change.md → implemented, plus linię `Refs:` z "Śledzenie odniesień do problemów/zadań dla commitów", jeśli ma zastosowanie. Użyj AskUserQuestion, aby zatwierdzić zgodnie z propozycją / edytować temat / zastąpić całkowicie (te same opcje co rytuał fazy).
   4. Zatwierdź za pomocą heredoc zgodnie z globalnym protokołem (nigdy `--no-verify` / `--amend`).
   5. NIE zapisuj własnego SHA epilogu z powrotem do planu — jego jedynym zadaniem jest czyste zatwierdzenie końcowych edycji.

### "Gdzie jestem?" — wywnioskowane, nie przechowywane

Przeanalizuj sekcję `## Progress`. Pierwsza linia `- [ ]` to następny krok. Bieżąca faza to nagłówek `### Phase N:` bezpośrednio nad nią. Ukończenie to `count([x]) / count([ ] + [x])`. Bez JSON, bez znaczników, bez pliku towarzyszącego — tylko sekcja Progress.

## Ukończenie planu

Gdy WSZYSTKIE fazy zostaną zaimplementowane i zweryfikowane (każde pole wyboru Progress jest `[x]`):

1. Potwierdź, że `change.md.status` jest teraz `implemented`.
2. Przedstaw podsumowanie ukończenia, a następnie zaoferuj ostateczny przegląd:

```
Wszystkie fazy zaimplementowane! 🎉

Podsumowanie:
- Ukończone fazy: [N]
- Zmienione pliki: [lista kluczowych plików]
```

Użyj AskUserQuestion:

```
question: "Plan zakończony. Czy chcesz przeprowadzić ostateczny przegląd implementacji?"
header: "Plan zakończony"
options:
  - label: "Uruchom pełny przegląd (/10x-impl-review)"
    description: "Kompleksowy przegląd wszystkich faz w stosunku do planu. Wykrywa problemy międzyfazowe."
  - label: "Pomiń przegląd — jestem zadowolony"
    description: "Przegląd nie jest potrzebny. Oznacz plan jako zakończony."
multiSelect: false
```

Jeśli użytkownik wybierze przegląd → uruchom `/10x-impl-review <change-id>` (bez numeru fazy = pełny przegląd planu).

## Jeśli utkniesz

Gdy coś nie działa zgodnie z oczekiwaniami:

- Najpierw upewnij się, że przeczytałeś i zrozumiałeś cały odpowiedni kod.
- Rozważ, czy baza kodu ewoluowała od czasu napisania planu.
- Przedstaw jasno niezgodność i poproś o wskazówki.

Używaj podzadań oszczędnie — głównie do ukierunkowanego debugowania lub eksploracji nieznanego terenu:

- **Explore** (`subagent_type: "Explore"`) — Szybkie wyszukiwanie plików, wzorców, podobnego kodu.
- **general-purpose** (`subagent_type: "general-purpose"`) — Głęboka analiza wymagająca wieloetapowego rozumowania.

## Wznowienie pracy

Jeśli sekcja `## Progress` planu ma istniejące znaczniki `[x]`:

- Ufaj, że ukończona praca jest wykonana.
- Kontynuuj od pierwszej linii `- [ ]`.
- Weryfikuj poprzednią pracę tylko wtedy, gdy coś wydaje się nie tak.

Pamiętaj: Implementujesz rozwiązanie, a nie tylko zaznaczasz pola. Miej na uwadze cel końcowy i utrzymuj postęp.