---
name: 10x-rule-review
description: >
  Review the condition of an "AI rules" file (CLAUDE.md, AGENTS.md,
  .cursor/rules/*.mdc, copilot-instructions.md, .windsurfrules, or similar)
  and produce a 5-point scorecard with concrete fixes, regardless of which
  tool the rules target. Use when the user asks to "review AI rules",
  "audit AGENTS.md", "check my CLAUDE.md", "score my agent instructions".
allowed-tools:
  - Read
  - Glob
  - Grep
  - Edit
  - AskUserQuestion
---

# Przegląd reguł 10x

Oceń plik reguł AI w pięciu kategoriach i przedstaw konkretne poprawki. Plik poddawany przeglądowi to dowolny plik markdown z regułami dla AI, który użytkownik poda — ta umiejętność nie zakłada CLAUDE.md, AGENTS.md ani żadnego konkretnego narzędzia.

Umiejętność nigdy nie edytuje pliku. Tworzy kartę wyników. Użytkownik decyduje, co zrobić.

## Rozwiązanie wejścia

`$ARGUMENTS` powinien być ścieżką do pojedynczego pliku markdown (absolutną, względną do repozytorium lub z prefiksem `@`). Przykłady:

- `@CLAUDE.md`
- `AGENTS.md`
- `.cursor/rules/api.mdc`
- `src/api/AGENTS.md`
- `.github/copilot-instructions.md`
- `~/.claude/CLAUDE.md`

Jeśli `$ARGUMENTS` jest pusty, zapytaj użytkownika raz o ścieżkę. Nie zgaduj.

Jeśli ścieżka wskazuje na katalog, zapytaj, który plik ma zostać poddany przeglądowi. Jeśli wskazuje na wiele plików (np. `**/AGENTS.md`), oceniaj je pojedynczo i zgłaszaj każdą kartę wyników oddzielnie — nie łącz ich.

Jeśli plik nie istnieje, zatrzymaj się i zgłoś ścieżkę. Nie wymyślaj treści.

## Czego ta umiejętność NIE robi

- Nie edytuje pliku reguł, *chyba że użytkownik wyraźnie zatwierdzi zmianę kolejności zaproponowaną przez Sprawdzenie 5*. Domyślny wynik jest tylko do odczytu.
- Nie generuje pełnej "naprawionej wersji" pliku. Co najwyżej, Sprawdzenie 5 może przenosić/grupować sekcje; nigdy nie przepisuje treści reguł.
- Nie zakłada docelowego narzędzia pliku. CLAUDE.md, AGENTS.md, `.mdc`, `.windsurfrules`, niestandardowe nazwy — wszystkie traktowane są jako "plik reguł dla AI".
- Nie ocenia *treści projektu* (architektury, wyborów technologicznych, konwencji). Ocenia *stan artefaktu reguły* — tak samo, jak przegląd kodu ocenia kod, a nie produkt.

## Procedura

1. Przeczytaj cały plik (użyj `Read` raz; jeśli ma > 2000 linii, czytaj w kawałkach, aż do ukończenia).
2. Wykonaj Sprawdzenia 1–4.
3. Uruchom Sprawdzenie 5 w jego własnym, wieloetapowym przepływie (5a lista → 5b komentarz → 5c propozycja → 5d zapytanie za pomocą `AskUserQuestion` → 5e przypomnienie o atomowej zmianie). Edycja zmiany kolejności, jeśli taka nastąpi, odbywa się tutaj i tylko za wyraźną zgodą użytkownika.
4. Wydrukuj kartę wyników w dokładnym formacie pod "Format wyjściowy". Uwzględnij podsumowanie propozycji zmiany kolejności i decyzję użytkownika w wynikach Sprawdzenia 5.
5. Zatrzymaj się. Nie proponuj dalszych działań, chyba że użytkownik o to poprosi.

---

## 5 sprawdzeń

### Sprawdzenie 1 — Długość

Policz niepuste linie (ignoruj puste linie i czyste linie separatorów, takie jak `---`).

| Linie       | Werdykt      | Symbol |
|-------------|--------------|--------|
| 0–200       | w porządku   | OK     |
| 201–500     | uważaj      | WARN   |
| 501+        | ostrzeżenie  | FAIL   |

Dlaczego to ważne: długie pliki reguł zajmują miejsce na prompt użytkownika w oknie kontekstu, a reguły w środku pliku otrzymują najmniejszą uwagę od modelu. Długość jest wskaźnikiem tego, że "płacisz kontekstem za rzeczy, których agent nie potrzebuje w każdej sesji".

Dla WARN/FAIL, zasugeruj:
- Podziel reguły dotyczące poszczególnych obszarów na zagnieżdżone pliki bliżej ich kodu (np. `src/api/AGENTS.md`).
- Zastąp zduplikowane dokumenty odniesieniami `@` do kanonicznego pliku.
- Usuń reguły, które nie są związane z powtarzającym się trybem awarii agenta.

### Sprawdzenie 2 — Bezpośrednie fragmenty kodu/konfiguracji

Skanuj w poszukiwaniu bloków kodu w ogrodzeniach (```` ``` ````) i wbudowanych bloków kodu dłuższych niż ~3 linie.

