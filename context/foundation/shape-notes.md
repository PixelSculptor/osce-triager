---
project: "OSCE Triager"
context_type: greenfield
created: 2026-05-18
updated: 2026-05-18
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: "2026-06-30"
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "kategoria bólu"
      decision: "paraliż decyzyjny — materiał istnieje, brak interaktywnego symulatora z natychmiastową karą"
    - topic: "zasięg persony"
      decision: "studenci VI roku medycyny w Polsce, egzamin OSCE — wąska nisza"
    - topic: "dlaczego narzędzie jeszcze nie istnieje"
      decision: "bariera domenowa — tworzenie treści wymaga ekspertyzy klinicznej"
    - topic: "metoda logowania"
      decision: "e-mail + hasło"
    - topic: "model ról"
      decision: "płaski — wszyscy to studenci"
    - topic: "zakres MVP"
      decision: "6-krokowy przepływ, 3 tygodnie pracy po godzinach"
    - topic: "FR-003 timer"
      decision: "dodany jako must-have — bez timera brak trenowania presji czasu"
    - topic: "FR-004 lista badań"
      decision: "uproszczono do jednej wspólnej listy — pominięto per-scenariuszowe filtrowanie"
    - topic: "FR-007 kara za pominięcie"
      decision: "miękka penalizacja — sesja trwa, wynik nieodwracalnie negatywny"
    - topic: "FR-008/009 zależność"
      decision: "FR-009 zostaje nice-to-have; historia pełną wartość uzyskuje razem z FR-009"
  frs_drafted: 9
  quality_check_status: accepted
---

## Vision & Problem Statement

Student VI roku medycyny przygotowujący się do egzaminów OSCE (Objective Structured Clinical Examination) i pierwszych dyżurów w Szpitalnym Oddziale Ratunkowym doświadcza paraliżu decyzyjnego: materiał teoretyczny jest dostępny, ale nie istnieje interaktywny symulator ścieżki diagnostycznej, który w czasie rzeczywistym karze za pominięcie badania ratującego życie. Jedyną formą ćwiczenia jest wyobrażeniowe rozwiązywanie przypadków na papierze — bez informacji zwrotnej o kolejności i priorytecie zleceń.

Bariera wejścia dla twórców takich narzędzi jest wysoka: tworzenie scenariuszy klinicznych i logiki walidatora wymaga ekspertyzy medycznej. To wyjaśnia, dlaczego problem pozostaje nierozwiązany — nie jest to oczywisty cel dla typowych twórców oprogramowania edukacyjnego.

## User & Persona

**Główna persona**: Student VI roku medycyny w Polsce, przygotowujący się do końcowych egzaminów praktycznych OSCE oraz przyszłej pracy w SOR (Szpitalny Oddział Ratunkowy / Izba Przyjęć). Zna teorię diagnostyki, ale nie ma możliwości trenowania algorytmów postępowania pod presją czasu z natychmiastową informacją zwrotną.

## Access Control

- Metoda uwierzytelniania: e-mail + hasło (rejestracja i logowanie)
- Model ról: płaski — wszyscy zalogowani użytkownicy to studenci z identycznymi uprawnieniami
- Dane między kontami są izolowane; historia sesji jednego studenta nie jest widoczna dla innych

## Success Criteria

### Primary
- 75% przerobionych przez studentów przypadków testowych kończy się ścieżką, która nie zawiera kardynalnych błędów medycznych prowadzących do śmierci pacjenta.

### Secondary
- Po zakończeniu sesji student widzi wskazanie optymalnego badania pierwszego wyboru z uzasadnieniem klinicznym.

### Guardrails
- Historia sesji studenta jest niewidoczna dla innych studentów (izolacja danych między kontami).
- Walidator działa deterministycznie: ten sam wybór badania w tym samym scenariuszu zawsze daje ten sam wynik.

## User Stories

### US-01: Student wybiera właściwe badanie ratujące życie

- **Given** student jest zalogowany i otworzył scenariusz kliniczny (z aktywnym timerem)
- **When** student wybiera jako pierwsze badanie, które ratuje życie
- **Then** walidator potwierdza wybór i pozwala kontynuować ścieżkę diagnostyczną

#### Acceptance Criteria
- Walidator reaguje w < 1 s od momentu wyboru badania
- Status wyboru jest widoczny natychmiast po kliknięciu

## Functional Requirements

### Uwierzytelnianie

- FR-001: Student może założyć konto (e-mail + hasło). Priorytet: must-have
  > Sokrates: Rozważono kontrargument: rejestracja e-mail jest barierą tarcia wobec OAuth. Zachowano: e-mail + hasło to standard MVP bez uzależnienia od zewnętrznych dostawców.

- FR-002: Student może się zalogować i wylogować. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: wylogowanie to złożoność bez wartości edukacyjnej. Zachowano: logowanie/wylogowanie to standard dla aplikacji z kontami użytkownika.

### Scenariusz

- FR-003: Student może otworzyć scenariusz kliniczny (opis pacjenta: objawy, wywiad, parametry życiowe) z odliczaniem czasu sesji. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: opis tekstowy bez timera nie trenuje presji czasu. Zmodyfikowano: timer dodany jako must-have — opis scenariusza zawiera aktywne odliczanie czasu.

