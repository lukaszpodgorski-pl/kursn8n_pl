/**
 * Strony powrotne Sendy dla kursn8n.pl - spis, nie konfiguracja runtime.
 *
 * Sendy nie czyta tego pliku. Adresy wpisuje sie recznie w panelu
 * (`edit-list?i=4&l=2` → Subscribe settings / Unsubscribe settings). Ten plik
 * istnieje po to, zeby dalo sie sprawdzic w repo, dokad Sendy ma odsylac,
 * bez logowania do panelu - i zeby przy dodawaniu nowej strony powrotnej
 * bylo widac, ze trzeba ja tam takze wkleic.
 *
 * ID listy i endpoint siedza w `src/components/Newsletter.astro`, bo tylko
 * tam sa realnie uzywane.
 *
 * UWAGA NA UKOSNIK: `astro.config.mjs` ma `trailingSlash: 'never'`, wiec adresy
 * MUSZA byc bez ukosnika na koncu. Z ukosnikiem kazdy powrot lapie dodatkowe
 * przekierowanie 301. (przewodnikai.pl ma odwrotnie - `'always'`.)
 */
export const STRONY_POWROTU = {
	/** Subscribe success page - po wyslaniu formularza (double opt-in: mail wyslany). */
	poZapisie: 'https://kursn8n.pl/potwierdz-email',
	/** Subscription confirmed page - po kliknieciu linku potwierdzajacego. */
	poPotwierdzeniu: 'https://kursn8n.pl/zapisano',
	/** Already subscribed page - adres juz jest na liscie. */
	juzZapisany: 'https://kursn8n.pl/juz-zapisany',
	/** Unsubscribe confirmation page - po wypisaniu sie. */
	poWypisaniu: 'https://kursn8n.pl/wypisano',
	/**
	 * Error page - kazdy nieudany zapis: bledny adres, wygasly lub juz uzyty link
	 * potwierdzajacy, chwilowy problem serwera. Jedna strona na wszystkie te
	 * przypadki, bo z perspektywy czytelnika roznica jest nieistotna - liczy sie
	 * informacja, ze adres NIE trafil na liste i ze wystarczy sprobowac ponownie.
	 */
	blad: 'https://kursn8n.pl/blad-zapisu',
	/**
	 * GDPR consent not given page - czlowiek wyslal formularz bez zaznaczonej zgody.
	 *
	 * Od 2026-08-20 checkbox zgody jest widoczny i niezaznaczony (wczesniej bylo
	 * ukryte pole `gdpr=1`), wiec ten przypadek stal sie realny: mozna swiadomie
	 * odmowic. Bez tej strony Sendy odsyla na wlasna, generyczna stronke.
	 */
	brakZgody: 'https://kursn8n.pl/brak-zgody',
	/**
	 * GDPR reconsent success page - czlowiek potwierdzil zgode po kampanii
	 * wyslanej ze znacznikiem `[reconsent]`.
	 */
	zgodaPotwierdzona: 'https://kursn8n.pl/zgoda-potwierdzona',
} as const;
