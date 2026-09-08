import {
	CONSENT_STORAGE_KEY,
	CONSENT_VERSION,
	GTM_ID,
	type ConsentChoice,
	type StoredConsent,
} from '../config/analytics';

/**
 * Odczyt zapisanej decyzji.
 *
 * Zwraca `null` takze wtedy, gdy decyzja istnieje, ale ma starsza wersje niz
 * CONSENT_VERSION - dla wolajacego to jest to samo co brak decyzji, wiec baner
 * pokaze sie ponownie. `try/catch` jest konieczny: w trybie prywatnym niektore
 * przegladarki rzucaja przy samym dostepie do localStorage.
 */
export function readConsent(): StoredConsent | null {
	try {
		const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<StoredConsent>;
		if (parsed.v !== CONSENT_VERSION) return null;
		if (typeof parsed.analytics !== 'boolean') return null;
		if (typeof parsed.marketing !== 'boolean') return null;
		return parsed as StoredConsent;
	} catch {
		return null;
	}
}

/**
 * Zapis decyzji razem z wersja i znacznikiem czasu.
 *
 * Znacznik czasu nie jest ozdoba - art. 7 ust. 1 RODO wymaga, zeby zgode umiec
 * WYKAZAC, a bez daty nie da sie powiedziec, na jaki stan polityki jej udzielono.
 */
export function writeConsent(choice: ConsentChoice): StoredConsent {
	const stored: StoredConsent = {
		v: CONSENT_VERSION,
		ts: new Date().toISOString(),
		analytics: choice.analytics,
		marketing: choice.marketing,
	};
	try {
		localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored));
	} catch {
		// Brak zapisu (tryb prywatny, brak miejsca) nie moze wywrocic strony.
		// Skutek: baner pokaze sie przy nastepnej wizycie. Akceptowalne.
	}
	return stored;
}

/**
 * Mapowanie decyzji na cztery parametry Consent Mode v2.
 *
 * Kategoria marketingowa steruje trzema parametrami naraz, bo Google rozbija
 * reklamy na przechowywanie, dane uzytkownika i personalizacje. Dla czlowieka
 * przy banerze to jedna decyzja i tak ma zostac - rozbijanie jej na trzy
 * przelaczniki tylko utrudnia zrozumienie, a nie daje realnego wyboru.
 */
export function toSignals(choice: ConsentChoice): Record<string, 'granted' | 'denied'> {
	const analytics = choice.analytics ? 'granted' : 'denied';
	const marketing = choice.marketing ? 'granted' : 'denied';
	return {
		analytics_storage: analytics,
		ad_storage: marketing,
		ad_user_data: marketing,
		ad_personalization: marketing,
	};
}

/**
 * Przekazanie decyzji do warstwy tagow.
 *
 * `gtag` jest zdefiniowany przez bootstrap w <head>, wiec w praktyce zawsze
 * istnieje. Straz jest na wypadek, gdyby ktos wyciol bootstrap - wtedy baner
 * ma dzialac dalej i nie sypac bledami w konsoli.
 */
export function applyConsent(choice: ConsentChoice): void {
	const w = window as unknown as {
		gtag?: (...args: unknown[]) => void;
		dataLayer?: unknown[];
	};
	if (typeof w.gtag !== 'function') return;

	w.gtag('consent', 'update', toSignals(choice));

	w.dataLayer = w.dataLayer || [];
	w.dataLayer.push({ event: 'consent_update' });
	if (choice.analytics) w.dataLayer.push({ event: 'consent_accepted_analytics' });
	if (choice.marketing) w.dataLayer.push({ event: 'consent_accepted_advertising' });
}

/**
 * Zrodlo skryptu wstrzykiwanego synchronicznie w <head>.
 *
 * Dlaczego string, a nie plik: skrypt musi wykonac sie PRZED gtm.js, wiec musi
 * byc inline i synchroniczny, a taki nie zaimportuje modulu. Generujac go
 * funkcja, wstrzykujemy stale z `analytics.ts` w czasie builda i zachowujemy
 * jedno zrodlo prawdy mimo dwoch kontekstow wykonania.
 *
 * KOLEJNOSC W SRODKU JEST WYMOGIEM, NIE STYLISTYKA. Gdyby `consent default`
 * wykonal sie po gtm.js, cookies Google poleca przed zgoda i cala konstrukcja
 * traci sens.
 *
 * Odczyt localStorage jest synchroniczny, wiec powracajacy gosc z udzielona
 * zgoda startuje od razu z `granted` i nie traci pierwszego zdarzenia na cyklu
 * denied -> update.
 */
export function consentBootstrapScript(): string {
	return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

var kn8nConsent = null;
try {
  var raw = localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)});
  if (raw) {
    var parsed = JSON.parse(raw);
    if (parsed && parsed.v === ${CONSENT_VERSION}) kn8nConsent = parsed;
  }
} catch (e) {}

var kn8nAnalytics = kn8nConsent && kn8nConsent.analytics ? 'granted' : 'denied';
var kn8nMarketing = kn8nConsent && kn8nConsent.marketing ? 'granted' : 'denied';

gtag('consent', 'default', {
  analytics_storage: kn8nAnalytics,
  ad_storage: kn8nMarketing,
  ad_user_data: kn8nMarketing,
  ad_personalization: kn8nMarketing,
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});

gtag('set', 'ads_data_redaction', kn8nMarketing === 'denied');
gtag('set', 'url_passthrough', true);

(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(GTM_ID)});
`.trim();
}
