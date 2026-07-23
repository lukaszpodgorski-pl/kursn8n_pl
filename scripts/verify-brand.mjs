// Precyzyjna asercja czystosci marki na zbudowanym dist/.
//
// KONTEKST: poprzednia wersja tej asercji byla slepym regexem
// (`Select-String -Path dist\*.html -Pattern 'przewodnikai|Przewodnik AI'`
// z wymogiem pustego wyniku). Nie odrozniala prawdziwego wycieku starej marki
// od poprawnego uzycia: `AUTHOR.sameAs` w src/lib/structured-data.ts CELOWO
// zawiera 'https://przewodnikai.pl' - to inna, prawdziwa domena tego samego
// autora (patrz public_html/includes/entity-graph.php, wezel #person),
// a `sameAs` to wlasnie mechanizm, ktorym wyszukiwarki lacza rozne wlasnosci
// jednej osoby. Slepy regex kazalby usunac ten wpis, osłabiajac graf encji.
//
// Ten skrypt zaglada w strukture JSON-LD: jedyne miejsce, w ktorym string
// zawierajacy "przewodnikai"/"Przewodnik AI" jest legalny, to wpis w tablicy
// `sameAs` obiektu typu `Person` (autor). Kazde inne wystapienie - w innym
// polu JSON-LD (np. `name` encji WebSite, `image`) albo poza JSON-LD (tytul
// strony, `og:image`, `og:image:alt`, link do `llms.txt`, dowolny widoczny
// tekst) - jest prawdziwym wyciekiem starej marki i konczy skrypt kodem 1.
//
// POPRAWKA (recenzja Zadania 6): pierwotna wersja skanowala wylacznie pliki
// `.html`, wiec przegapila zywy wyciek w `dist/robots.txt` (dyrektywa
// `Sitemap:` wskazujaca na sitemape przewodnikai.pl). Skaner obejmuje teraz
// wszystkie tekstowe pliki generowane do dist/ (patrz TEXT_EXTENSIONS nizej),
// nie tylko `.html`. Binaria (obrazy, fonty, indeksy pagefind) sa pomijane
// po rozszerzeniu - nigdy nie probujemy odczytac ich jako tekst UTF-8.
//
// Uruchamiaj PO `npm run build`.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';

// Rozszerzenia plikow, ktore traktujemy jako tekst i skanujemy w poszukiwaniu
// wycieku marki. Celowa allowlista (nie blocklista binariow) - jesli w dist/
// pojawi sie nieznany format (np. wlasne binarne indeksy pagefind: .pf_index,
// .pf_fragment, .pf_meta, .pagefind), domyslnie go NIE czytamy, zamiast
// zgadywac po rozszerzeniu, ze jest bezpieczny. Wsrod tekstowych: `.html`
// (strony), `.txt` (robots.txt, llms*.txt), `.xml` (sitemapy), `.json`
// (np. pagefind-entry.json), `.webmanifest` (site.webmanifest), `.svg`
// (favicon.svg - moze zawierac <title>/<desc>), `.css`/`.js` (zbundlowane
// zasoby - tez moga zaszyc string marki, np. w skrypcie klienckim).
const TEXT_EXTENSIONS = new Set([
	'.html',
	'.txt',
	'.xml',
	'.json',
	'.webmanifest',
	'.svg',
	'.css',
	'.js',
]);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// "przewodnikai" lapie domene (przewodnikai.pl) i wszelkie zlepione warianty
// nazwy; "przewodnik ai" (z dowolna liczba bialych znakow) lapie nazwe marki
// pisana z rozdzielonymi slowami ("Przewodnik AI"). Flaga /i - regul spelnia
// sie niezaleznie od wielkosci liter, tak jak domyslne dopasowanie
// Select-String w poprzedniej, slepej wersji tej asercji.
const BRAND_RE = /przewodnikai|przewodnik\s+ai/i;

if (!existsSync(DIST)) {
	console.error('BLAD: brak katalogu dist/. Uruchom najpierw `npm run build`.');
	process.exit(1);
}

function walkTextFiles(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walkTextFiles(full));
		else if (TEXT_EXTENSIONS.has(extname(name).toLowerCase())) out.push(full);
	}
	return out;
}

const files = walkTextFiles(DIST);

