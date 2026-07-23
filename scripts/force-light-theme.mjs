// Integracja Astro (hook `astro:build:done`) - wymusza data-theme="light" na
// statycznym znaczniku <html> w kazdym zbudowanym pliku HTML.
//
// KONTEKST: Starlight renderuje ten atrybut na sztywno jako "dark" w
// node_modules/@astrojs/starlight/components/Page.astro:
//   const htmlDataAttributes: DOMStringMap = { 'data-theme': 'dark' };
// `Page.astro` NIE jest czescia oficjalnego mechanizmu nadpisywania
// komponentow: schemat `ComponentConfigSchema()` w
// node_modules/@astrojs/starlight/schemas/components.ts w ogole go nie
// wymienia, a `node_modules/@astrojs/starlight/routes/common.astro` importuje
// go bezposrednio z relatywnej sciezki (`import Page from
// '../components/Page.astro'`), a nie przez `virtual:starlight/components/Page`
// jak pozostale nadpisywalne komponenty. Efekt: nadpisanie ThemeProvider.astro
// i ThemeSelect.astro (patrz src/components/) naprawia motyw domyslny PO
// wykonaniu JS w przegladarce, ale nie ma zadnego wplywu na surowy,
// wygenerowany HTML - ten zawsze dostanie data-theme="dark" z Page.astro.
//
// Ten hook jest jedynym miejscem, w ktorym da sie to naprawic bez edycji
// node_modules: dziala na wyjsciu builda (`dist/`), wiec klienci bez JS i
// crawlery (ktorzy nigdy nie wykonaja skryptu z ThemeProvider.astro) dostana
// jasny motyw juz w surowym HTML-u - zgodnie ze specyfikacja ("Tozsamosc
// wizualna": jasny jest domyslny).
//
// Podmieniany jest wylacznie doslowny ciag `data-theme="dark"`. W zbudowanym
// HTML-u to jedyne miejsce, gdzie wystepuje on jako atrybut (skrypty inline
// ThemeProvider/ThemeSelect ustawiaja `dataset.theme = ...`, nie zapisuja
// tego ciagu), wiec podmiana jest jednoznaczna - zweryfikowane per plik
// (dokladnie jedno wystapienie w dist/index.html i dist/404.html).
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const TARGET = 'data-theme="dark"';
const REPLACEMENT = 'data-theme="light"';

function walkHtmlFiles(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walkHtmlFiles(full));
		else if (name.endsWith('.html')) out.push(full);
	}
	return out;
}

export function forceLightTheme() {
	return {
		name: 'force-light-theme',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const root = fileURLToPath(dir);
				const files = walkHtmlFiles(root);
				let changed = 0;

				for (const file of files) {
					const html = readFileSync(file, 'utf8');
					if (html.includes(TARGET)) {
						writeFileSync(file, html.replace(TARGET, REPLACEMENT));
						changed++;
					}
				}

				// BEZPIECZNIK. Ta integracja opiera sie na szczegole implementacyjnym
				// Starlighta (doslowny ciag `data-theme="dark"` z Page.astro). Gdyby
				// Starlight zmienil sposob renderowania tego atrybutu - np. po
				// aktualizacji wersji - podmiana przestalaby cokolwiek znajdowac
				// i po cichu wrocilibysmy do ciemnego motywu wbrew specyfikacji.
				// Zero podmian przy niepustym buildzie oznacza wlasnie taka sytuacje,
				// wiec przerywamy build zamiast wdrazac zly motyw.
				if (files.length > 0 && changed === 0) {
					throw new Error(
						`force-light-theme: nie znaleziono "${TARGET}" w zadnym z ${files.length} ` +
							'plikow HTML. Starlight prawdopodobnie zmienil sposob renderowania ' +
							'atrybutu data-theme. Sprawdz Page.astro w @astrojs/starlight ' +
							'i zaktualizuj ten skrypt - inaczej strona wdrozy sie w ciemnym ' +
							'motywie, wbrew specyfikacji.',
					);
				}

				// Druga asercja: po podmianie nie moze zostac ANI JEDEN plik z ciemnym
				// motywem. Lapie przypadek czesciowego dopasowania (np. gdyby Starlight
				// zaczal renderowac ten atrybut w wiecej niz jednym miejscu na stronie).
				const stillDark = files.filter((f) => readFileSync(f, 'utf8').includes(TARGET));
				if (stillDark.length > 0) {
					throw new Error(
						`force-light-theme: po podmianie ${stillDark.length} plikow nadal zawiera ` +
							`"${TARGET}": ${stillDark.slice(0, 5).join(', ')}`,
					);
				}

				logger.info(`Ustawiono ${REPLACEMENT} w ${changed} z ${files.length} plikow HTML.`);
			},
		},
	};
}
