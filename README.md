# KursN8N.pl 🇵🇱

**[kursn8n.pl](https://kursn8n.pl)** - otwarta wiki i darmowy kurs automatyzacji w n8n po polsku. Bez ściemy, bez logowania, za darmo.

Wiedza o n8n jest porozrzucana po wielu źródłach, a spora część materiałów to 15-20-minutowe filmy o czymś, co spokojnie da się opisać w kilku zdaniach. Ten kurs jest odwrotnością tego podejścia: jedno miejsce, w którym wszystko jest opisane jasno i po kolei, od pierwszego workflow po wdrożenia produkcyjne.

Nie chodzi o kopiowanie gotowych workflow "dla efektu". Nacisk jest na świadome budowanie: automatyzacje, które naprawdę działają, są bezpieczne, mają backup i przewidywalną obsługę błędów.


---

## Dla czytelników

Nie musisz nic instalować ani zakładać konta. Wejdź na [kursn8n.pl](https://kursn8n.pl) i zacznij.

| Chcesz… | Zacznij tutaj |
| --- | --- |
| Zrozumieć, czym jest n8n i czy warto | [Moduł 0 - Fundamenty automatyzacji](https://kursn8n.pl/modul-0-fundamenty) |
| Postawić własną instancję | [Moduł 1 - Instalacja i hosting](https://kursn8n.pl/modul-1-instalacja-hosting) |
| Zbudować pierwszy działający workflow | [Moduł 2 - Interfejs i pierwszy workflow](https://kursn8n.pl/modul-2-interfejs-pierwszy-workflow) |
| Dodać AI do automatyzacji | [Moduł 6 - AI i agenci](https://kursn8n.pl/modul-6-ai-agenci) |
| Wybrać hosting dla n8n | [Porównanie hostingów n8n](https://kursn8n.pl/porownanie-n8n-hostingow) |

Materiał to **9 modułów** (od fundamentów po produkcyjne wdrożenia) plus flagowy poradnik porównania hostingów n8n, który jest częścią Modułu 1. Menu boczne prowadzi przez cały program w kolejności nauki, więc można iść po kolei albo wskakiwać w moduł, który akurat jest potrzebny.

Analityka odwiedzin jest anonimowa (bez cookies śledzących, bez profilowania) - szczegóły na stronie [Prywatność i cookies](https://kursn8n.pl/prywatnosc).

## Jak to działa

Kurs jest **żywym wiki**. Cała treść to zwykłe pliki tekstowe (Markdown/MDX) w tym repozytorium. Każda zmiana przechodzi przez pull request i recenzję, a po zaakceptowaniu publikuje się automatycznie.

```text
edytujesz plik  →  pull request  →  recenzja  →  merge  →  na stronie
```

To znaczy, że historia każdego zdania jest jawna. Widać, kto co zmienił, kiedy i dlaczego - tak jak w Wikipedii, tylko o n8n i po polsku.

## Dla współtwórców

**Nie musisz być programistą.** Wystarczy konto na GitHubie i chęć podzielenia się tym, co wiesz o n8n.

### Dlaczego warto

Szczerze: **najwięcej zyskuje ten, kto pisze.** Żeby wytłumaczyć jakiś node albo wzorzec workflow prostym językiem, trzeba to najpierw naprawdę zrozumieć - a to najlepszy sposób nauki, jaki znam. Przy okazji:

- Twój tekst czyta ktoś, kto właśnie utknął przy własnym workflow. To realny wpływ, nie punkty w rankingu.
- Wkład jest podpisany i publiczny - historia commitów zostaje z Tobą.
- Projekt jest otwarty (CC BY-SA 4.0), więc nikt nie zamknie tego, co współtworzysz.

### Kogo szukamy

- osób, które **lubią pisać** i potrafią przekazać myśl jasno
- osób z doświadczeniem w n8n **na dowolnym poziomie** - praktycy mile widziani, wdrożenia z realnych projektów bywają cenniejsze od teorii
- osób, które mają ochotę **pomagać innym w nauce automatyzacji**

### Jak zacząć - najprostsza droga

1. Znajdź na stronie coś, co da się poprawić - literówkę, niejasny akapit, nieaktualną informację o node'ie czy wersji n8n.
2. Kliknij **"Edytuj stronę"** na dole artykułu. GitHub sam zaproponuje utworzenie kopii projektu.
3. Popraw tekst i kliknij **"Propose changes"** → **"Create pull request"**.
4. Napiszę Ci komentarz. Jeśli coś wymaga dopracowania, dostaniesz życzliwą podpowiedź, nie odrzucenie.

Nie czujesz się na siłach edytować? [Zgłoś issue](https://github.com/lukaszpodgorski-pl/kursn8n_pl/issues/new/choose) - są gotowe szablony na błąd, propozycję treści i nieaktualną informację.

Pełna instrukcja: **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

## Zasady

Cztery rzeczy, które decydują o przyjęciu zmiany:

1. **Piszemy dla kogoś, kto buduje automatyzacje.** Ton ciepły, bezpośredni (per "Ty"), ale bez lania wody - żargon n8n (node, workflow, trigger, webhook) jest językiem docelowym, objaśnianym przy pierwszym użyciu.
2. **Źródło jest obowiązkowe** przy każdej zmianie merytorycznej - nowym fakcie, liczbie, twierdzeniu (np. zachowanie node'a, cennik hostingu, wersja n8n). To nasza tarcza przeciw halucynacjom i nieaktualnym informacjom. Bez linku do źródła (dokumentacja n8n, changelog, oficjalna strona) zmiana nie wejdzie.
3. **Neutralność.** Opisujemy narzędzia i hostingi rzetelnie, z wadami i zaletami. Linki partnerskie (np. do hostingów) są zawsze oznaczone, a oceny są szczere niezależnie od programu partnerskiego.
4. **Po polsku.** Treść piszemy po polsku, z angielskimi terminami n8n podanymi w nawiasie przy pierwszym użyciu.

Do tego kilka konwencji technicznych (nazwy plików, formaty obrazów, obowiązkowy tekst alternatywny, zakaz GIF-ów) - wszystkie opisane w [CONTRIBUTING.md](./CONTRIBUTING.md) i sprawdzane automatycznie przy pull requeście.

## AI w tworzeniu tego kursu

**Duża część tej treści powstała przy wsparciu narzędzi AI** - i mówimy o tym wprost, bo trudno uczyć rzetelności, samemu ją pomijając. AI pomaga w szkicach, przeformułowaniach, porządkowaniu struktury i wyłapywaniu luk w materiale. **Nie zastępuje weryfikacji.** n8n zmienia się szybko - node'y, licencja, interfejs - dlatego każdy fakt, wersja i twierdzenie przechodzą przez sprawdzenie u źródła i przez człowieka, zanim trafią na stronę. Właśnie dlatego zasada o obowiązkowych źródłach jest tak sztywna.

Jeśli korzystasz z AI przy swoim wkładzie - w porządku, my też. Odpowiadasz za to, co wysyłasz, tak samo jakbyś napisał to od zera.

## Kto za tym stoi

Kurs prowadzi **Łukasz Podgórski** - konsultant AI i automatyzacji procesów, na co dzień projektuje i wdraża automatyzacje z n8n przy własnych i klienckich projektach (m.in. pod marką [aitomate.pl](https://aitomate.pl/)). Dzieli się wiedzą na [kanale YouTube](https://www.youtube.com/@lukaszpodgorski).

Kurs powstał z prostego powodu: brakowało po polsku materiału, który tłumaczy n8n świadomie - od fundamentów po produkcję - i nie każe ślepo kopiować cudzych workflow.

Więcej: [lukaszpodgorski.pl](https://lukaszpodgorski.pl/) · [aitomate.pl](https://aitomate.pl/)

---

## Dla programistów

Serwis to statyczna strona zbudowana na [Astro](https://astro.build/) + [Starlight](https://starlight.astro.build/), hostowana na Cloudflare Workers.

```bash
npm install
npm run dev        # serwer deweloperski na localhost:4321
npm run build      # build produkcyjny do ./dist/ - to jest nasz "test suite"
npm run preview    # podgląd builda
npm run verify:geo # asercje na zbudowanym dist/ (dane strukturalne, OG, sitemapa)
```

Nie ma frameworka testowego. `npm run build` jest pełnym sprawdzeniem - wykrywa złamane linki wewnętrzne, błędy frontmattera (schemat Zod) i błędy MDX.

### Struktura

```text
src/content/docs/             # cała treść - płaska struktura, bez podfolderów sekcji
├── index.mdx                 # strona główna
├── modul-0-fundamenty.mdx … modul-8-wzorce-wdrozenia.mdx
├── regulamin.md  prywatnosc.md
└── porownanie-n8n-hostingow.mdx   # flagowy poradnik (część Modułu 1, w przygotowaniu)
src/config/modules.ts           # rejestr 9 modułów - jedyne źródło prawdy dla sidebara,
                                 # kanału RSS i danych strukturalnych Course
src/assets/<moduł>/              # obrazy artykułów (Astro optymalizuje do WebP/AVIF)
public/media/                    # wideo i animacje (serwowane 1:1)
src/components/                  # ModuleHero, ConceptCard, Flow, Panel, Takeaways, Video…
src/lib/structured-data.ts       # generowanie JSON-LD z frontmattera
scripts/verify-geo.mjs           # harness weryfikacyjny
```

### Warto wiedzieć przed pierwszym PR-em

- **`trailingSlash: 'never'`** - żaden link wewnętrzny nie kończy się ukośnikiem (`/modul-0-fundamenty`, nie `/modul-0-fundamenty/`).
- **Struktura treści jest płaska** - nowy plik trafia bezpośrednio do `src/content/docs/`, bez folderu sekcji.
- **Nowy moduł nie pojawi się w menu**, dopóki nie dopiszesz go do [`src/config/modules.ts`](./src/config/modules.ts) - `astro.config.mjs` buduje z niego sidebar automatycznie.
- Pola GEO we frontmatterze (`educationalLevel`, `teaches`, `about`, `mentions`, `faq`) zasilają dane strukturalne schema.org. Schemat: [`src/content.config.ts`](./src/content.config.ts).

Szczegóły architektury i pułapki: [AGENTS.md](./AGENTS.md).

## Licencje

- **Treść** - [CC BY-SA 4.0](./LICENSE-CONTENT): możesz kopiować i przerabiać, podając autora i zachowując tę samą licencję.
- **Kod** - [MIT](./LICENSE).
- Font Noto Sans (generowanie obrazów OG) - [OFL-1.1](./src/pages/og/_fonts/OFL.txt).

Wysyłając pull request zgadzasz się na publikację swojego wkładu na tych licencjach.

---

Bieżące zadania i propozycje: [Issues](https://github.com/lukaszpodgorski-pl/kursn8n_pl/issues) · Masz pytanie albo pomysł? Napisz przez [lukaszpodgorski.pl](https://lukaszpodgorski.pl/).