// BEZPIECZNIK: pusty wynik nie moze cichutko przejsc jako sukces. Brak
// katalogu dist/ jest juz zlapany wyzej; to lapie przypadek, gdy dist/
// istnieje, ale jest pusty albo nie zawiera zadnego rozpoznanego pliku
// tekstowego (np. przerwany build) - bez tego skrypt zwrocilby kod 0 nie
// sprawdzajac niczego.
if (files.length === 0) {
	console.error(
		`BLAD: ${DIST} nie zawiera zadnego pliku tekstowego (${[...TEXT_EXTENSIONS].join(', ')}) - nie ma czego sprawdzic.`,
	);
	process.exit(1);
}

/**
 * Wyciaga bloki JSON-LD z tresci pliku i parsuje je (ten sam wzorzec co
 * scripts/verify-geo.mjs). Pliki inne niz .html (robots.txt, sitemapy, ...)
 * nie zawieraja znacznika `<script>`, wiec zwracaja po prostu pusta liste.
 */
function jsonLdBlocks(content) {
	const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
	const blocks = [];
	let m;
	while ((m = re.exec(content)) !== null) blocks.push(JSON.parse(m[1]));
	return blocks;
}

/** Usuwa bloki JSON-LD - reszta pliku (meta tagi, tytul, linki, dyrektywy) sprawdzana osobno nizej. */
function stripJsonLd(content) {
	return content.replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, '');
}

/**
 * Rekurencyjnie przeszukuje drzewo JSON-LD w poszukiwaniu stringow pasujacych
 * do BRAND_RE. `parentKey` to klucz, pod ktorym biezaca wartosc siedzi w swoim
 * bezposrednim rodzicu; `ownerType` to `@type` tego rodzica (jesli jest
 * obiektem). Legalny jest wylacznie string wewnatrz tablicy `sameAs`, gdy
 * obiekt-wlasciciel tej tablicy ma `'@type': 'Person'` - to jest dokladnie
 * "wpis w tablicy sameAs wewnatrz obiektu autora".
 */
function findJsonLdLeaks(node, parentKey, ownerType, path, out) {
	if (Array.isArray(node)) {
		for (const item of node) findJsonLdLeaks(item, parentKey, ownerType, path, out);
		return;
	}
	if (node && typeof node === 'object') {
		const type = node['@type'];
		for (const [key, value] of Object.entries(node)) {
			findJsonLdLeaks(value, key, type, `${path}.${key}`, out);
		}
		return;
	}
	if (typeof node === 'string' && BRAND_RE.test(node)) {
		const isLegitSameAs = parentKey === 'sameAs' && ownerType === 'Person';
		out.push({ path, value: node, legit: isLegitSameAs });
	}
}

const leaks = [];
let legitCount = 0;

for (const file of files) {
	const content = readFileSync(file, 'utf8');
	const rel = file.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '');

	const jsonLdMatches = [];
	for (const block of jsonLdBlocks(content)) {
		findJsonLdLeaks(block, null, null, 'json-ld', jsonLdMatches);
	}
	for (const match of jsonLdMatches) {
		if (match.legit) {
			legitCount++;
		} else {
			leaks.push(`${rel}: JSON-LD ${match.path} = "${match.value}"`);
		}
	}

	// Reszta pliku (poza JSON-LD): tu nie istnieje zaden legalny powod, zeby
	// "przewodnikai"/"Przewodnik AI" sie pojawily - sameAs jest polem danych,
	// nie widoczna trescia, dyrektywa robots.txt ani atrybutem meta/link.
	const rest = stripJsonLd(content);
	const restMatch = rest.match(BRAND_RE);
	if (restMatch) {
		const start = Math.max(0, restMatch.index - 40);
		const end = Math.min(rest.length, restMatch.index + restMatch[0].length + 40);
		leaks.push(`${rel}: poza JSON-LD - "...${rest.slice(start, end).trim()}..."`);
	}
}

if (leaks.length > 0) {
	console.error(`WYCIEK MARKI: ${leaks.length} wystapien "przewodnikai"/"Przewodnik AI" poza`);
	console.error('legalnym uzyciem w AUTHOR.sameAs:');
	for (const leak of leaks) console.error(`  ${leak}`);
	console.error(
		'\nJesli to naprawde inna domena autora w sameAs, upewnij sie, ze wpis siedzi' +
			" wewnatrz tablicy 'sameAs' obiektu '@type': 'Person' - tylko tam skrypt go akceptuje.",
	);
	process.exit(1);
}

console.log(`Sprawdzono ${files.length} plikow tekstowych w dist/.`);
console.log(
	`OK - brak wycieku marki przewodnikai.pl. Znaleziono ${legitCount} legalnych wystapien` +
		" w AUTHOR.sameAs (Person.sameAs) - skrypt je rozpoznal i pominal, zamiast slepo raportowac.",
);
