import {
	GLOSSARY_SLUG,
	GUIDE_SLUG,
	MODULE_SLUGS,
	QUICK_WINS,
	QUICK_WINS_HUB_SLUG,
	TROUBLESHOOTING_SLUG,
} from '../config/modules';

/**
 * Kontekst strony dla warstwy danych - `page_type` w rozumieniu etapu D3
 * runbooka analityki.
 *
 * Liczony z rejestru w `src/config/modules.ts`, nie z osobnej listy. Dzieki
 * temu nowy modul albo nowy gotowiec dopisany do rejestru klasyfikuje sie tu
 * sam, tak samo jak robi to juz klasyfikacja artykulow w `Head.astro`.
 */

const QUICK_WIN_SLUGS: ReadonlySet<string> = new Set(QUICK_WINS.map((w) => w.slug));

/** Strony prawne - male, zamkniete zbiory, nie ma ich w rejestrze modulow. */
const LEGAL_SLUGS: ReadonlySet<string> = new Set(['regulamin', 'prywatnosc']);

/**
 * Strony powrotne Sendy. Pelna lista i znaczenie kazdej: `src/config/newsletter.ts`.
 * Tutaj potrzebny jest tylko fakt, ze naleza do lejka newslettera.
 */
const NEWSLETTER_SLUGS: ReadonlySet<string> = new Set([
	'potwierdz-email',
	'zapisano',
	'juz-zapisany',
	'wypisano',
	'blad-zapisu',
	'brak-zgody',
	'zgoda-potwierdzona',
]);

export function pageType(pathname: string): string {
	const slug = pathname.split('/').filter(Boolean)[0];
	if (slug === undefined) return 'home';
	if (MODULE_SLUGS.has(slug)) return 'modul';
	if (slug === GUIDE_SLUG) return 'poradnik';
	if (slug === QUICK_WINS_HUB_SLUG) return 'hub-workflow';
	if (QUICK_WIN_SLUGS.has(slug)) return 'workflow';
	if (slug === TROUBLESHOOTING_SLUG) return 'troubleshooting';
	if (slug === GLOSSARY_SLUG) return 'slownik';
	if (LEGAL_SLUGS.has(slug)) return 'prawne';
	if (NEWSLETTER_SLUGS.has(slug)) return 'newsletter';
	return 'inna';
}

/**
 * Zdarzenie lejka newslettera dla stron powrotnych Sendy, albo `null`.
 *
 * Formularz jest zwyklym POST-em do Sendy z pelnym przeladowaniem strony, wiec
 * zdarzenia NIE da sie sensownie wyslac przy kliknieciu "Zapisz sie" - wyscig
 * z nawigacja gubilby czesc trafien, a policzone bylyby proby, nie zapisy.
 * Dlatego liczymy je tam, gdzie Sendy odsyla po wykonaniu operacji.
 *
 * Double opt-in ma dwa etapy i celowo nie sklejamy ich w jedno zdarzenie:
 * - `newsletter_signup` - formularz przyjety, mail potwierdzajacy wyslany,
 * - `newsletter_confirmed` - czlowiek kliknal link w mailu; to jest realna
 *   konwersja i to ona ma byc zdarzeniem kluczowym w GA4.
 */
export function newsletterEvent(pathname: string): string | null {
	const slug = pathname.split('/').filter(Boolean)[0];
	if (slug === 'potwierdz-email') return 'newsletter_signup';
	if (slug === 'zapisano') return 'newsletter_confirmed';
	if (slug === 'wypisano') return 'newsletter_unsubscribe';
	return null;
}
