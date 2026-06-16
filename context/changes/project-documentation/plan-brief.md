# Project documentation — Krótki plan

> Pełny plan: `context/changes/project-documentation/plan.md` Badania:
> `context/changes/project-documentation/research.md`

## Co i dlaczego

Napisanie README.md od zera dla projektu OSCE Triager jako dokumentu portfolio
dla rekruterów technicznych odwiedzających repozytorium na GitHub. README jest
pustym plikiem (1 linia) — wszystko do zbudowania od zera, ale cała treść jest
zmapowana w dokumencie badawczym.

## Punkt wyjścia

`README.md` zawiera 1 pustą linię. Brak screenshotów w repozytorium. Cały
materiał źródłowy (10 sekcji, dokładne wersje, ścieżki kodu, decyzje
architektoniczne) jest zgromadzony w
`context/changes/project-documentation/research.md` — gotowy do przetłumaczenia
na angielski i umieszczenia w README.

## Pożądany stan końcowy

Po zakończeniu planu: repozytorium ma profesjonalne README po angielsku z live
demo linkiem, 3 screenshotami inline, tabelą stacku technologicznego, opisem
architektury, coverage testów i CI badge. Rekruter widzi działającą aplikację i
kluczowe decyzje techniczne bez otwierania kodu.

## Kluczowe podjęte decyzje

| Decyzja              | Wybór                               | Dlaczego (1 zdanie)                                                  | Źródło  |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------- | ------- |
| Język README         | Angielski                           | Dostępne dla rekruterów międzynarodowych; standard open-source.      | Plan    |
| Screenshoty          | Zrobić w Fazie 1, przed README      | Screenshoty muszą istnieć zanim README będzie je referencjonował.    | Plan    |
| Sekcja local setup   | Zwięzła (6 komend + lista env vars) | Wystarczająca dla technicznego rekrutera, bez zbędnego rozbudowania. | Plan    |
| Badges               | Tylko CI status (GitHub Actions)    | Minimalny, informacyjny; TypeScript/Cloudflare badges poza zakresem. | Plan    |
| `.env.local.example` | Nie tworzyć                         | Dodałoby zależność poza zakresem tej zmiany.                         | Plan    |
| Treść README         | 10 sekcji z research.md             | Research zmapował optymalną strukturę dla rekrutera.                 | Badania |

## Zakres

**W zakresie:**

- `docs/screenshots/` — 3 pliki PNG (login, sesja, wyniki)
- `README.md` — 10 sekcji w angielskim
- Weryfikacja live URL

**Poza zakresem:**

- Zmiany w kodzie aplikacji
- Plik `.env.local.example`
- Badges poza CI status
- Wiki, docs site, dodatkowa dokumentacja
- CONTRIBUTING, CODE_OF_CONDUCT

## Architektura / Podejście

Zadanie czysto dokumentacyjne. Faza 1 tworzy visual assets (screenshoty jako
pliki w repozytorium), Faza 2 tworzy README.md referencjonujący te pliki.
Sekwencja jest wymagana — README linkuje screenshoty przez względne ścieżki
(`docs/screenshots/*.png`), więc muszą istnieć przed commitem README lub w tym
samym commicie.

## Fazy w skrócie

| Faza             | Co dostarcza                             | Kluczowe ryzyko                                        |
| ---------------- | ---------------------------------------- | ------------------------------------------------------ |
| 1. Visual assets | 3 screenshoty PNG w `docs/screenshots/`  | Live URL może być nieaktywny → fallback: `npm run dev` |
| 2. README.md     | Kompletny README w angielskim, 10 sekcji | CI badge URL wymaga sprawdzenia nazwy workflow file    |

**Wymagania wstępne:** Dostęp do działającej aplikacji (live URL lub lokalnie),
Node.js ≥22 + Supabase CLI dla lokalnego uruchomienia.

**Szacowany nakład pracy:** ~1 sesja (2 fazy), czysto dokumentacyjne — brak
zmian w kodzie.

## Otwarte ryzyka i założenia

- Live URL `https://osce-triager.kapix007.workers.dev` zakładamy aktywny — do
  weryfikacji w Fazie 1
- CI badge zakłada publiczne repozytorium na GitHub (GitHub Actions badge działa
  dla publicznych repo)
- Nazwa workflow file w badge URL: `ci.yml` (z `.github/workflows/ci.yml`) — do
  potwierdzenia przy budowaniu badge

## Kryteria sukcesu (podsumowanie)

- Rekruter otwiera repozytorium i w ciągu 30 sekund rozumie: co to jest, jak
  wygląda live, jakiego stacku używa
- CI badge renderuje się (nie jest broken image)
- Live URL z sekcji Demo prowadzi do działającej aplikacji
