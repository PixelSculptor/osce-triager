# UI Refresh — Krótki plan

> Pełny plan: `context/changes/ui-refresh/plan.md` Badania:
> `context/changes/ui-refresh/research.md`

## Co i dlaczego

Modernizacja UI nadbudowana na design systemie S-06: design system dostarczył
tokeny, ale warstwa komponentów wykorzystuje je tylko częściowo — stąd
„surowość". Naprawiamy dark mode (badge/kontrast), ujednolicamy przyciski,
wygładzamy animacje, dodajemy responsywne siatki, filtr historii, stepper i
odświeżamy navbar/settings/homepage — bez zaburzania flow ani testów E2E.

## Punkt wyjścia

Po `ui-design-system` (done): tokeny w `globals.css`, `next-themes`,
`lucide-react`, 11 zmigrowanych modułów CSS. Ale: `[data-theme='dark']` nie
nadpisuje tokenów statusu (badge sukcesu = jasny placek na ciemnym tle), tokeny
motion niedoużyte (`--transition-fast`=100ms za szybkie), żadna strona nie ma
media queries, brak filtra historii, navbar bez linku do Pulpitu, homepage bez
hero.

## Pożądany stan końcowy

Czytelne, dostępne badge w obu motywach; jeden spójny system przycisków z
gładkim hover; responsywne siatki 1/2/3 kol. na dashboard i historii; filtr i
stepper; nowoczesny navbar (link do Pulpitu, przeniesiony ThemeToggle, bez auth
dla gościa) i homepage z animowanym hero. Wszystkie testy E2E zielone.

## Kluczowe podjęte decyzje

| Decyzja         | Wybór                                             | Dlaczego                                       | Źródło  |
| --------------- | ------------------------------------------------- | ---------------------------------------------- | ------- |
| Punkt 11 vs E2E | Usunąć auth z navbara + zaktualizować 2 specs     | Mniej redundancji; testy celują w CTA homepage | Badania |
| Zakres          | Wszystkie 12 punktów, w 6 fazach                  | Spójność wizualna, jeden PR/issue              | Plan    |
| Motion          | Nowe tokeny `--transition-hover/-card` + migracja | Bez globalnej regresji `--transition-fast`     | Plan    |
| Przyciski       | Wspólny `Button` + warianty (radius-lg)           | Jedno źródło prawdy, koniec rozjazdów          | Plan    |
| Przejścia       | CSS-first, bez View Transitions                   | Zero ryzyka bundle/hydratacji, zgodne z RSC    | Plan    |
| Filtr historii  | Klient (URL searchParam), domyślnie wszystkie     | Prostsze, sesji mało, test widzi „Pozytywny"   | Plan    |
| Stepper         | Wizualny CSS + semantyka a11y (role=list)         | Nowoczesny look + dostępność bez biblioteki    | Plan    |
| critical_miss   | Ujednolicić (label+kolor w TestCard)              | Usuwa niespójność podczas redesignu badge      | Plan    |
| Hero            | Gradient mesh + animacja CSS                      | „Wyjście z MVP", lekkie, w RSC                 | Plan    |

## Zakres

**W zakresie:** dark mode tokeny statusu + muted; tokeny motion; wspólny
Button + migracja; hovery; siatki dashboard/historia; filtr historii; stepper
details; navbar refactor + usunięcie auth (gość); modernizacja settings;
homepage hero; sprzężona aktualizacja `auth-boundary.spec.ts`/`seed.spec.ts`;
ujednolicenie `critical_miss`.

**Poza zakresem:** View Transitions/Framer Motion; pełny hero z sekcjami (osobny
pomysł `homepage-landing`); zmiana logiki walidatora/schematu DB; zmiana
sortowania historii / filtr serwerowy; przeprojektowanie mechaniki sesji.

## Architektura / Podejście

Warstwa tokenów (`globals.css`) → nowy `shared/components/Button` → CSS Modules
stron/komponentów (siatki, badge, stepper, hero) → mały client component
`HistoryFilter`. Animacje wyłącznie CSS (transform/opacity, ~200ms, ease-out,
reduced-motion). Semantyka `<ul>/<li>` i kotwice E2E zachowane; jedyna zmiana
łamiąca testy (auth w navbarze) sprzężona z aktualizacją specs w Fazie 5.

## Fazy w skrócie

| Faza               | Co dostarcza                                                                                                                       | Kluczowe ryzyko                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1. Tokeny          | Dark mode statusy + muted + tokeny motion                                                                                          | Kontrast WCAG w obu motywach         |
| 2. Przyciski       | Wspólny Button + migracja ~8 miejsc + hovery                                                                                       | Zachować teksty/role (kotwice E2E)   |
| 3. Karty/siatki    | Siatki 1/2/3 kol., redesign badge, critical_miss                                                                                   | Nie zamienić `<li>` na `<div>`       |
| 4. Filtr/stepper   | Filtr historii (klient) + stepper linia-kropka                                                                                     | Domyślny filtr = wszystkie           |
| 5. Navbar/settings | Navbar refactor: **link Pulpit→/dashboard**, ThemeToggle między Ustawieniami a Wyloguj, usunięcie auth dla gościa + **E2E update** | Sprzężenie: nav + specs w 1 commicie |
| 6. Hero            | Homepage gradient mesh + animacja                                                                                                  | Kontrast tekstu na gradiencie, jank  |

**Wymagania wstępne:** S-06 (`ui-design-system`) done — tokeny obecne.
**Szacowany nakład pracy:** ~6 sesji (po fazie), z ręczną weryfikacją wizualną w
obu motywach po każdej.

## Otwarte ryzyka i założenia

- Wartości startowe kolorów dark wymagają finalnej weryfikacji w checkerze
  kontrastu po nałożeniu na realny surface.
- `Button` musi działać w formularzach RSC (`formAction`) bez wymuszania
  `'use client'` — czysty `<button>` z props.
- `critical_miss` w `TestCard`: dodajemy label+styl; jeśli walidator nie
  przekazuje tego wyniku do widoku sesji, pozostaje tylko spójność wizualna (bez
  zmiany logiki).

## Kryteria sukcesu (podsumowanie)

- Dark mode dostępny (badge/kontrast), brak regresji w light.
- Spójny system przycisków z gładkim hover; responsywne siatki; filtr + stepper;
  nowoczesny navbar/settings/homepage.
- `npm run test:e2e` zielony — kotwice zachowane, specs zaktualizowane.
