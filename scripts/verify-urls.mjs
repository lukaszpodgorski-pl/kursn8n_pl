/**
 * Regresja adresow: kazdy URL ze starej sitemapy musi miec odpowiadajacy
 * plik w dist/. Chroni decyzje o zachowaniu adresow 1:1 z poprzednia,
 * zaindeksowana wersja strony (migracja PHP -> Astro).
 *
 * Zrodlo prawdy: scripts/stara-sitemapa.xml - kopia sitemapy poprzedniej
 * strony (13 adresow), utrzymywana w repo jako fixture, zeby nie trzymac
 * calego starego zrodla PHP tylko dla tej jednej referencji.
 *
 * Uruchamiaj PO `npm run build`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITEMAP = join(ROOT, 'scripts', 'stara-sitemapa.xml');
const DIST = join(ROOT, 'dist');

if (!existsSync(DIST)) {
	console.error('BLAD: brak katalogu dist/. Uruchom najpierw `npm run build`.');
	process.exit(1);
}

if (!existsSync(SITEMAP)) {
	console.error(`BLAD: brak ${SITEMAP} - nie ma z czym porownac.`);
	process.exit(1);
}

const xml = readFileSync(SITEMAP, 'utf8');
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (locs.length === 0) {
	console.error('BLAD: stara sitemapa nie zawiera zadnego <loc>.');
	process.exit(1);
}

/**
 * Adres -> oczekiwany plik w dist/. Oba ksztalty sa akceptowane CELOWO.
 *
 * O fizycznym ksztalcie pliku decyduje `build.format`, NIE `trailingSlash`.
 * Przy domyslnym `build.format: "directory"` Astro generuje wylacznie
 * /modul-0-fundamenty/index.html - wariant /modul-0-fundamenty.html
 * powstalby dopiero przy `build.format: "file"`.
 *
 * Nie zawezaj tego do jednego wariantu. Cloudflare z ustawionym
 * `html_handling: "drop-trailing-slash"` (wrangler.jsonc) serwuje OBA
 * ksztalty pod tym samym adresem /modul-0-fundamenty, bez przekierowania -
 * sa wiec nierozroznialne dla klienta i dla wyszukiwarki.
 *
 * UWAGA na zakres tego harnessu: sprawdza on istnienie plikow w dist/,
 * wiec nie wykryje regresji, ktora zachodzi wylacznie w konfiguracji
 * serwowania (html_handling) albo w linkach kanonicznych (trailingSlash) -
 * zadna z nich nie zmienia zawartosci dist/.
 */
function expectedFiles(pathname) {
	if (pathname === '/' || pathname === '') return [join(DIST, 'index.html')];
	const clean = pathname.replace(/^\/+|\/+$/g, '');
	return [join(DIST, `${clean}.html`), join(DIST, clean, 'index.html')];
}

const missing = [];
for (const loc of locs) {
	const { pathname } = new URL(loc);
	const candidates = expectedFiles(pathname);
	if (!candidates.some((f) => existsSync(f))) {
		missing.push({ pathname, candidates });
	}
}

console.log(`Sprawdzono ${locs.length} adresow ze starej sitemapy.`);

if (missing.length > 0) {
	console.error(`\nBRAKUJE ${missing.length} adresow w dist/:`);
	for (const m of missing) {
		console.error(`  ${m.pathname}`);
		for (const c of m.candidates) {
			console.error(`     szukano: ${c.replace(ROOT, '.')}`);
		}
	}
	process.exit(1);
}

console.log('OK - wszystkie adresy ze starej sitemapy istnieja w dist/.');