Oznacz każdy blok, który wygląda jak:
- Przykładowy komponent, endpoint, migracja, schemat, zapytanie, skrypt bash lub test.
- Plik konfiguracyjny (`tsconfig.json`, `eslintrc`, `package.json`, `wrangler.toml`).
- Szablon migracji lub boilerplate, który znajduje się gdzie indziej w repozytorium.

**Nie** oznaczaj:
- Krótkich fragmentów strukturalnych używanych do zdefiniowania *formatu*, który agent musi wygenerować (np. 2–4-liniowy szablon kształtu błędu).
- Przykładów poleceń (`npm run dev`, `git rebase`, itp.).
- Bloków Mermaid/diagramów.

Dla każdego oznaczonego bloku zasugeruj:
- Przenieś fragment do prawdziwego pliku w repozytorium.
- Zastąp blok jednowierszowym odniesieniem `@`, np. `@src/features/users/user.service.ts`, `@docs/api-errors.md`.
- Powód: przykład będzie błędny w dwóch miejscach przy następnym refaktoryzacji; odniesienie nie może się rozjechać.

Werdykt: OK, jeśli 0 oznaczonych bloków · WARN, jeśli 1–2 · FAIL, jeśli 3+.

### Sprawdzenie 3 — Precyzyjny język

Skanuj w poszukiwaniu niejasnych intencji, których nie można sprawdzić w porównaniu z różnicą. Częste błędy:

- "Pisz czysty kod"
- "Przestrzegaj najlepszych praktyk"
- "Dbaj o jakość"
- "Bądź konsekwentny"
- "Używaj nowoczesnych wzorców"
- "Uczyń go czytelnym / łatwym w utrzymaniu / solidnym"
- "Poprawnie obsługuj błędy"
- "Zachowaj prostotę"

Dla każdego dopasowania, **zawsze proponuj co najmniej jedną konkretną, testowalną alternatywę, osadzoną w kontekście tego projektu**. Nigdy nie sugeruj "po prostu to usuń" — autor umieścił tam tę linię z jakiegoś powodu; Twoim zadaniem jest przetłumaczenie intencji na coś, co recenzent może sprawdzić w porównaniu z różnicą.

Aby ugruntować sugestię, czerp sygnały z:
- pliku poddawanego przeglądowi (wspomniany stos, zasady nazewnictwa podane gdzie indziej, twarde reguły w innych sekcjach),
- pobliskich akapitów wokół niejasnego wyrażenia (co autor zamierzał powiedzieć?),
- widocznego kontekstu repozytorium, jeśli jest dostępny (`package.json`, `tsconfig.json`, wybór frameworka, konfiguracja lintera, pliki reguł rodzeństwa).

Jeśli kontekst projektu naprawdę nie sugeruje niczego konkretnego, zaproponuj rozsądne domyślne ustawienie dla wykrytego stosu i oznacz je **(założono)**, aby autor wiedział, że ma to potwierdzić.

Przykłady (zauważ, jak każde zastąpienie wykorzystuje nazwy/konwencje specyficzne dla projektu, a nie ogólne porady):

