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

/** Identyfikator pomiaru GA4, usluga `kursn8n.pl` (553021678). */
export const GA4_ID = 'G-HXB91H6WT6';

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
