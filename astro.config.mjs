// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';
import sitemap from '@astrojs/sitemap';
import { lastModMap } from './scripts/sitemap-lastmod.mjs';
import { forceLightTheme } from './scripts/force-light-theme.mjs';
import { MODULES, GUIDE_SLUG } from './src/config/modules';

const GITHUB_REPO = 'https://github.com/lukaszpodgorski-pl/kursn8n_pl';

// Mapa liczona raz, na starcie builda - nie per URL.
const LAST_MOD = lastModMap();

// https://astro.build/config
export default defineConfig({
	site: 'https://kursn8n.pl',
	// Adresy zywej strony sa bez koncowego ukosnika - zachowujemy je co do znaku.
	trailingSlash: 'never',
	// Wylaczone: domyslny smartypants zamienia proste cudzyslowy/dywizy na
	// typograficzne warianty angielskie ("..." -> "..."), lamiac wymog projektu
	// (cudzyslowy proste, pauza to zwykly dywiz) w wyrenderowanej tresci.
	markdown: {
		smartypants: false,
	},
	integrations: [
		starlight({
			title: 'KursN8N.pl',
			description:
				'Otwarta wiki i darmowy kurs automatyzacji w n8n po polsku - od podstaw po wdrożenia produkcyjne.',
			customCss: ['./src/styles/tokens.css', './src/styles/kursn8n.css'],
			components: {
				Footer: './src/components/Footer.astro',
				Head: './src/components/Head.astro',
				MarkdownContent: './src/components/MarkdownContent.astro',
				// Jasny motyw jako domyslny (zamiast podazania za preferencja
				// systemowa) - patrz komentarze w obu plikach.
				ThemeProvider: './src/components/ThemeProvider.astro',
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
			locales: {
				root: { label: 'Polski', lang: 'pl' },
			},
			social: [{ icon: 'github', label: 'GitHub', href: GITHUB_REPO }],
			editLink: {
				baseUrl: `${GITHUB_REPO}/edit/main/`,
			},
			lastUpdated: true,
			plugins: [starlightLlmsTxt()],
			// Plaska struktura plikow wyklucza `autogenerate` - sidebar budujemy
			// wprost z rejestru modulow (src/config/modules.ts).
			sidebar: [
				{
					label: 'Program kursu',
					items: MODULES.map((m) => ({
						label: `${m.number}. ${m.label}`,
						link: `/${m.slug}`,
					})),
				},
				{
					label: 'Materiały dodatkowe',
					items: [{ label: 'Porównanie hostingów n8n', link: `/${GUIDE_SLUG}` }],
				},
				{
					label: 'Informacje',
					items: [
						{ label: 'Regulamin', link: '/regulamin' },
						{ label: 'Prywatność i cookies', link: '/prywatnosc' },
					],
				},
			],
		}),
		sitemap({
			changefreq: 'weekly',
			// Strony powrotne Sendy sa `noindex` (transakcyjne, nie tresc) - nie
			// moga trafic do sitemapy, bo sitemapa mowilaby "zaindeksuj", a meta
			// robots "nie indeksuj". Stara sitemapa (public_html/sitemap.xml) tez
			// ich nie zawierala - trzymamy parytet 13 adresow.
			filter: (page) =>
				!['/zapisano', '/potwierdz-email', '/juz-zapisany', '/wypisano'].includes(
					new URL(page).pathname.replace(/\/$/, ''),
				),
			serialize(item) {
				const { pathname } = new URL(item.url);
				const lastmod = LAST_MOD.get(pathname);
				if (lastmod) item.lastmod = lastmod;
				if (pathname === '/') item.priority = 1.0;
				else if (pathname === `/${GUIDE_SLUG}`) item.priority = 0.9;
				else item.priority = 0.8;
				return item;
			},
		}),
		// Nadpisania ThemeProvider/ThemeSelect powyzej naprawiaja motyw domyslny
		// PO wykonaniu JS w przegladarce, ale nie maja wplywu na surowy HTML -
		// Page.astro Starlighta renderuje data-theme="dark" na sztywno i nie da
		// sie go nadpisac przez `components:` (nie jest czescia tego schematu).
		// Ta integracja poprawia to na wyjsciu builda - patrz komentarz w
		// scripts/force-light-theme.mjs.
		forceLightTheme(),
	],
	vite: {
		build: {
			rolldownOptions: {
				// `satteri` (Astro's markdown parser) tries to load its wasm32-wasi
				// fallback binary when Vite resolves the "prerender" environment with
				// browser-like conditions (as Cloudflare's build does). That optional
				// dependency is gated on `cpu: ["wasm32"]` in its package.json, which
				// npm never matches on any real host, so it's never installed and the
				// bundler can't resolve it. It's unused in this code path, so mark it
				// external instead of bundling it.
				external: ['@bruits/satteri-wasm32-wasi'],
			},
		},
	},
});
