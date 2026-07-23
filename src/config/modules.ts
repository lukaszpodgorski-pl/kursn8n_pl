/**
 * Dziewięć modułów kursu w kolejności nauki.
 * Źródło prawdy dla menu bocznego (astro.config.mjs), kanału RSS
 * i danych strukturalnych Course. Odpowiednik $MENU_MODULES
 * ze starego public_html/config.php.
 */
export interface CourseModule {
	readonly slug: string;
	readonly number: string;
	readonly label: string;
	readonly description: string;
}

export const MODULES: ReadonlyArray<CourseModule> = [
	{
		slug: 'modul-0-fundamenty',
		number: '0',
		label: 'Fundamenty',
		description: 'Czym jest n8n, porównanie z Make/Zapier, licencja i słownik pojęć.',
	},
	{
		slug: 'modul-1-instalacja-hosting',
		number: '1',
		label: 'Instalacja i hosting',
		description: 'Gdzie i jak postawić n8n: Cloud, Docker, Raspberry Pi, VPS i PaaS.',
	},
	{
		slug: 'modul-2-interfejs-pierwszy-workflow',
		number: '2',
		label: 'Interfejs i 1. workflow',
		description: 'Interfejs n8n i budowa pierwszego działającego workflow krok po kroku.',
	},
	{
		slug: 'modul-3-praca-z-danymi',
		number: '3',
		label: 'Praca z danymi',
		description: 'Items, wyrażenia, Set, IF/Switch, pętle, Merge i pliki binarne.',
	},
	{
		slug: 'modul-4-integracje-api',
		number: '4',
		label: 'Integracje i API',
		description: "Node'y aplikacji, OAuth2, HTTP Request, webhooki i limity zapytań.",
	},
	{
		slug: 'modul-5-kod-sub-workflow',
		number: '5',
		label: 'Kod i sub-workflow',
		description: 'Code Node (JS/Python), dane statyczne, sub-workflow i obsługa błędów.',
	},
	{
		slug: 'modul-6-ai-agenci',
		number: '6',
		label: 'AI i agenci',
		description: 'AI Agent, modele OpenAI/Anthropic/Ollama, RAG i chatboty na własnych danych.',
	},
	{
		slug: 'modul-7-produkcja',
		number: '7',
		label: 'Produkcja',
		description: 'Bezpieczeństwo, RODO, backupy 3-2-1, monitoring i tryb kolejkowy.',
	},
	{
		slug: 'modul-8-wzorce-wdrozenia',
		number: '8',
		label: 'Wzorce i wdrożenia',
		description: 'Biblioteka workflow, wzorce projektowe, case studies i antywzorce.',
	},
];

/** Szybkie sprawdzenie, czy slug jest modułem kursu (klasyfikacja w Head.astro). */
export const MODULE_SLUGS: ReadonlySet<string> = new Set(MODULES.map((m) => m.slug));

/** Flagowy poradnik - poza listą modułów, ale traktowany jak artykuł. */
export const GUIDE_SLUG = 'porownanie-n8n-hostingow';