| Niejasne wyrażenie w pliku              | Sygnał kontekstu projektu                          | Ugruntowane, testowalne zastąpienie                                                                              |
|-----------------------------------|--------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| "Pisz czysty kod"                | TypeScript + ESLint wspomniane w tym samym pliku      | "Unikaj `any`. Funkcje powyżej 40 linii muszą być podzielone. Uruchom `pnpm lint` przed commitowaniem."                   |
| "Poprawnie obsługuj błędy"          | Twarda reguła wcześniej: API zwraca kształt `{ error: {...} }` | "Obsługi API muszą zwracać `{ error: { code, message, context } }` zgodnie z powyżej zdefiniowanym kształtem. Nigdy nie rzucaj surowych błędów." |
| "Bądź konsekwentny w nazewnictwie"       | Plik wspomina `feature.handler.ts` gdzie indziej    | "Używaj `<feature>.handler.ts` (zgodnie z istniejącymi handlerami w `src/api/`), a nie `featureHandler.ts`."       |
| "Używaj nowoczesnych wzorców"             | Projekt używa natywnego JS, brak lodash w `package.json` | "Używaj natywnych metod `Array`/`Object`. Nie dodawaj `lodash` — nie ma go w `package.json` i tak to utrzymujemy." |
| "Uczyń komponenty czytelnymi"        | Projekt React + Tailwind                         | "Komponenty powyżej 150 linii muszą być podzielone. Klasy Tailwind przechodzą przez `cn()` dla warunków (założono — potwierdź, jeśli używany jest inny pomocnik)." |
| "Zachowaj prostotę"              | Usługa Python FastAPI                           | "Preferuj jeden model Pydantic na żądanie/odpowiedź. Brak zagnieżdżonych dekoratorów poza `@router.post` + `@requires_auth`." |

Werdykt: OK, jeśli 0 niejasnych fraz · WARN, jeśli 1–3 · FAIL, jeśli 4+.

Werdykt: OK, jeśli 0 niejasnych fraz · WARN, jeśli 1–3 · FAIL, jeśli 4+.

### Sprawdzenie 4 — Nadmiarowa wiedza

Jesteś agentem aktorem przeglądającym ten plik. Przeczytaj go tak, jakbyś czytał go na początku sesji i zadaj jedno pytanie po każdym akapicie:

> **"Czy wiedziałem to już, zanim otworzyłem plik?"**

Jeśli odpowiedź brzmi "tak, to jest w moich danych treningowych" lub "tak, to jest udokumentowana domyślna wartość frameworka" lub "tak, README/konfiguracja lintera już to mówi" — oznacz to. Autor zapłacił kontekstem za coś, czego nie musiałeś wyjaśniać.

Użyj tych autotestów podczas skanowania:

- **Test "bez niespodzianek".** Czy mógłbyś sam stworzyć ten akapit, gdybyś został o to poproszony, bez dostępu do projektu? Jeśli tak — nadmiarowe.
- **Test "domyślny framework".** Czy reguła powtarza coś, co framework, konfiguracja lintera, sprawdzanie typów lub runner testów już wymusza (np. "używaj trybu ścisłego TypeScript", "używaj czyszczenia `useEffect`", "FastAPI używa Pydantic do walidacji", "PostgreSQL obsługuje JSONB")? Jeśli tak — nadmiarowe. Narzędzie wychwyci naruszenie; proza nic nie doda.
- **Test "definicji".** Czy akapit definiuje ogólny termin inżynierski ("co to jest warstwa usług", "czym jest REST", "czym są hooki", "czym jest JSX", "czym jest `Decimal`")? Znasz je. Oznacz i usuń.
- **Test "może być linkiem".** Czy duplikuje `README.md`, skrypty `package.json`, układ projektu lub ustawienia `.eslintrc`? Jeśli tak — zastąp `@README.md` / `@package.json` / `@.eslintrc.json`. Odniesienie nie dryfuje; skopiowana proza tak.
- **Test "zapachu samouczka".** Jeśli akapit wygląda jak sekcja ze strony "Getting Started" frameworka lub artykułu na Medium — to jest treść samouczka, a nie wiedza o projekcie. Czytałeś je podczas szkolenia.