- FR-004: System wyświetla współdzieloną listę dostępnych badań diagnostycznych (tę samą dla wszystkich scenariuszy). Priorytet: must-have
  > Sokrates: Rozważono kontrargument: per-scenariuszowe filtrowanie to złożoność produkcyjna w MVP. Uproszczono: jedna wspólna lista badań dla wszystkich scenariuszy.

### Ścieżka diagnostyczna

- FR-005: Student może wybrać badanie diagnostyczne i dodać je do swojej ścieżki. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: sekwencyjny wybór jednego badania na raz jest nienaturalny klinicznie. Zachowano: sekwencyjny wybór jest właściwy dla trenowania priorytyzacji.

- FR-006: Walidator natychmiast ocenia każdy wybór (poprawne / nieoptymalnie / pominięto badanie ratujące życie). Priorytet: must-have
  > Sokrates: Rozważono kontrargument: natychmiastowa informacja zwrotna niszczy realizm (w SOR wyniki przychodzą z opóźnieniem). Zachowano: natychmiastowe sprzężenie zwrotne jest kluczowe dla mechanizmu nauki w MVP.

- FR-007: Gdy student pominie badanie ratujące życie, sesja jest oznaczana jako nieodwracalnie negatywna i może być kontynuowana wyłącznie w trybie nauki. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: twardy "game over" zniechęca do nauki. Zmodyfikowano: sesja trwa po błędzie krytycznym, ale wynik jest nieodwracalnie negatywny — student może dokończyć ścieżkę tylko dla nauki.

- FR-008: System kończy sesję wynikiem (pozytywny / negatywny) i zapisuje historię zleconych badań w koncie studenta. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: historia bez analizy ma małą wartość edukacyjną. Zachowano z notą zależności: FR-008 pełną wartość uzyskuje razem z FR-009; bez FR-009 historia jest ograniczonej wartości edukacyjnej.

### Wyjaśnienie

- FR-009: Po zakończeniu sesji student widzi wskazanie optymalnej ścieżki diagnostycznej z uzasadnieniem klinicznym. Priorytet: nice-to-have
  > Sokrates: Rozważono kontrargument: "optymalne" może być kontrowersyjne klinicznie — eksperci mogą się nie zgadzać co do jednej słusznej ścieżki. Skierowane do Open Questions: jak zdefiniować "optymalność" diagnostyczną w kontekście OSCE?

## Business Logic

System ocenia poprawność i optymalność każdego wybranego badania oraz nieodwracalnie oznacza sesję jako negatywną, gdy student pominie badanie ratujące życie.

Wejścia reguły: wybór badania diagnostycznego przez studenta w kontekście aktywnego scenariusza klinicznego. Każde badanie na liście ma przypisaną klasyfikację: krytyczne (ratuje życie), optymalne (pierwsze z wyboru), akceptowalne, zbędne. Wyjście reguły: status oceny wyboru (poprawne / nieoptymalnie / błąd krytyczny). Użytkownik napotyka regułę po każdym kliknięciu — natychmiastowa informacja zwrotna widoczna przy wybranym badaniu.

## Non-Functional Requirements

- Walidator reaguje w < 1 s od momentu wyboru badania — niezależnie od liczby aktywnych sesji.
- Dane sesji jednego studenta nie są dostępne z konta innego studenta — izolacja na poziomie każdego żądania.
- Aplikacja działa poprawnie na najnowszych wersjach Chrome, Firefox i Safari.

## Non-Goals

- **Brak dashboardu postępu i statystyk długookresowych** — zbieranie i wizualizacja danych o postępach studenta w czasie jest poza MVP.
- **Brak leaderboardu i rywalizacji między studentami** — ranking globalny, punktacja zbiorowa, porównywanie wyników. Poza MVP.
- **Brak integracji z zewnętrznymi systemami medycznymi** — MedLine, API z wytycznymi klinicznymi, szpitalne systemy EHR. Poza MVP.
- **Brak dynamicznej bazy scenariuszy (CMS dla lekarzy)** — panel do zarządzania i tworzenia nowych przypadków medycznych przez personel medyczny. Poza MVP; kilka hardcoded wariantów wystarczy.
- **Brak natywnej aplikacji mobilnej / desktopowej** — tylko responsywna aplikacja webowa. Natywne iOS/Android/desktop są poza zakresem.
- **Brak trybu offline** — aplikacja wymaga połączenia z siecią. Offline-first poza MVP.
- **Brak pełnej zgodności z WCAG-AA** — podstawowa dostępność jest oczekiwana, ale pełny audyt WCAG nie jest celem MVP.

## Open Questions

1. **Jak zdefiniować "optymalność" diagnostyczną w kontekście OSCE?** — Czy jedna "poprawna" ścieżka diagnostyczna jest możliwa w każdym scenariuszu, czy istnieje więcej niż jedna akceptowalna sekwencja badań? Eksperci kliniczni mogą się nie zgadzać. Właściciel: autor (wymaga konsultacji z lekarzem). Blokuje: FR-009 (nice-to-have) oraz szczegóły klasyfikacji badań w walidatorze.

## Quality cross-check

Wszystkie 5 kontroli przeszły pomyślnie dla greenfield:
- Kontrola dostępu: present
- Logika biznesowa: present (jednolinijkowa reguła)
- Artefakty projektu: present
- Potwierdzenie kosztów czasowych: present (mvp_weeks = 3 ≤ 3)
- Non-Goals: present (7 wpisów)
