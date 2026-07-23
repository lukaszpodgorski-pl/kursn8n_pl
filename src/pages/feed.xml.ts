import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { MODULES, GUIDE_SLUG } from '../config/modules';

/**
 * Kanal RSS 2.0 - odpowiednik dawnego public_html/partials/feed.php.
 * Pozycje: flagowy poradnik hostingowy + 9 modulow kursu, zasilane
 * z jednego rejestru src/config/modules.ts (to samo zrodlo co sidebar
 * i dane strukturalne Course).
 *
 * Adresy pozycji BEZ koncowego ukosnika - zgodnie z trailingSlash: 'never'
 * i stara sitemapa. `site` z astro.config.mjs dostarcza bazowy URL.
 */

// Data publikacji przepisana ze starego feed.php (2026-05-21 09:00).
const PUB_DATE = new Date('2026-05-21T09:00:00Z');

export async function GET(context: APIContext) {
	const site = context.site ?? new URL('https://kursn8n.pl');

	const items = [
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