Co **nie** jest nadmiarowe (nie oznaczaj):
- Konwencje specyficzne dla projektu, które są sprzeczne z domyślnymi ustawieniami frameworka ("używamy `useEffect` tylko do efektów ubocznych niezwiązanych z danymi").
- Lokalne pułapki i historyczne obejścia, których nie można było wywnioskować z kodu ("tabela `events` jest partycjonowana według miesiąca — masowe wstawienia do niewłaściwej partycji kończą się cicho niepowodzeniem").
- Wewnętrzne zasady nazewnictwa, układu lub przepływu pracy ("postings znajdują się w `<verb>_<noun>.posting.ts`").
- Reguły, które wyglądają ogólnie, ale są związane z prawdziwym incydentem (plik powinien wspominać o incydencie lub linkować do rejestru trybów awarii).

Dla każdego oznaczonego akapitu zasugeruj jedno z:
- **Usuń go** — już to wiedziałeś.
- **Zastąp odniesieniem `@`** — `@README.md`, `@tsconfig.json`, `@docs/...`.
- **Zachowaj tylko, jeśli jest poparte incydentem** — a jeśli tak, poproś autora o dodanie notatki o incydencie w tekście, aby reguła przetrwała przyszłe audyty.

Werdykt: OK, jeśli 0 nadmiarowych akapitów · WARN, jeśli 1–3 · FAIL, jeśli 4+.

### Sprawdzenie 5 — Kolejność reguł

Modele zwracają większą uwagę na początek i koniec długich kontekstów ("uwaga w kształcie litery U"). Krytyczne reguły ukryte w środku długiego pliku są statystycznie mniej prawdopodobne do przestrzegania. To sprawdzenie ma swój własny, wieloetapowy przepływ, ponieważ zmiana kolejności pliku jest znaczącą edycją, a nie jednowierszową poprawką.

Wykonaj kroki w kolejności. Wynik tego sprawdzenia trafia do karty wyników *i* może wywołać interaktywną zmianę kolejności.

#### Krok 5a — Wypisz bieżącą ogólną kolejność

Przejdź przez plik i wydrukuj bieżącą strukturę najwyższego poziomu jako numerowaną listę. Użyj nagłówków H1/H2 (i H3 tylko, jeśli nie ma H2). Uwzględnij numer linii każdego nagłówka. **Nie** komentuj jeszcze — po prostu przedstaw to, co jest.

Przykład:
```
Bieżąca kolejność:
1. # Witamy w OrderFlow            (linia 1)
2. ## O zespole                 (linia 5)
3. ## Misja projektu                (linia 9)
4. ## Nasze wartości                     (linia 13)
5. ## Stos technologiczny                     (linia 22)
6. ## Konfiguracja                          (linia 36)
7. ## TypeScript                     (linia 78)
...
N. ## Konwencje projektu            (linia 312)
```

Jeśli plik nie ma nagłówków, powiedz to wyraźnie: *"Brak nagłówków sekcji — plik to jeden niezróżnicowany blok."*

#### Krok 5b — Skomentuj kolejność

Teraz dodaj adnotacje do listy. Dla każdej sekcji nadaj jej krótki tag i jednowierszową notatkę. Użyj tych tagów:

- **KRYTYCZNE** — reguła nośna (bezpieczeństwo, pieniądze, nieodwracalność, specyficzne dla projektu "nigdy nie rób X").
- **PRZYDATNE** — prawdziwa wiedza o projekcie, która pomaga, ale nie jest pułapką.
- **WPROWADZENIE** — powitanie/misja/zespół — obniża gęstość sygnału na górze.
- **NADMIAROWE** — już oznaczone w Sprawdzeniu 4 (domyślne ustawienia frameworka, definicje, treść samouczka).
- **NIEJASNE** — już oznaczone w Sprawdzeniu 3.
- **ODNIESIENIE** — wskazuje na inne pliki za pomocą składni `@` (tanie, w porządku wszędzie).

Następnie przedstaw problem strukturalny w jednym akapicie. Przykłady:

