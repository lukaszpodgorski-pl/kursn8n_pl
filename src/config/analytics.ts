/**
 * Konfiguracja analityki i warstwy zgody - jedyne zrodlo prawdy.
 *
 * GTM_ID i GA4_ID sa identyfikatorami publicznymi: widac je w zrodle kazdej
 * strony, ktora je laduje. Dlatego siedza wprost tutaj, a nie w `.env` ani
 * w `E:\secrets`. Sekretem jest dostep do panelu, nie numer kontenera.
 *
 * CONSENT_VERSION podbijamy przy KAZDEJ zmianie zakresu przetwarzania (nowy
 * odbiorca danych, nowa kategoria, nowy cel). Zapisana decyzja ze starszym `v`
 * jest traktowana jak brak decyzji, wiec baner pyta ponownie - to realizacja
 * art. 7 ust. 1 RODO, ktory kaze umiec wykazac zgode na AKTUALNY zakres.
 */

/** Kontener Google Tag Manager, konto `aitomate Lukasz Podgorski`. */
export const GTM_ID = 'GTM-WWZKTTGJ';

/**
 * Identyfikator pomiaru GA4 - WSPOLNA usluga calego ekosystemu (513311833),
 * nie osobna usluga per domena.
 *
 * Powod jest arytmetyczny, nie estetyczny, i pochodzi z decyzji D1 w
 * `e:\projects_www\analityka-wdrozenie-runbook.md`: lista remarketingowa w
 * Google Ads potrzebuje 100 uzytkownikow do sieci reklamowej i 1000 do YouTube
 * i RLSA. Przy kilkunastu aktywnych uzytkownikach na domene tylko wspolna pula
 * kiedykolwiek przekroczy prog - osobne uslugi per domena to gwarancja, ze
 * zadna lista nie ruszy.
 *
 * Cena tej decyzji: raporty trzeba filtrowac po wymiarze `brand`, a nie
 * otwierac na czysto. Dlatego BRAND ponizej jest obowiazkowy w kazdym zdarzeniu.
 *
 * UWAGA: sam serwis nie uzywa tej stalej w czasie dzialania - identyfikator
 * siedzi w zmiennej `const - GA4 ID` w kontenerze GTM. Tu jest po to, zeby dalo
 * sie odczytac z repo, dokad leca dane, bez logowania do panelu. Zmiana tutaj
 * NIE zmienia pomiaru; trzeba ja powtorzyc w GTM.
 */
export const GA4_ID = 'G-VZJFZDE6X0';

/**
 * Marka w ramach wspolnej uslugi GA4. Trafia do kazdego zdarzenia jako
 * parametr `brand` i to ona rozdziela kursn8n.pl od pozostalych domen
 * w raportach.
 */
export const BRAND = 'kursn8n';

/** Wersja zakresu przetwarzania. Podbicie = ponowne pytanie wszystkich. */
export const CONSENT_VERSION = 1;

/** Klucz w localStorage. Prefiks `kn8n-` odroznia od kluczy Starlighta. */
export const CONSENT_STORAGE_KEY = 'kn8n-consent';

/** Decyzja uzytkownika w formie, w jakiej podaje ja baner. */
export type ConsentChoice = {
	analytics: boolean;
	marketing: boolean;
};

/** Decyzja zapisana w localStorage, z wersja i znacznikiem czasu. */
export type StoredConsent = ConsentChoice & {
	v: number;
	ts: string;
};
