// Asercje GEO/AEO/SEO na zbudowanym katalogu dist/.
// Repo nie ma frameworka testowego - ten skrypt pełni tę rolę dla danych
// strukturalnych, FAQ, obrazów OG i sitemapy.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const SRC_DOCS = join('src', 'content', 'docs');
// Musi być zgodne z SITE_URL w src/lib/structured-data.ts.
const SITE_URL = 'https://kursn8n.pl';
const results = [];

/**
 * Rozpoznaje artykuły kursu (moduły + flagowy poradnik) po konwencji
 * nazewniczej sluga - moduły to `modul-<numer>-<opis>`, poradnik ma stały
 * slug `porownanie-n8n-hostingow` (patrz AGENTS.md). Celowo NIE importujemy
 * tu `src/config/modules.ts` (`MODULES`/`MODULE_SLUGS`/`GUIDE_SLUG`), z
 * którego korzysta Head.astro do tej samej klasyfikacji - ten skrypt
 * uruchamia się zwykłym `node scripts/verify-geo.mjs`, bez bundlera i bez
 * gwarancji, że każde środowisko CI ma włączone domyślne "strip types" dla
 * TypeScriptu, więc wzorzec sluga trzyma harness dependency-free i
 * deterministyczny. Kompromis: jeśli konwencja nazewnicza modułów kiedyś się
 * zmieni, trzeba zaktualizować `MODULE_SLUG_RE` razem z `src/config/modules.ts`
 * (tak samo jak SITE_URL powyżej musi ręcznie nadążać za structured-data.ts).
 */
const MODULE_SLUG_RE = /^modul-\d+-[a-z0-9-]+$/;
const GUIDE_SLUG = 'porownanie-n8n-hostingow';

function isArticleSlug(slug) {
	return MODULE_SLUG_RE.test(slug) || slug === GUIDE_SLUG;
}

function check(name, fn) {
	try {
		const detail = fn();
		results.push({ name, ok: true, detail });
	} catch (err) {
		results.push({ name, ok: false, detail: err.message });
	}
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

/** Wszystkie pliki index.html pochodzące z kolekcji docs (bez 404.html). */
function collectionPages() {
	const out = [];
	(function walk(dir) {
		for (const name of readdirSync(dir)) {
			const full = join(dir, name);
			if (statSync(full).isDirectory()) {
				if (name === '_astro' || name === 'pagefind' || name === 'og') continue;
				walk(full);
			} else if (name === 'index.html') {
				out.push(full);
			}
		}
	})(DIST);
	return out;
}

/**
 * Wszystkie pliki .md/.mdx w katalogu treści, które faktycznie staną się
 * stroną - źródło prawdy dla liczby stron w dist. Pliki i foldery z
 * przedrostkiem podkreślenia (`_`) pomijamy: to udokumentowana konwencja
 * Astro bezwarunkowo wykluczająca ścieżkę z routingu i z kolekcji treści
 * (ten sam mechanizm, co `src/pages/og/_fonts` w astro.config.mjs) - bez
 * tego wyjątku dodanie roboczego/szkicowego pliku z tym przedrostkiem
 * fałszywie zgłaszałoby rozjazd źródło/dist, mimo że build celowo go pomija.
 */
function sourceDocFiles() {
	const out = [];
	(function walk(dir) {
		for (const name of readdirSync(dir)) {
			if (name.startsWith('_')) continue;
			const full = join(dir, name);
			if (statSync(full).isDirectory()) {
				walk(full);
			} else if (/\.(md|mdx)$/.test(name)) {
				out.push(full);
			}
		}
	})(SRC_DOCS);
	return out;
}

/** Wyciąga blok frontmatteru (między parą `---`) z treści pliku źródłowego. */
function frontmatterOf(content) {
	const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return m ? m[1] : '';
}

/**
 * Czy plik ma we frontmatterze pole `faq:` - proste dopasowanie tekstowe
 * (klucz na początku linii), bez parsera YAML jako dodatkowej zależności.
 */
function hasFaqField(content) {
	return /^faq:/m.test(frontmatterOf(content));
}

/** Wyciąga wszystkie bloki JSON-LD ze strony i parsuje je. */
function jsonLdBlocks(html) {
	const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
	const blocks = [];
	let m;
	while ((m = re.exec(html)) !== null) blocks.push(JSON.parse(m[1]));
	return blocks;
}

/** Spłaszcza bloki JSON-LD strony do listy węzłów, rozwijając `@graph`. */
function nodesIn(html) {
	const nodes = [];
	for (const block of jsonLdBlocks(html)) {
		if (Array.isArray(block['@graph'])) nodes.push(...block['@graph']);
		else nodes.push(block);
	}
	return nodes;
}

/** Zbiera wartości @type ze wszystkich bloków, także z @graph. */
function typesIn(html) {
	return new Set(nodesIn(html).map((node) => node['@type']).filter(Boolean));
}

/**
 * URL strony na podstawie ścieżki pliku, np. dist/modul-0-fundamenty/index.html
 * -> /modul-0-fundamenty. Bez końcowego ukośnika - `trailingSlash: 'never'`
 * w astro.config.mjs - jedyny wyjątek to korzeń domeny ('/').
 */
function urlOf(file) {
	const rel = relative(DIST, file).split(sep).slice(0, -1).join('/');
	return rel === '' ? '/' : `/${rel}`;
}

/** Pierwszy segment URL-a (slug), albo undefined dla korzenia. */
function firstSegment(url) {
	return url.split('/').filter(Boolean)[0];
}

/** Usuwa bloki JSON-LD ze strony - potrzebne, żeby sprawdzać widoczną treść
 * niezależnie od tego, co jest zakodowane w danych strukturalnych (inaczej
 * tekst z JSON-LD "potwierdzałby sam siebie" jako treść widoczna). */
function stripJsonLd(html) {
	return html.replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, '');
}