> "Krytyczne reguły bezpieczeństwa i dzierżawy znajdują się na dole (linia 312). Pierwsze 35 linii to WPROWADZENIE/wartości/marketing, które model będzie mocno ważył, ale które nie zawierają żadnych możliwych do podjęcia działań reguł. Ryzyko: agent w pełni czyta nadmiar i pomija reguły, które faktycznie mają znaczenie."

> "Kolejność jest z grubsza poprawna — twarde reguły na górze, konwencje w środku, odniesienia na dole. Jeden akapit WPROWADZENIA w linii 1 mógłby zostać skrócony, ale nie jest potrzebna restrukturyzacja."

#### Krok 5c — Zaproponuj lepszą kolejność (tylko w razie potrzeby)

Jeśli komentarz w 5b zidentyfikował prawdziwy problem, zaproponuj docelową kolejność. Sformułuj to jako *"sekcje przeniesione na górę / zachowane / przeniesione na dół / usunięte"*, a nie jako pełne przepisanie każdej linii.

Przykład:
```
Proponowana kolejność:
1. ## Twarde reguły         (było: linia 312)        ← przeniesione na górę
2. ## Konwencje projektu (było: linia 312, podzielone) ← przeniesione w górę
3. ## Stos technologiczny          (było: linia 22)         ← zachowane
4. ## Konfiguracja               (było: linia 36)         ← zachowane, zastąpione @README.md, jeśli to możliwe
5. ## Tryby awarii       (nowa sekcja)          ← zbierz tutaj reguły oparte na incydentach
—   ## O zespole / Misja / Wartości        ← usuń (Sprawdzenie 3/4 już je oznaczyło)
```

Jeśli 5b nie znalazło problemu, pomiń całkowicie 5c — powiedz *"Kolejność jest prawidłowa; nie jest potrzebna restrukturyzacja."*

#### Krok 5d — Zapytaj przed zmianą kolejności

Jeśli 5c wygenerowało propozycję, **zapytaj użytkownika za pomocą `AskUserQuestion`** przed dotknięciem pliku. Sformułuj pytanie konkretnie. Przykładowe opcje:

- **Tak, zmień kolejność pliku teraz** — zastosuj proponowaną strukturę, zachowaj całą treść reguł, tylko przenieś/przegrupuj sekcje.
- **Przenieś tylko krytyczne reguły na górę** — minimalna zmiana: przenieś twarde reguły na górę, resztę zostaw w spokoju.
- **Nie, po prostu zostaw sugestię w raporcie** — nie edytuj pliku; karta wyników pozostaje.
- **Pokaż mi najpierw różnicę** — wygeneruj zmieniony plik jako blok podglądu na czacie, bez zapisu.

Jeśli użytkownik wybierze opcję edycji, zastosuj ją ostrożnie: zachowaj każdy bajt treści reguł (przenoszą się tylko nagłówki i bloki sekcji) i wykonaj jedną edycję. Jeśli użytkownik wybierze "zostaw sugestię", nie rób nic.

#### Krok 5e — Przypomnienie o atomowej zmianie

Zawsze kończ Sprawdzenie 5 tym przypomnieniem, niezależnie od tego, czy nastąpiła zmiana kolejności:

> **Przetestuj każdą zmianę w następnej sesji agenta.** Zmiana kolejności pliku reguł to zmiana kształtu kontekstu — jej wpływ na zachowanie agenta ujawnia się dopiero przy następnym uruchomieniu rzeczywistego zadania. Stosuj zmiany pojedynczo (atomowo): zmień kolejność, a następnie uruchom reprezentatywne zadanie, a następnie przejdź do następnej zmiany (podziel, usuń duplikaty, przepisz). Łączenie wielu zmian strukturalnych uniemożliwia przypisanie zmiany zachowania do konkretnej edycji.

#### Werdykt

Oceń plik przed jakąkolwiek zmianą kolejności, na podstawie oryginalnej kolejności:

