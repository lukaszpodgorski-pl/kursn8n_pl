import { FlowError } from './error.ts';

export type EdgeKind = 'main' | 'loop' | 'ai';

export interface FlowNodeSpec {
	/** Nazwa jest jednoczesnie identyfikatorem i etykieta - jak w n8n. */
	name: string;
	sub?: string;
	/** Bez prefiksu `fa-`; marki jawnie, np. `fab/slack`. */
	icon?: string;
	/** Nazwa tonu albo para hexow `#aabbcc/#ddeeff`. */
	tone?: string;
	line: number;
}

export interface FlowEdgeSpec {
	from: string;
	to: string;
	kind: EdgeKind;
	label?: string;
	line: number;
}

export interface FlowGraph {
	nodes: FlowNodeSpec[];
	edges: FlowEdgeSpec[];
}

/**
 * Strzalka MUSI byc otoczona bialymi znakami. Bez tego `Sub-workflow -> X`
 * czytaloby sie jako krawedz z etykieta "workflow": dywiz w nazwie zaczynalby
 * wzorzec `-etykieta->`.
 */
const ARROW = /\s+(->|~>|<-|-[^->]+->)\s+/;

/**
 * Nazwa albo w cudzyslowie (wtedy dowolne znaki), albo bez `:`, `@`, nawiasow
 * i cudzyslowu. Podtytul lapiemy zachlannie do OSTATNIEGO `)`, zeby zagniezdzony
 * nawias w podtytule ("kolejka zadan (Bull)") nie urwal sie w polowie.
 */
const NODE =
	/^(?:"([^"]+)"|([^:@()"]+?))\s*(?:\((.*)\))?\s*(?::([A-Za-z0-9/-]+))?\s*(?:@(#[0-9a-fA-F]{6}\/#[0-9a-fA-F]{6}|[a-z]+))?$/;

interface ParsedNode {
	name: string;
	sub?: string;
	icon?: string;
	tone?: string;
}

function parseNodeToken(token: string, line: number, source: string): ParsedNode {
	const match = NODE.exec(token.trim());
	if (!match) {
		throw new FlowError(
			`Nie rozumiem zapisu noda "${token.trim()}". Oczekiwany ksztalt: ` +
				'Nazwa (podtytul):ikona @ton - kazdy czlon poza nazwa jest opcjonalny.',
			line,
			source
		);
	}

	const name = (match[1] ?? match[2] ?? '').trim();

	return {
		name,
		sub: match[3]?.trim() || undefined,
		icon: match[4],
		tone: match[5],
	};
}

/** Rozdziela liste sub-nodow po przecinku, nie tnac wewnatrz cudzyslowu ani nawiasu. */
function splitTargets(text: string): string[] {
	const out: string[] = [];
	let current = '';
	let quoted = false;
	let depth = 0;

	for (const char of text) {
		if (char === '"') quoted = !quoted;
		if (!quoted && char === '(') depth += 1;
		if (!quoted && char === ')' && depth > 0) depth -= 1;
		if (char === ',' && !quoted && depth === 0) {
			out.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	out.push(current);

	return out.map((part) => part.trim()).filter((part) => part !== '');
}

export function parseFlow(spec: string): FlowGraph {
	const nodes = new Map<string, FlowNodeSpec>();
	const edges: FlowEdgeSpec[] = [];

	const declare = (parsed: ParsedNode, line: number, source: string): string => {
		const existing = nodes.get(parsed.name);
		const carries =
			parsed.sub !== undefined || parsed.icon !== undefined || parsed.tone !== undefined;

		if (!existing) {
			nodes.set(parsed.name, { ...parsed, line });
			return parsed.name;
		}

		if (!carries) return parsed.name;

		const described =
			existing.sub !== undefined || existing.icon !== undefined || existing.tone !== undefined;
		if (described) {
			throw new FlowError(
				`Nod "${parsed.name}" ma juz atrybuty z linii ${existing.line}. Kolejne wystapienia ` +
					'podaj sama nazwa - inaczej ten sam nod moglby dostac dwa rozne wyglady.',
				line,
				source
			);
		}

		// Nod byl dotad wymieniony sama nazwa - dopiero ta wzmianka go opisuje.
		nodes.set(parsed.name, { ...parsed, line });
		return parsed.name;
	};

	spec.split('\n').forEach((raw, index) => {
		const line = index + 1;
		const text = raw.trim();
		if (text === '' || text.startsWith('#')) return;

		const arrow = ARROW.exec(raw);
		if (!arrow) {
			declare(parseNodeToken(text, line, raw), line, raw);
			return;
		}

		const left = raw.slice(0, arrow.index);
		const right = raw.slice(arrow.index + arrow[0].length);
		if (ARROW.test(right)) {
			throw new FlowError(
				'Dwie strzalki w jednej linii - kazda krawedz zapisujemy w osobnej linii.',
				line,
				raw
			);
		}

		const token = arrow[1];
		const from = declare(parseNodeToken(left, line, raw), line, raw);

		if (token === '<-') {
			for (const target of splitTargets(right)) {
				const to = declare(parseNodeToken(target, line, raw), line, raw);
				edges.push({ from, to, kind: 'ai', line });
			}
			return;
		}

		const to = declare(parseNodeToken(right, line, raw), line, raw);
		const kind: EdgeKind = token === '~>' ? 'loop' : 'main';
		const label = token.startsWith('-') && token !== '->' ? token.slice(1, -2) : undefined;
		edges.push({ from, to, kind, label, line });
	});

	return { nodes: [...nodes.values()], edges };
}
