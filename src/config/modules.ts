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

/**
 * Gotowe workflow (quick winy) - opisane automatyzacje do pobrania i wdrożenia.
 * Zasilają sekcję "Gotowe workflow" w sidebarze, kanał RSS i kartę
 * "Umiesz już dość" w NextModule.astro.
 */
export interface QuickWin {
	readonly slug: string;
	readonly label: string;
	readonly description: string;
	/** Numer modułu, po którym czytelnik jest gotowy wdrożyć ten workflow. */
	readonly afterModule: number;
}

export const QUICK_WINS: ReadonlyArray<QuickWin> = [
	{
		slug: 'workflow-poranny-brief-telegram',
		label: 'Poranny brief na Telegram',
		description:
			'Codziennie o 7:00 dostajesz na Telegramie krótki brief pogodowy - bez otwierania osobnej aplikacji.',
		afterModule: 2,
	},
	{
		slug: 'workflow-monitor-ceny-produktu',
		label: 'Monitor ceny produktu',
		description:
			'n8n pilnuje ceny produktu za Ciebie i alarmuje na Telegramie, gdy spadnie poniżej Twojego progu.',
		afterModule: 3,
	},
	{
		slug: 'workflow-faktury-gmail-drive',
		label: 'Faktury z Gmaila na Google Drive',
		description:
			'Załączniki faktur z Gmaila lądują automatycznie w uporządkowanym folderze na Google Drive.',
		afterModule: 4,
	},
	{
		slug: 'workflow-formularz-arkusz-powiadomienie',
		label: 'Formularz → arkusz + powiadomienie',
		description:
			'Zgłoszenia z formularza trafiają prosto do arkusza Google, a Ty dostajesz natychmiastowe powiadomienie na Telegramie o każdym nowym zgłoszeniu.',
		afterModule: 5,
	},
	{
		slug: 'workflow-rss-podsumowanie-ai',
		label: 'RSS → podsumowanie AI',
		description:
			'Raz dziennie n8n czyta Twój branżowy kanał RSS i wysyła na Telegram krótkie podsumowanie nowych wpisów przygotowane przez AI.',
		afterModule: 6,
	},
	{
		slug: 'workflow-notatka-glosowa-notion',
		label: 'Notatka głosowa → Notion',
		description:
			'Nagrywasz notatkę głosową na Telegramie, a jej transkrypcja automatycznie ląduje jako nowa strona w Twojej bazie Notion.',
		afterModule: 6,
	},
	{
		slug: 'workflow-backup-n8n-github',
		label: 'Backup workflow do GitHuba',
		description:
			'Co noc n8n eksportuje wszystkie Twoje workflow do repozytorium GitHub, więc zawsze masz pod ręką pełną historię zmian.',
		afterModule: 7,
	},
];

/** Strona-hub sekcji gotowych workflow. */
export const QUICK_WINS_HUB_SLUG = 'gotowe-workflow';

/** Strona troubleshootingu "Coś nie działa". */
export const TROUBLESHOOTING_SLUG = 'cos-nie-dziala';

/** Rozszerzony słownik pojęć n8n (poza krótkim słowniczkiem w Module 0). */
export const GLOSSARY_SLUG = 'slownik-pojec';

/**
 * Wszystkie slugi traktowane jak artykuły (TechArticle + BreadcrumbList +
 * obraz OG per strona) - klasyfikacja w Head.astro. Odpowiednik po stronie
 * harnessu: isArticleSlug() w scripts/verify-geo.mjs (tam wzorce, nie import -
 * patrz komentarz w tamtym pliku).
 */
export const ARTICLE_SLUGS: ReadonlySet<string> = new Set([
	...MODULES.map((m) => m.slug),
	GUIDE_SLUG,
	QUICK_WINS_HUB_SLUG,
	TROUBLESHOOTING_SLUG,
	GLOSSARY_SLUG,
	...QUICK_WINS.map((w) => w.slug),
]);