- **OK** — góra pliku jest gęsta od reguł KRYTYCZNYCH/PRZYDATNYCH, jasne nagłówki, brak nadmiaru WPROWADZENIA na początku.
- **WARN** — struktura jest mieszana: niektóre krytyczne reguły na górze, inne ukryte; lub nietrywialne WPROWADZENIE na początku.
- **FAIL** — krytyczne reguły pojawiają się po linii 200, lub plik nie ma w ogóle nagłówków, lub pierwsze 30+ linii to czyste WPROWADZENIE/marketing.

---

## Format wyjściowy

Wydrukuj dokładnie to, w tej kolejności. Użyj języka polskiego lub angielskiego, zgodnego z językiem promptu użytkownika. Odwołaj się do `path:line` dla każdego konkretnego znaleziska, aby użytkownik mógł od razu do niego przejść.

```
# Przegląd reguł — <ścieżka>

**Ogólnie:** <jednowierszowe podsumowanie, np. "Zdrowy plik z dwoma punktami nadmiarowości" lub "Długi, niejasny i ciężki na dole — wymaga podziału">

## Karta wyników

| # | Sprawdzenie                | Werdykt | Wynik |
|---|----------------------|---------|-------|
| 1 | Długość               | OK/WARN/FAIL | <n> niepustych linii |
| 2 | Bezpośrednie fragmenty      | OK/WARN/FAIL | <n> oznaczonych bloków |
| 3 | Precyzyjny język     | OK/WARN/FAIL | <n> niejasnych fraz |
| 4 | Nadmiarowa wiedza  | OK/WARN/FAIL | <n> nadmiarowych reguł |
| 5 | Kolejność reguł        | OK/WARN/FAIL | <jednowierszowy powód> |

## Ustalenia

### 1. Długość — <werdykt>
- <n> niepustych linii.
- <sugestia, jeśli WARN/FAIL, w przeciwnym razie pomiń>

### 2. Bezpośrednie fragmenty — <werdykt>
- `ścieżka:zakres-linii` — <jaki rodzaj fragmentu> → zasugeruj odniesienie `@<plik>`.
- ...

### 3. Precyzyjny język — <werdykt>
- `ścieżka:linia` — "<niejasna fraza>" → "<testowalne przepisanie>"
- ...

### 4. Nadmiarowa wiedza — <werdykt>
- `ścieżka:linia` — <co jest nadmiarowe> → <usuń | zastąp odniesieniem @ | zachowaj tylko, jeśli jest poparte incydentem>
- ...

### 5. Kolejność reguł — <werdykt>
- <obserwacja strukturalna, np. "Krytyczna reguła bezpieczeństwa w linii 287, wprowadzenie w liniach 1–42">
- <sugestia>

## 3 najważniejsze działania
1. <najbardziej efektywna poprawka>
2. <druga>
3. <trzecia>
```

Jeśli sprawdzenie jest OK, nadal umieść je w tabeli, ale pomiń podsekcję "Ustalenia" (napisz `### N. <nazwa> — OK` i jedną krótką linię, nic więcej).

"3 najważniejsze działania" muszą być uporządkowane według efektywności, a nie według numeru sprawdzenia. Wybierz spośród wszystkich pięciu sprawdzeń.

---

## Przypadki brzegowe

- **Plik poniżej 50 linii:** nadal wykonaj wszystkie pięć sprawdzeń. Krótkie pliki często najczęściej zawodzą w Sprawdzeniu 3 (niejasne) i Sprawdzeniu 4 (nadmiarowe).
- **Plik składa się głównie z odniesień (`@…`) i niewielu reguł w tekście:** to dobry znak dla Sprawdzeń 2 i 4. Nie karaj go.
- **Plik to `.mdc` z frontmatterem (`globs:`, `alwaysApply:`):** policz linie reguł od miejsca po frontmatterze. Sam frontmatter to konfiguracja, a nie treść reguł.
- **Plik to wygenerowany szablon z `/init` i nietknięty:** nadal go przeglądaj. Często dominuje Sprawdzenie 4 (nadmiarowe) — to sygnał do jego oczyszczenia.
- **Wiele plików reguł w projekcie:** przeglądaj ten, który został przekazany. Wspomnij o plikach rodzeństwa w "3 najważniejszych działaniach" tylko wtedy, gdy jest to istotne (np. duplikacja między głównym `AGENTS.md` a zagnieżdżonym).