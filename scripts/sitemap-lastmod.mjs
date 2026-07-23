// Mapa URL -> data ostatniej zmiany pliku wg git, dla pola <lastmod> w sitemapie.
// Cloudflare (i CI) mogą klonować repo płytko - nie tylko `--depth=1`, ale też
// z umiarkowaną głębokością (np. `--depth=50`), gdzie commit dotykający
// starszego pliku wypada poza pobrane okno. W takim wypadku `git log -1 --
// <plik>` kończy się kodem 0 i pustym wyjściem, więc licznik commitów (`git
// rev-list --count HEAD > 1`) niczego by nie wykrył - repo "ma historię", tylko
// niekompletną dla części plików. Dlatego testem jest `git rev-parse
// --is-shallow-repository`, które wykrywa płytki klon dowolnej głębokości.
// Bez pełnej historii zwracamy pustą mapę, a `serialize` pomija <lastmod>
// całkowicie. Sygnał nieobecny jest uczciwy; sygnał częściowy (część z 55
// stron ma <lastmod>, część nie) - nie jest, a spec sitemap.xml wprost tego
// zabrania.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DOCS = join('src', 'content', 'docs');

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (name.endsWith('.md') || name.endsWith('.mdx')) out.push(full);
	}
	return out;
}

/**
 * src/content/docs/modul-0-fundamenty.mdx -> /modul-0-fundamenty ; index.mdx -> /
 *
 * Bez koncowego ukosnika (poza korzeniem) - projekt ma `trailingSlash: 'never'`,
 * a `serialize()` w astro.config.mjs dopasowuje klucze po `new URL(item.url).pathname`,
 * ktore Astro generuje rowniez bez koncowego ukosnika. Klucz z ukosnikiem nigdy by
 * nie trafil, wiec kazda strona poza strona glowna gubila <lastmod>.
 */
function urlFor(file) {
	const rel = relative(DOCS, file).replace(/\.mdx?$/, '');
	const parts = rel.split(sep);
	if (parts[parts.length - 1] === 'index') parts.pop();
	return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

function isShallowClone() {
	try {
		const out = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
		// Polecenie zwraca dosłowny łańcuch "true" albo "false" - wszystko inne
		// (np. pusty ciąg) traktujemy ostrożnie, jako brak pewności co do pełnej
		// historii, więc tak samo jak płytki klon.
		return out !== 'false';
	} catch {
		// Brak gita albo katalog spoza repozytorium - jak dotychczas, brak
		// pewności co do historii oznacza pominięcie <lastmod>.
		return true;
	}
}

export function lastModMap() {
	const map = new Map();
	if (isShallowClone()) {
		console.warn('[sitemap] Płytki klon (albo brak historii git) - pomijam <lastmod> w sitemapie.');
		return map;
	}
	for (const file of walk(DOCS)) {
		try {
			const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'ignore'],
			}).trim();
			if (iso) map.set(urlFor(file), iso);
		} catch {
			// Plik bez historii (np. nowy, niezacommitowany) - pomijamy.
		}
	}
	return map;
}
