import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import {
	MODULES,
	GUIDE_SLUG,
	QUICK_WINS,
	QUICK_WINS_HUB_SLUG,
	TROUBLESHOOTING_SLUG,
	GLOSSARY_SLUG,
} from '../config/modules';

/**
 * Kanal RSS 2.0 - odpowiednik dawnego public_html/partials/feed.php.
 * Pozycje (najnowsze na gorze): gotowe workflow (rosna z rejestru QUICK_WINS)
 * + troubleshooting + slownik pojec + hub gotowcow, potem poradnik
 * hostingowy + 9 modulow kursu - zasilane z jednego rejestru
 * src/config/modules.ts (to samo zrodlo co sidebar i dane strukturalne Course).
 *
 * Adresy pozycji BEZ koncowego ukosnika - zgodnie z trailingSlash: 'never'
 * i stara sitemapa. `site` z astro.config.mjs dostarcza bazowy URL.
 */

// Data publikacji przepisana ze starego feed.php (2026-05-21 09:00).
const PUB_DATE = new Date('2026-05-21T09:00:00Z');

// Data publikacji sekcji gotowcow i troubleshootingu.
const NEW_CONTENT_PUB_DATE = new Date('2026-07-24T09:00:00Z');

export async function GET(context: APIContext) {
	const site = context.site ?? new URL('https://kursn8n.pl');

	const items = [
		...QUICK_WINS.map((w) => ({
			title: `Gotowy workflow: ${w.label}`,
			link: new URL(`/${w.slug}`, site).href,
			description: w.description,
			pubDate: NEW_CONTENT_PUB_DATE,
		})),
		{
			title: 'Coś nie działa? Typowe problemy z n8n i jak je naprawić',
			link: new URL(`/${TROUBLESHOOTING_SLUG}`, site).href,
			description:
				'Typowe awarie n8n: webhook milczy na produkcji, OAuth zwraca redirect_uri_mismatch, zgubiony klucz szyfrowania, 502 za reverse proxy. Objaw, przyczyna, naprawa.',
			pubDate: NEW_CONTENT_PUB_DATE,
		},
		{
			title: 'Gotowe workflow do pobrania - ucz się wdrażając',
			link: new URL(`/${QUICK_WINS_HUB_SLUG}`, site).href,
			description:
				'Gotowe workflow n8n do pobrania: JSON do importu i budowa krok po kroku dla każdego gotowca. Sprawdź na karcie, po którym module kursu jesteś gotowy go wdrożyć.',
			pubDate: NEW_CONTENT_PUB_DATE,
		},
		{
			title: 'Słownik pojęć n8n - od workflow po RAG',
			link: new URL(`/${GLOSSARY_SLUG}`, site).href,
			description:
				'Słownik pojęć n8n po polsku: workflow, node, trigger, execution, credentials, webhook, wyrażenia, AI Agent i RAG - zwięzłe definicje z linkami do kursu.',
			pubDate: NEW_CONTENT_PUB_DATE,
		},
		{
			title: 'Porównanie hostingów n8n - kompletny poradnik 2026',
			link: new URL(`/${GUIDE_SLUG}`, site).href,
			description:
				'Siedem ścieżek hostingu n8n: bezpieczeństwo, RODO, ceny, backupy i katalog testów do samodzielnego powtórzenia.',
			pubDate: PUB_DATE,
		},
		...MODULES.map((m) => ({
			title: `Moduł ${m.number}: ${m.label}`,
			link: new URL(`/${m.slug}`, site).href,
			description: m.description,
			pubDate: PUB_DATE,
		})),
	];

	return rss({
		title: 'KursN8N.pl - nowe materiały',
		description:
			'Otwarta wiki i darmowy kurs automatyzacji n8n po polsku - nowe moduły, poradniki i gotowe workflow.',
		site,
		items,
		customData: '<language>pl-pl</language>',
	});
}