/**
 * Dekoduje garść encji HTML, które faktycznie występują w wyjściu Astro
 * (np. `"` w tekście węzła renderuje się jako `&quot;`, inaczej niż surowy
 * `"` w JSON-LD wstawianym przez `set:html`). Bez tego porównanie pytania
 * z frontmattera (proste `"`) do widocznego tekstu (`&quot;`) fałszywie by
 * się nie zgadzało, mimo że to ten sam znak. Nie jest to pełny dekoder
 * encji HTML - tylko te, które realnie pojawiają się w tej treści.
 */
function decodeEntities(text) {
	return text
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&');
}

/** Płaski tekst widoczny dla czytelnika - bez bloków JSON-LD, bez znaczników HTML i bez encji. */
function visibleText(html) {
	return decodeEntities(stripJsonLd(html).replace(/<[^>]+>/g, ' '));
}

/**
 * Ujednolica cudzysłowy/apostrofy i białe znaki. Markdown renderuje proste
 * cudzysłowy ze źródła jako typograficzne w niektórych kontekstach, więc
 * porównanie tekstu pytania z frontmattera do HTML nie może zależeć od tego,
 * który wariant znaku aktualnie renderuje Astro.
 */
function normalizeForMatch(text) {
	return text
		.replace(/["'‘’“”„«»]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Rekurencyjnie zbiera wartości wszystkich pól o podanych kluczach
 * z dowolnie zagnieżdżonego obiektu/tablicy JSON-LD (np. `item` występuje
 * zarówno bezpośrednio w bloku, jak i zagnieżdżone w `itemListElement`).
 * Pole `url` na encji `Person` jest celowym wyjątkiem - to zewnętrzna
 * strona domowa autora (AUTHOR.url), a nie adres wygenerowany przez
 * `absoluteUrl()`, więc nie podlega wymogowi domeny/ukośnika.
 */
function collectFieldValues(node, keys, out) {
	if (Array.isArray(node)) {
		for (const item of node) collectFieldValues(item, keys, out);
	} else if (node && typeof node === 'object') {
		const isPerson = node['@type'] === 'Person';
		for (const [key, value] of Object.entries(node)) {
			if (keys.includes(key) && typeof value === 'string' && !(isPerson && key === 'url')) {
				out.push(value);
			}
			collectFieldValues(value, keys, out);
		}
	}
}

/** Rekurencyjnie zbiera wszystkie węzły `'@type': 'Person'` z bloku JSON-LD. */
function collectPersons(node, out) {
	if (Array.isArray(node)) {
		for (const item of node) collectPersons(item, out);
	} else if (node && typeof node === 'object') {
		if (node['@type'] === 'Person') out.push(node);
		for (const value of Object.values(node)) collectPersons(value, out);
	}
}

/**
 * Wyciąga teksty pytań z pola `faq:` - dopasowanie wzorca YAML `- q: ...`,
 * z opcjonalnym zdjęciem otaczających cudzysłowów. Też proste dopasowanie
 * tekstowe, nie parser YAML - ale niektóre pytania kursu cytują nazwy
 * node'ów/trybów w środku (np. `"Który tryb wybrać - \"All Items\"..."`),
 * więc po zdjęciu zewnętrznych cudzysłowów trzeba też odwrócić escapowanie
 * YAML (`\"` -> `"`, `\\` -> `\`) - inaczej dosłowny znak `\` zostaje
 * w wyciągniętym tekście, mimo że parser YAML (i to, co realnie renderuje
 * Astro) go tam nie zostawia.
 */
function extractFaqQuestions(content) {
	const questions = [];
	const re = /^\s*-\s*q:\s*(.+)$/gm;
	let m;
	while ((m = re.exec(content)) !== null) {
		let q = m[1].trim();
		if (q.startsWith('"') && q.endsWith('"')) {
			q = q.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
		} else if (q.startsWith("'") && q.endsWith("'")) {
			q = q.slice(1, -1);
		}
		questions.push(q);
	}
	return questions;
}

/** Slug pliku źródłowego (nazwa bez rozszerzenia .md/.mdx) - odpowiednik
 * `id` wpisu kolekcji, jaki widzi Head.astro (struktura src/content/docs/
 * jest płaska - bez podfolderów - więc to zawsze ostatni segment ścieżki). */
function slugOfSourceRel(rel) {
	return rel.split('/').pop().replace(/\.(md|mdx)$/, '');
}

assert(existsSync(DIST), 'Brak katalogu dist - uruchom najpierw `npm run build`');

const pages = collectionPages();
const pageData = pages.map((f) => ({ file: f, url: urlOf(f), html: readFileSync(f, 'utf8') }));
const home = pageData.filter((p) => p.url === '/');
const articles = pageData.filter((p) => {
	const slug = firstSegment(p.url);
	return slug !== undefined && isArticleSlug(slug);
});
// Strony pomocnicze: prawne (regulamin, prywatność) + przejściowe ekrany
// Sendy po zapisie/wypisie z newslettera (część z nich `noindex`). To nie są
// "artykuły" kursu i Head.astro świadomie nie generuje dla nich żadnych
// danych strukturalnych (klasyfikacja `isArticle`/`isHome` w Head.astro).
const pomocnicze = pageData.filter((p) => p.url !== '/' && !articles.includes(p));

// Stan źródeł (src/content/docs/) - punkt odniesienia dla asercji relacyjnych
// poniżej. `index.mdx` w katalogu głównym to strona główna; pliki pasujące
// do wzorca sluga modułu/poradnika to artykuły; reszta to strony pomocnicze.
const sourceFiles = sourceDocFiles();
const sourceRel = sourceFiles.map((f) => relative(SRC_DOCS, f).split(sep).join('/'));
const sourceHome = sourceRel.filter((r) => r === 'index.mdx');
const sourceArticles = sourceRel.filter((r) => r !== 'index.mdx' && isArticleSlug(slugOfSourceRel(r)));
const sourcePomocnicze = sourceRel.filter(
	(r) => r !== 'index.mdx' && !isArticleSlug(slugOfSourceRel(r)),
);
// Tylko moduły kursu (bez flagowego poradnika) - liczba syllabusSections
// w Course na stronie głównej musi się z tym zgadzać (patrz buildCourse()
// w src/lib/structured-data.ts, które mapuje `MODULES` 1:1).
const sourceModuleSlugs = sourceRel
	.map(slugOfSourceRel)
	.filter((slug) => MODULE_SLUG_RE.test(slug));

// --- Task 1: harness widzi to, co powinien ---
check('liczba stron w dist odpowiada liczbie plików źródłowych w treści', () => {
	assert(
		pageData.length === sourceFiles.length,
		`źródło: ${sourceFiles.length} plików .md/.mdx, dist: ${pageData.length} stron`,
	);
	return `${pageData.length} stron (źródło: ${sourceFiles.length} plików)`;
});
check('podział na artykuły / strony pomocnicze / stronę główną zgodny ze źródłem', () => {
	assert(
		articles.length === sourceArticles.length,
		`artykuły: źródło ${sourceArticles.length}, dist ${articles.length}`,
	);
	assert(
		pomocnicze.length === sourcePomocnicze.length,
		`strony pomocnicze: źródło ${sourcePomocnicze.length}, dist ${pomocnicze.length}`,
	);
	assert(
		home.length === sourceHome.length,
		`strona główna: źródło ${sourceHome.length}, dist ${home.length}`,
	);
	return `${articles.length}/${pomocnicze.length}/${home.length}`;
});

// --- Task 3: JSON-LD + OG ---
check('strona główna i każdy artykuł mają blok JSON-LD', () => {
	const contentPages = [...home, ...articles];
	const missing = contentPages.filter((p) => jsonLdBlocks(p.html).length === 0);
	assert(missing.length === 0, `bez JSON-LD: ${missing.map((p) => p.url).join(', ')}`);
	return `${contentPages.length}/${contentPages.length}`;
});
check('strony pomocnicze celowo nie mają żadnego bloku JSON-LD', () => {
	// Regresja w drugą stronę: Head.astro generuje dane strukturalne wyłącznie
	// dla `isHome`/`isArticle` (patrz src/components/Head.astro). Gdyby ktoś
	// kiedyś dodał tu połowiczny/zepsuty JSON-LD (np. przez nieuważne
	// rozszerzenie warunku), ta asercja to wychwyci - podobnie jak poprzednia
	// wychwytuje brak JSON-LD tam, gdzie powinien być.
	const bad = pomocnicze.filter((p) => jsonLdBlocks(p.html).length > 0);
	assert(bad.length === 0, `nieoczekiwany JSON-LD: ${bad.map((p) => p.url).join(', ')}`);
	return `0/${pomocnicze.length}`;
});
check('każdy artykuł ma TechArticle', () => {
	const bad = articles.filter((p) => !typesIn(p.html).has('TechArticle'));
	assert(bad.length === 0, `bez TechArticle: ${bad.map((p) => p.url).join(', ')}`);
	return `${articles.length}/${articles.length}`;
});
check('strona główna ma Course z syllabusSections zgodnymi 1:1 ze stronami modułów', () => {
	assert(home.length === 1, `oczekiwano 1 strony głównej, jest ${home.length}`);
	const course = nodesIn(home[0].html).find((n) => n['@type'] === 'Course');
	assert(course, 'brak bloku Course na stronie głównej');
	assert(Array.isArray(course.syllabusSections), 'Course bez pola syllabusSections');

	const moduleUrls = new Set(
		sourceModuleSlugs.map((slug) => `/${slug}`),
	);
	const syllabusUrls = course.syllabusSections.map((s) => new URL(s.url).pathname);
	const missing = syllabusUrls.filter((u) => !moduleUrls.has(u));
	const extra = [...moduleUrls].filter((u) => !syllabusUrls.includes(u));
	assert(
		missing.length === 0 && extra.length === 0 && syllabusUrls.length === moduleUrls.size,
		`sylabus: ${syllabusUrls.length} wpisów, moduły źródłowe: ${moduleUrls.size}` +
			(missing.length ? `; nieznane w sylabusie: ${missing.join(', ')}` : '') +
			(extra.length ? `; brak w sylabusie: ${extra.join(', ')}` : ''),
	);
	return `${syllabusUrls.length}/${moduleUrls.size} sekcji sylabusa zgodnych ze stronami modułów`;
});
check('strona główna ma WebSite i Person', () => {
	const t = typesIn(home[0].html);
	assert(t.has('WebSite'), 'brak WebSite');
	assert(t.has('Person'), 'brak Person');
	return 'WebSite + Person';
});
check('każdy artykuł ma BreadcrumbList', () => {
	const bad = articles.filter((p) => !typesIn(p.html).has('BreadcrumbList'));
	assert(bad.length === 0, `bez BreadcrumbList: ${bad.map((p) => p.url).join(', ')}`);
	return `${articles.length} artykułów`;
});
check('BreadcrumbList: każdy element poza ostatnim ma pole item (wymóg Google)', () => {
	// Google odrzuca cały BreadcrumbList, jeśli którykolwiek ListItem poza
	// ostatnim nie ma `item` (patrz komentarz przy buildBreadcrumbs()
	// w src/lib/structured-data.ts). W kursn8n każda strona artykułu ma
	// jednosegmentowy URL (brak zagnieżdżonych sekcji jak `/sekcja/xxx/`),
	// więc realnie oczekujemy, że WSZYSTKIE elementy mają
	// `item`, ale test celowo sprawdza tylko wymóg Google (poza ostatnim),
	// żeby nie być bardziej restrykcyjny niż trzeba.
	const bad = [];
	for (const p of articles) {
		for (const node of nodesIn(p.html)) {
			if (node['@type'] !== 'BreadcrumbList') continue;
			const items = node.itemListElement ?? [];
			assert(items.length >= 2, `${p.url}: BreadcrumbList z mniej niż 2 elementami`);
			for (let i = 0; i < items.length - 1; i++) {
				if (typeof items[i].item !== 'string' || items[i].item.trim() === '') {
					bad.push(`${p.url} (pozycja ${items[i].position ?? i + 1})`);
				}
			}
		}
	}
	assert(bad.length === 0, `elementy bez item: ${bad.join(', ')}`);
	return `${articles.length} breadcrumbów zgodnych z wymogiem Google`;
});
check('każda strona ma og:image i twitter:image', () => {
	const bad = pageData.filter(
		(p) => !p.html.includes('property="og:image"') || !p.html.includes('name="twitter:image"')
	);
	assert(bad.length === 0, `bez obrazu OG: ${bad.map((p) => p.url).join(', ')}`);
	return `${pageData.length}/${pageData.length}`;
});

// --- Task 4: FAQ ---
const sourceFaqCount = sourceFiles.filter((f) => hasFaqField(readFileSync(f, 'utf8'))).length;

check('liczba stron z blokiem FAQPage odpowiada liczbie plików z polem faq: w frontmatterze', () => {
	const withFaq = pageData.filter((p) => typesIn(p.html).has('FAQPage'));
	assert(
		withFaq.length === sourceFaqCount,
		`źródło: ${sourceFaqCount} plików z faq:, dist: ${withFaq.length} bloków FAQPage`,
	);
	return `${withFaq.length}/${sourceFaqCount}`;
});

// Uwaga: `faqHidden` (src/content.config.ts) to mechanizm ukrywania
// wygenerowanej sekcji "Częste pytania" przy zachowaniu bloku FAQPage
// (przydatny, gdy artykuł sam w sobie jest FAQ). Żaden plik w kursn8n
// obecnie z niego nie korzysta (0 wystąpień - sprawdzone), więc test
// poniżej nie potrzebuje żadnego wyjątku dla strony samej będącej FAQ.
// Gdyby kiedyś jakiś artykuł kursu ustawił `faqHidden: true`, ta asercja
// słusznie zacznie failować - trzeba będzie dopisać analogiczny wyjątek.
check('FAQPage zawsze towarzyszy widocznej sekcji "Częste pytania"', () => {
	const withFaq = pageData.filter((p) => typesIn(p.html).has('FAQPage'));
	const bad = withFaq.filter((p) => !p.html.includes('Częste pytania'));
	assert(bad.length === 0, `JSON-LD bez widocznej treści: ${bad.map((p) => p.url).join(', ')}`);
	return `${withFaq.length}/${withFaq.length}`;
});
check('brak sekcji FAQ na stronach bez FAQPage', () => {
	const bad = pageData.filter(
		(p) => !typesIn(p.html).has('FAQPage') && p.html.includes('Częste pytania')
	);
	assert(bad.length === 0, `pusta sekcja FAQ: ${bad.map((p) => p.url).join(', ')}`);
	return 'brak pustych sekcji';
});

// --- Task 5: obrazy OG ---
check('obraz OG istnieje dla każdej strony', () => {
	const bad = [];
	for (const p of pageData) {
		const m = p.html.match(/property="og:image" content="([^"]+)"/);
		if (!m) { bad.push(`${p.url} (brak znacznika)`); continue; }
		const file = join(DIST, new URL(m[1]).pathname);
		if (!existsSync(file)) bad.push(`${p.url} -> ${m[1]}`);
	}
	assert(bad.length === 0, `brakujące pliki: ${bad.join(', ')}`);
	return `${pageData.length} obrazów`;
});

// --- Task 6: sitemap ---
// Sitemapa zawiera strony INDEKSOWALNE - nie wszystkie strony w dist. Strony
// z `noindex` (przejściowe ekrany Sendy) są świadomie wykluczone filtrem w
// sitemap() (astro.config.mjs): sitemapa mówiłaby "zaindeksuj", a meta robots
// "nie indeksuj" - sprzeczny sygnał. Stara sitemapa też ich nie zawierała.
const indexablePages = pageData.filter(
	(p) => !/<meta name="robots" content="noindex/i.test(p.html),
);
check('sitemap zawiera tyle URL-i, ile stron indeksowalnych (bez noindex)', () => {
	const xml = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
	const n = (xml.match(/<loc>/g) || []).length;
	assert(
		n === indexablePages.length,
		`oczekiwano ${indexablePages.length} (indeksowalnych z ${pageData.length} stron), jest ${n}`,
	);
	return `${n} URL-i (bez ${pageData.length - indexablePages.length} stron noindex)`;
});
check('żadna strona noindex nie trafiła do sitemapy', () => {
	const xml = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
	const leaked = pageData
		.filter((p) => !indexablePages.includes(p))
		.filter((p) => xml.includes(`<loc>${SITE_URL}${p.url === '/' ? '/' : p.url}</loc>`));
	assert(leaked.length === 0, `noindex w sitemapie: ${leaked.map((p) => p.url).join(', ')}`);
	return `${pageData.length - indexablePages.length} stron noindex poza sitemapą`;
});
check('sitemap ma lastmod dla każdej strony albo potwierdzony płytki klon', () => {
	const xml = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
	const n = (xml.match(/<lastmod>/g) || []).length;
	assert(
		n === indexablePages.length || n === 0,
		`częściowy lastmod (${n}/${indexablePages.length}) - mapa git jest niespójna`,
	);
	return n === 0 ? 'pominięte (brak historii git)' : `${n} wpisów`;
});
check('sitemap rozróżnia priorytety', () => {
	const xml = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
	// Priorytety wg serialize() w astro.config.mjs: 1.0 strona główna,
	// 0.9 flagowy poradnik (GUIDE_SLUG), 0.8 wszystko inne (moduły + strony
	// pomocnicze). @astrojs/sitemap serializuje 1.0 jako "1.0", nie jako "1"
	// (zweryfikowane w dist/sitemap-0.xml).
	assert(xml.includes('<priority>1.0</priority>'), 'brak priorytetu 1.0 dla strony głównej');
	assert(xml.includes('<priority>0.9</priority>'), 'brak priorytetu 0.9 dla flagowego poradnika');
	assert(xml.includes('<priority>0.8</priority>'), 'brak priorytetu 0.8 dla pozostałych stron');
	return '1.0 / 0.9 / 0.8';
});

// --- Task 7: zawartość bloków JSON-LD, nie tylko ich obecność ---
// Poprzednie asercje sprawdzały wyłącznie `@type` - blok mógłby mieć
// całkowicie połamane dane (zły host, zgubiony/dodany ukośnik, puste imię
// autora) i wszystko pozostałoby zielone. Te trzy asercje zaglądają do treści.
check('pola url/item/mainEntityOfPage w JSON-LD są absolutne, bez końcowego ukośnika poza korzeniem', () => {
	// trailingSlash: 'never' (astro.config.mjs) - jedyny wyjątek to korzeń
	// domeny, który zostaje z ukośnikiem (patrz JSDoc absoluteUrl() w
	// src/lib/structured-data.ts).
	const URL_FIELD_KEYS = ['url', 'item', 'mainEntityOfPage'];
	const ROOT = `${SITE_URL}/`;
	const bad = [];
	for (const p of pageData) {
		for (const block of jsonLdBlocks(p.html)) {
			const values = [];
			collectFieldValues(block, URL_FIELD_KEYS, values);
			for (const v of values) {
				if (!v.startsWith(ROOT)) { bad.push(`${p.url}: ${v} (poza SITE_URL)`); continue; }
				if (v !== ROOT && v.endsWith('/')) bad.push(`${p.url}: ${v} (końcowy ukośnik)`);
			}
		}
	}
	assert(bad.length === 0, `nieprawidłowe adresy: ${bad.join(', ')}`);
	return 'wszystkie adresy zaczynają się od SITE_URL; bez ukośnika poza korzeniem';
});
check('encja autora (Person) ma niepuste pole name wszędzie, gdzie występuje', () => {
	const bad = [];
	for (const p of pageData) {
		for (const block of jsonLdBlocks(p.html)) {
			const persons = [];
			collectPersons(block, persons);
			for (const person of persons) {
				if (typeof person.name !== 'string' || person.name.trim() === '') bad.push(p.url);
			}
		}
	}
	assert(bad.length === 0, `puste pole name w encji Person: ${bad.join(', ')}`);
	return 'wszystkie encje Person mają niepuste name';
});
check('każde pytanie z faq: w źródle występuje w widocznej treści HTML swojego artykułu', () => {
	// Uogólnienie: zamiast jednej szczególnej strony-FAQ sprawdzamy
	// KAŻDY artykuł z polem faq:, czyli realnie wszystkie 10 artykułów kursu.
	const withFaqSource = sourceFiles.filter((f) => hasFaqField(readFileSync(f, 'utf8')));
	assert(withFaqSource.length > 0, 'żaden plik źródłowy nie ma pola faq:');

	const missing = [];
	let totalQuestions = 0;
	for (const f of withFaqSource) {
		const content = readFileSync(f, 'utf8');
		const questions = extractFaqQuestions(content);
		if (questions.length === 0) {
			missing.push(`${f}: brak wyekstrahowanych pytań mimo pola faq:`);
			continue;
		}
		totalQuestions += questions.length;

		const rel = relative(SRC_DOCS, f).split(sep).join('/');
		const slug = slugOfSourceRel(rel);
		const url = slug === 'index' ? '/' : `/${slug}`;
		const page = pageData.find((p) => p.url === url);
		if (!page) { missing.push(`${url}: strona nie znaleziona w dist`); continue; }

		const visible = normalizeForMatch(visibleText(page.html));
		for (const q of questions) {
			if (!visible.includes(normalizeForMatch(q))) missing.push(`${url}: "${q}"`);
		}
	}
	assert(
		missing.length === 0,
		`pytania nieobecne w widocznej treści (poza JSON-LD): ${missing.join(' | ')}`,
	);
	return `${totalQuestions}/${totalQuestions} pytań widocznych w HTML (${withFaqSource.length} artykułów)`;
});

// --- raport ---
let failed = 0;
for (const r of results) {
	if (!r.ok) failed++;
	console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` - ${r.detail}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} asercji przeszło`);
process.exit(failed > 0 ? 1 : 0);
