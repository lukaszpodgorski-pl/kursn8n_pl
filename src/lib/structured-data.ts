/**
 * Czyste funkcje budujące obiekty JSON-LD. Zero API Astro - dzięki temu
 * dają się wywołać i sprawdzić bez uruchamiania frameworka.
 */
import { MODULES } from '../config/modules';

export const SITE_URL = 'https://kursn8n.pl';
export const SITE_NAME = 'KursN8N.pl';
const LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/';

// Dane autora przepisane 1:1 z kanonicznego grafu encji
// (public_html/includes/entity-graph.php, wezel #person) - te same URL-e
// sameAs co na pozostalych domenach autora, wlacznie z 'https://przewodnikai.pl'
// (inna, prawdziwa domena tego samego autora - sameAs wlasnie sluzy do tego,
// zeby wyszukiwarka polaczyla ja z tym wezlem encji, nie jest to wyciek marki).
export const AUTHOR = {
	'@type': 'Person',
	name: 'Łukasz Podgórski',
	url: 'https://lukaszpodgorski.pl/',
	sameAs: [
		'https://youtube.com/@lukaszpodgorski',
		'https://linkedin.com/in/podgorski-lukasz',
		'https://instagram.com/lukaszpodgorski_pl',
		'https://aitomate.pl',
		'https://przewodnikai.pl',
		'https://kursn8n.pl',
		'https://szanujczas.pl',
		'https://myeye.pl',
		'https://github.com/lukaszpodgorski-pl',
	],
} as const;

export interface ThingRef {
	name: string;
	sameAs: string;
	type?: string;
}

export interface FaqItem {
	q: string;
	a: string;
}

export interface BasicInput {
	pathname: string;
	title: string;
	description?: string;
	image?: string;
}

export interface ArticleInput extends BasicInput {
	dateModified?: Date;
	datePublished?: Date;
	educationalLevel?: string;
	teaches?: string[];
	about?: ThingRef[];
	mentions?: ThingRef[];
}

/**
 * Składa absolutny URL z podanej ścieżki. Nie dokłada ani nie usuwa
 * końcowego ukośnika - to odpowiedzialność wywołującego (trailingSlash: 'never',
 * patrz astro.config.mjs). Jedyny wyjątek w całym pliku to korzeń domeny
 * ('/'), który zostaje z ukośnikiem - tak samo jak w starej sitemapie
 * (public_html/sitemap.xml: `<loc>https://kursn8n.pl/</loc>`).
 */
export function absoluteUrl(pathname: string): string {
	return new URL(pathname, SITE_URL).href;
}

function toThing(ref: ThingRef) {
	return { '@type': ref.type ?? 'Thing', name: ref.name, sameAs: ref.sameAs };
}

/** Dokłada klucz tylko gdy wartość jest niepusta - unika pustych pól w JSON-LD. */
function withOptional<T extends object>(base: T, extras: Record<string, unknown>): T {
	const out: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(extras)) {
		if (value === undefined || value === null) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		out[key] = value;
	}
	return out as T;
}

interface Crumb {
	name: string;
	item?: string;
}

export function buildBreadcrumbs(pathname: string, title: string) {
	const segments = pathname.split('/').filter(Boolean);
	const items: Crumb[] = [{ name: 'Strona główna', item: absoluteUrl('/') }];

	// Sekcje (podstawy, prompt-engineering, etyka itd.) celowo nie dostają
	// własnego wpisu w breadcrumbie. Nie chodzi tylko o brak strony indeksowej
	// (kolidowałaby z 301 w _redirects) - Google wymaga pola `item` we
	// wszystkich elementach `ListItem` poza ostatnim, a dla sekcji nie ma
	// żadnego realnego URL-a, na który można by to pole wskazać. Wpis bez
	// `item` jest zgodny ze schema.org, ale Google i tak odrzuca cały
	// `BreadcrumbList`, więc bezpieczniej pominąć sekcję niż emitować
	// niekompletny element. Dla `sciezki/` ten problem nie występuje -
	// `/sciezki/` to prawdziwa strona z własnym `item`, więc zostaje.
	if (segments.length > 1 && segments[0] === 'sciezki') {
		items.push({ name: 'Ścieżki nauki', item: absoluteUrl('/sciezki') });
	}

	items.push({ name: title, item: absoluteUrl(pathname) });

	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((entry, index) =>
			withOptional(
				{ '@type': 'ListItem', position: index + 1, name: entry.name },
				{ item: entry.item },
			),
		),
	};
}

export function buildArticle(input: ArticleInput) {
	return withOptional(
		{
			'@context': 'https://schema.org',
			'@type': 'TechArticle',
			headline: input.title,
			url: absoluteUrl(input.pathname),
			mainEntityOfPage: absoluteUrl(input.pathname),
			inLanguage: 'pl-PL',
			license: LICENSE,
			isAccessibleForFree: true,
			author: AUTHOR,
			publisher: AUTHOR,
			// Nie jest opcjonalne per-strona - kazdy modul jest czescia tego
			// samego kursu, wiec w przeciwienstwie do reszty tego obiektu nie
			// przechodzi przez `withOptional` (nie zalezy od wejscia wywolujacego).
			// Nazwa/URL spojne z Course budowanym w buildCourse() ponizej.
			isPartOf: {
				'@type': 'Course',
				name: 'Kurs automatyzacji w n8n',
				url: absoluteUrl('/'),
			},
		},
		{
			description: input.description,
			image: input.image,
			dateModified: input.dateModified?.toISOString(),
			datePublished: input.datePublished?.toISOString(),
			educationalLevel: input.educationalLevel,
			teaches: input.teaches,
			about: input.about?.map(toThing),
			mentions: input.mentions?.map(toThing),
		},
	);
}

/**
 * Course dla strony glownej - lista 9 modulow z rejestru.
 * Odpowiednik bloku Course z dawnego content/home.head.php.
 */
export function buildCourse() {
	return {
		'@context': 'https://schema.org',
		'@type': 'Course',
		name: 'Kurs automatyzacji w n8n',
		description:
			'Darmowy kurs automatyzacji w n8n po polsku - od podstaw po wdrożenia produkcyjne.',
		// absoluteUrl('/'), nie goly SITE_URL - strona glowna to jedyny
		// wyjatek od "bez koncowego ukosnika" w tym pliku (patrz JSDoc absoluteUrl).
		url: absoluteUrl('/'),
		inLanguage: 'pl-PL',
		isAccessibleForFree: true,
		provider: {
			'@type': 'Person',
			name: AUTHOR.name,
			url: AUTHOR.url,
		},
		hasCourseInstance: {
			'@type': 'CourseInstance',
			courseMode: 'online',
			courseWorkload: 'PT10H',
		},
		syllabusSections: MODULES.map((m, i) => ({
			'@type': 'Syllabus',
			position: i + 1,
			name: `Moduł ${m.number}: ${m.label}`,
			description: m.description,
			// Bez koncowego ukosnika - zywa strona i stara sitemapa (public_html/sitemap.xml)
			// adresuja moduly jako np. /modul-0-fundamenty, zgodnie z trailingSlash: 'never'.
			url: absoluteUrl(`/${m.slug}`),
		})),
	};
}

export function buildWebSite() {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebSite',
				name: SITE_NAME,
				url: absoluteUrl('/'),
				inLanguage: 'pl-PL',
				license: LICENSE,
				publisher: AUTHOR,
			},
			AUTHOR,
		],
	};
}

export function buildFaqPage(items: FaqItem[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((item) => ({
			'@type': 'Question',
			name: item.q,
			acceptedAnswer: { '@type': 'Answer', text: item.a },
		})),
	};
}
