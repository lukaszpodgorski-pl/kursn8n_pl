import fs from 'node:fs';
import path from 'node:path';
import { FlowError } from './error.ts';
import type { FlowGraph } from './parse.ts';

// Sciezka do wyswietlania w komunikatach bledow - czytelna, liczona od korzenia repo.
const CSS_PATH = 'public/assets/fa/css/all.min.css';
// Sciezka do faktycznego odczytu - wzgledem tego pliku (import.meta.dirname),
// nie process.cwd(). Build na Cloudflare potrafi wystartowac z innego
// katalogu roboczego niz korzen repo, wiec process.cwd() tam pada.
const CSS_ABS_PATH = path.join(import.meta.dirname, '../../../', CSS_PATH);
const DEFAULT_ICON = 'diagram-project';
const FAMILIES = new Set(['fas', 'far', 'fab']);

let cache: Set<string> | null = null;

/**
 * Nazwy ikon wyciagniete z self-hostowanego Font Awesome. Plik trzyma reguly
 * ksztaltu `.fa-list:before{content:"\f03a"}` wspolne dla solid i brands, wiec
 * sprawdzamy istnienie NAZWY, nie rodziny - to i tak lapie literowke, ktora
 * dzis konczy sie pustym kwadracikiem na stronie.
 */
export function availableIcons(): Set<string> {
	if (cache) return cache;

	const css = fs.readFileSync(CSS_ABS_PATH, 'utf8');
	const names = new Set<string>();
	for (const match of css.matchAll(/\.fa-([a-z0-9-]+):before/g)) names.add(match[1]);

	cache = names;
	return names;
}

function splitIcon(icon: string): [string, string] {
	const slash = icon.indexOf('/');
	return slash === -1 ? ['fas', icon] : [icon.slice(0, slash), icon.slice(slash + 1)];
}

/** Zamienia zapis z DSL na pare klas CSS Font Awesome. */
export function iconClass(icon: string | undefined): string {
	const [family, name] = splitIcon(icon ?? DEFAULT_ICON);
	return `${family} fa-${name}`;
}

/** Przerywa build, gdy ktorykolwiek nod wskazuje ikone, ktorej nie ma. */
export function assertIcons(graph: FlowGraph): void {
	const known = availableIcons();

	for (const node of graph.nodes) {
		if (node.icon === undefined) continue;

		const [family, name] = splitIcon(node.icon);
		if (!FAMILIES.has(family)) {
			throw new FlowError(
				`Nieznana rodzina ikon "${family}" w ":${node.icon}". Dostepne: fas, far, fab.`,
				node.line
			);
		}
		if (!known.has(name)) {
			throw new FlowError(
				`Ikona "fa-${name}" nie istnieje w self-hostowanym Font Awesome ` +
					`(${CSS_PATH}). Sprawdz nazwe na fontawesome.com/search i pamietaj, ze ` +
					'w DSL piszemy ja bez prefiksu "fa-".',
				node.line
			);
		}
	}
}
