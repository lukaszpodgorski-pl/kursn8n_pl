# AGENTS.md

Wskazówki dla agentów AI (Claude Code i pokrewnych) pracujących w tym repozytorium.

> `CLAUDE.md` w katalogu głównym jest symlinkiem do tego pliku - edytuj `AGENTS.md`. Sam symlink jest w `.gitignore` i celowo nie trafia do repo.

## Czym jest ten projekt

[kursn8n.pl](https://kursn8n.pl) - otwarta wiki i darmowy kurs automatyzacji w n8n po polsku, zbudowany na **Astro 7 + Starlight**, hostowany na **Cloudflare Workers** (static assets, konfiguracja w `wrangler.jsonc`). Model pracy: "żywe wiki" - treść w Markdownie/MDX, zmiany przez pull requesty, publikacja automatyczna.

**To repozytorium treści, nie aplikacji.** Program kursu to **9 modułów** (`modul-0-fundamenty` … `modul-8-wzorce-wdrozenia`) plus poradnik `porownanie-n8n-hostingow` (część Modułu 1, `GUIDE_SLUG` w `src/config/modules.ts`), w `src/content/docs/`. W przeciwieństwie do typowego Starlighta struktura jest **płaska** - żadnych podfolderów sekcji, każdy plik leży bezpośrednio w `src/content/docs/`. Kilkanaście własnych komponentów (`ModuleHero.astro`, `ConceptCard.astro`, `Flow.astro`/`FlowNode.astro`, `Panel.astro`, `Takeaways.astro`, `TwoCol.astro`, `Faq.astro`, `Footer.astro`, `Video.astro`), zero logiki biznesowej i zero testów jednostkowych. Większość zadań to edycja Markdowna/MDX.

## Komendy

```powershell
npm install
npm run dev        # localhost:4321
npm run build      # build produkcyjny do ./dist/ - to jest nasz "test suite"
npm run preview    # podgląd builda
```

Weryfikacja przed commitem (te same kroki co CI, uruchamiane lokalnie):

```powershell
npm run build
npx --yes markdownlint-cli2 "src/content/**/*.md" "*.md"
```

Nie ma frameworka testowego. `npm run build` jest jedynym pełnym sprawdzeniem - wykrywa złamane linki wewnętrzne, błędy frontmattera (schemat Zod) i błędy MDX.

Serwer deweloperski uruchamiaj w tle: `astro dev --background`; zarządzanie: `astro dev stop`, `astro dev status`, `astro dev logs`.

## CI (GitHub Actions)

| Workflow | Kiedy | Co sprawdza |
| --- | --- | --- |
| `lint.yml` | zmiany w `**/*.md(x)` | markdownlint-cli2 wg `.markdownlint.jsonc` |
| `links.yml` | PR + cotygodniowy cron | lychee - linki zewnętrzne i wewnętrzne |
| `media.yml` | zmiany w `src/assets/**`, `public/media/**` | obraz ≤ 1 MB, wideo ≤ 5 MB, **GIF-y odrzucane** |
| `verify-geo.yml` | push na `main` + PR | `npm run verify:geo` - dane strukturalne, obrazy OG, sitemapa na zbudowanym `dist/` |

Każdy PR wymaga akceptacji code ownera (`.github/CODEOWNERS`).

## Architektura

### Routing i treść

Jedna kolekcja `docs` (`src/content.config.ts`) ładowana przez `docsLoader()` Starlight. **Struktura plików jest płaska** - `index.mdx` (strona główna), dziewięć plików `modul-N-*.mdx`, `regulamin.md` i `prywatnosc.md` (plus kilka stron formularza newslettera: `zapisano.md`, `potwierdz-email.md`, `juz-zapisany.md`, `wypisano.md`) leżą bezpośrednio w `src/content/docs/`, bez podfolderów sekcji. Poradnik `porownanie-n8n-hostingow` (`GUIDE_SLUG`) jest w sidebarze i w `src/content/docs/`. Sidebar **nie jest autogenerowany** - `astro.config.mjs` buduje go wprost z rejestru `MODULES` (`src/config/modules.ts`), które jest jedynym źródłem prawdy dla kolejności i etykiet modułów w menu, w kanale RSS i w danych strukturalnych `Course` (`src/lib/structured-data.ts`). **Nowy moduł nie pojawi się w menu, dopóki nie dopiszesz go do `MODULES`** - dopisanie samo w sobie wystarcza, `astro.config.mjs` czyta stamtąd automatycznie.

### Pułapki, o które łatwo się potknąć

1. **`trailingSlash: 'never'`** - wszystkie linki wewnętrzne muszą kończyć się BEZ ukośnika (`/modul-0-fundamenty`, nie `/modul-0-fundamenty/`). To odwrotność domyślnego zachowania Starlighta i celowa decyzja: zachowuje adresy 1:1 ze starą sitemapą PHP (`public_html/sitemap.xml`). `wrangler.jsonc` dopełnia to ustawieniem `html_handling: "drop-trailing-slash"` po stronie Cloudflare Workers.
2. **`public/_redirects`** - mapa 301 ze starych płaskich adresów `.html` (np. `/modul-0-fundamenty.html`) na czyste URL-e. Reguły dotyczą wyłącznie sufiksu `.html` z poprzedniej strony PHP - przy płaskiej strukturze nie ma ryzyka kolizji z folderami sekcji (nie istnieją), ale przy zmianie slugu modułu pamiętaj o dopisaniu przekierowania.
3. **Rejestr modułów jest jednym źródłem prawdy** - `src/config/modules.ts` (pole `MODULES` i `GUIDE_SLUG`) zasila jednocześnie sidebar, RSS i JSON-LD `Course`. Zmiana kolejności, etykiety czy opisu modułu wymaga edycji tylko tego pliku - nie astro.config.mjs.

### Frontmatter GEO/AEO

`src/content.config.ts` rozszerza `docsSchema()` o pola pod dane strukturalne: `educationalLevel`, `teaches`, `datePublished`, `about[]`, `mentions[]`, `faq[]`, `faqHidden`. Generowanie `<script type="application/ld+json">` jest zaimplementowane w `src/lib/structured-data.ts` i wstrzykiwane przez `src/components/Head.astro`. Dodając nowy artykuł, uzupełnij te pola wzorem istniejących modułów (np. `src/content/docs/modul-0-fundamenty.mdx`).

### Media

- **Obrazy:** `src/assets/<moduł>/`, osadzane zwykłym Markdownem po ścieżce względnej - Astro optymalizuje je do WebP/AVIF.
- **Wideo:** `public/media/<moduł>/`, serwowane 1:1, osadzane komponentem `<Video />` (`src/components/Video.astro` - WebM + fallback MP4, respektuje `prefers-reduced-motion`).
- **GIF-y są zakazane** i odrzucane przez CI. Komendy konwersji ffmpeg: `CONTRIBUTING.md`.
- `alt` jest obowiązkowy przy każdym obrazie i animacji.

### Cloudflare / build

`wrangler.jsonc` serwuje statyczne `./dist`. W `astro.config.mjs` blok `vite.build.rolldownOptions.external` wyrzuca `@bruits/satteri-wasm32-wasi` z bundla - **nie usuwaj tego**, bez tego build na Cloudflare pada (opcjonalna zależność `cpu: ["wasm32"]` nigdy się nie instaluje, a bundler próbuje ją rozwiązać).

`starlight-llms-txt` generuje `llms.txt`. `public/robots.txt` świadomie wpuszcza wszystkie crawlery AI (GPTBot, ClaudeBot, PerplexityBot itd.).

**Wdrożenie następuje przy merge'u do `main`.** Cloudflare Workers Builds ma ustawioną gałąź produkcyjną `main`, a buildy gałęzi nieprodukcyjnych są wyłączone - push gałęzi roboczej nie wdraża niczego na żywą domenę. Konfiguracja siedzi w panelu Cloudflare, więc nie da się jej wyczytać z repo; `wrangler.jsonc` opisuje tylko route'y.

Dzięki temu bramka PR działa tak, jak powinna: `verify-geo.yml` odpala się na `pull_request`, czyli **przed** wdrożeniem. Gdyby ktoś kiedyś włączył buildy gałęzi nieprodukcyjnych, ta kolejność się odwróci i weryfikacja zacznie biegać po fakcie.

## Konwencje treści

Grupa docelowa: **osoby techniczno-praktyczne, budujące automatyzacje**. Ton ciepły, bezpośredni (per "Ty"), ale bez lania wody - żargon n8n (node, workflow, trigger, webhook, credentials) to język docelowy, objaśniany w nawiasie przy pierwszym użyciu. Głos autora w pierwszej osobie.

Typografia:

- **Pauza to zwykły dywiz `-`** - nie `—` ani `–`.
- **Cudzysłowy proste `"…"`** - nie `„…”` ani `“…”`.
- Separator tysięcy: spacja (`50 000`); przecinek dziesiętny (`1,5 h`).

Ta konwencja obowiązuje też w plikach repo (`AGENTS.md`, `README.md`, `CONTRIBUTING.md`), nie tylko w artykułach.

Markdown:

- Kursywa podkreślnikami `_kursywa_`, bold gwiazdkami `**bold**` (MD049/MD050).
- Wyróżnienia przez asides Starlight (`:::tip`, `:::note`, `:::caution`, `:::danger`), nie własny HTML.
- Nazwy plików: małe litery, myślniki, bez polskich znaków.
- Zmiany merytoryczne (wersje n8n, zachowanie node'ów, ceny hostingów, licencje) wymagają linku do źródła - to zabezpieczenie przeciw halucynacjom. Pisząc o świecie zewnętrznym (dokumentacja n8n, cenniki, regulaminy) zweryfikuj u źródła zamiast polegać na wiedzy modelu - n8n zmienia się szybko.

## Dokumentacja

Pełna dokumentacja: <https://docs.astro.build>

- [Trasy, strony, middleware](https://docs.astro.build/en/guides/routing/)
- [Komponenty Astro](https://docs.astro.build/en/basics/astro-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Style i Tailwind](https://docs.astro.build/en/guides/styling/)
- [Starlight](https://starlight.astro.build/)
