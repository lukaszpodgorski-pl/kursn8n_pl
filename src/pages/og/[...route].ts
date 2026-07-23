import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';

const entries = await getCollection('docs');

// Klucz mapy staje się segmentem trasy: /og/<id>.png
// Strona główna ma w kolekcji surowy identyfikator 'index' (plik
// src/content/docs/index.mdx) - inny niż `route.id` z Astro.locals.starlightRoute
// używany w Head.astro, który Starlight normalizuje dla strony głównej do
// pustego łańcucha. Odfiltrowujemy oba warianty, żeby nie generować
// nieużywanego obrazu dla strony głównej - Head.astro i tak używa dla niej
// statycznego og-default.png.
const pages = Object.fromEntries(
	entries.filter((entry) => entry.id !== '' && entry.id !== 'index').map((entry) => [entry.id, entry.data]),
);

// OGImageRoute jest funkcją async - bez `await` destrukturyzacja łapie
// właściwości z obietnicy (undefined), a nie z jej rozwiązanej wartości.
// Nazwa parametru trasy (`route`) wynika z nazwy pliku `[...route].ts` -
// biblioteka wykrywa ją sama z `routePattern`, więc nie przyjmuje jej jako opcji.
export const { getStaticPaths, GET } = await OGImageRoute({
	pages,
	getImageOptions: (_path, page: (typeof pages)[string]) => ({
		title: page.title,
		description: page.description ?? 'Darmowy kurs automatyzacji w n8n po polsku',
		// CanvasKit dekoduje tylko formaty rastrowe (PNG/JPEG/WebP), nie SVG -
		// favicon.svg jest wcześniej zrasteryzowany do public/og-logo.png (144x144).
		// Znak niesie WŁASNE, w pełni nieprzezroczyste tło (#111114, wypalone w
		// rastrze - sprawdzone piksel po pikselu), więc jako samodzielna plakietka
		// czyta się tak samo na jasnej karcie, jak na poprzedniej ciemnej - nie
		// zależy od koloru tła karty. Po każdej zmianie favicon.svg trzeba
		// zregenerować og-logo.png.
		logo: { path: './public/og-logo.png', size: [72, 72] },
		// Jasna karta, spójna z public/og-default.png (karta strony głównej) -
		// ten sam papier #FAFAF7 co token marki. Płaski kolor (oba końce
		// gradientu identyczne) zamiast gradientu, tak jak w og-default.png
		// (zweryfikowane próbkowaniem pikseli: jednolite rgb(250,250,247)
		// w całym kadrze, bez przejścia).
		bgGradient: [
			[250, 250, 247],
			[250, 250, 247],
		],
		border: { color: [55, 140, 207], width: 16, side: 'inline-start' },
		padding: 70,
		// Domyślny font Noto Sans w astro-og-canvas ładuje wyłącznie podzbiór
		// "latin" (bez ą, ę, ł, ż) - polskie znaki renderowały się jako puste
		// kwadraty (tofu). Podzbiory Fontsource "latin" + "latin-ext" łączone
		// razem w jednym FontMgr wyglądałyby na rozwiązanie, ale w praktyce
		// psują dokładnie te same cztery litery (błąd CanvasKit przy scalaniu
		// dwóch plików pod tą samą nazwą rodziny czcionek - sprawdzone
		// empirycznie). Zamiast tego używamy jednego pełnego pliku Noto Sans
		// (source Google Fonts, bez podziału na podzbiory), który pokrywa
		// łacinę podstawową i rozszerzoną w jednym foncie - patrz
		// src/pages/og/_fonts/OFL.txt co do licencji. Plik jest
		// zsubsetowany do faktycznie używanego zakresu znaków (podstawowa
		// łacina + polskie diakrytyki + cyfry + interpunkcja) - font
		// wciąż wariabilny (wght/wdth), więc dobór wagi Bold/Normal
		// poniżej działa tak samo jak przed subsetowaniem. Katalog nosi
		// prefiks podkreślenia (`_fonts`) - to udokumentowany mechanizm
		// Astro, który bezwarunkowo wyklucza ścieżkę z routingu, więc
		// plik nie może przypadkiem stać się trasą.
		fonts: ['./src/pages/og/_fonts/noto-sans-full.ttf'],
		// Ciemny atrament na jasnym papierze (odwrotność poprzedniej, ciemnej
		// karty) - te same tokeny marki co reszta serwisu: tytuł #111114
		// (atrament), opis #6b7280 (szary), akcent w `border` powyżej #378CCF.
		font: {
			title: { size: 64, weight: 'Bold', color: [17, 17, 20], lineHeight: 1.2 },
			description: { size: 30, weight: 'Normal', color: [107, 114, 128], lineHeight: 1.4 },
		},
	}),
});
