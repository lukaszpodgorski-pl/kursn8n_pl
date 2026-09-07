import { FlowError } from './error.ts';
import type { EdgeKind, FlowEdgeSpec, FlowGraph, FlowNodeSpec } from './parse.ts';

export type Direction = 'lr' | 'tb';

export interface Box {
	node: FlowNodeSpec;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface EdgePath {
	d: string;
	kind: EdgeKind;
	label?: string;
	/** Srodek sciezki - tam siada etykieta krawedzi. */
	lx: number;
	ly: number;
}

export interface Layout {
	boxes: Box[];
	paths: EdgePath[];
	width: number;
	height: number;
}

export const NODE_H = 52;
export const NODE_MIN_W = 120;
export const NODE_MAX_W = 320;

// Ikona 34 + odstep 10 + padding 2 x 14 + obramowanie 2.
const CHROME_W = 74;
// Szerokosc znaku przy 13 px/700 i 11 px/400 w foncie strony. Wartosci sa
// szacunkiem z gornej strony - lepiej kafelek troche za szeroki niz przyciety.
const LABEL_CH = 7.5;
const SUB_CH = 6.1;

const LAYER_GAP_LR = 64;
const LAYER_GAP_TB = 48;
const TRACK_GAP = 24;
const AI_GAP = 56;
const AI_SIBLING_GAP = 16;
const PAD = 22;

interface Cubic {
	x1: number;
	y1: number;
	cx1: number;
	cy1: number;
	cx2: number;
	cy2: number;
	x2: number;
	y2: number;
}

const toPath = (c: Cubic): string =>
	`M ${c.x1} ${c.y1} C ${c.cx1} ${c.cy1}, ${c.cx2} ${c.cy2}, ${c.x2} ${c.y2}`;

/** Punkt B(0,5) krzywej szescienej - srodek sciezki dla etykiety. */
const midOf = (c: Cubic): { x: number; y: number } => ({
	x: Math.round((c.x1 + 3 * c.cx1 + 3 * c.cx2 + c.x2) / 8),
	y: Math.round((c.y1 + 3 * c.cy1 + 3 * c.cy2 + c.y2) / 8),
});

export function nodeWidth(node: FlowNodeSpec): number {
	const label = node.name.length * LABEL_CH;
	const sub = (node.sub?.length ?? 0) * SUB_CH;
	const raw = Math.max(NODE_MIN_W, CHROME_W + Math.max(label, sub));
	const width = Math.ceil(raw / 4) * 4;

	if (width > NODE_MAX_W) {
		throw new FlowError(
			`Kafelek noda "${node.name}" wyszedl ${width} px, a limit to ${NODE_MAX_W} px. ` +
				'Skroc etykiete albo podtytul - dluzszy tekst i tak przestaje sie czytac na telefonie.',
			node.line
		);
	}
	return width;
}

function assertConnected(graph: FlowGraph): void {
	if (graph.nodes.length === 0) return;

	const neighbours = new Map<string, string[]>();
	for (const node of graph.nodes) neighbours.set(node.name, []);
	for (const edge of graph.edges) {
		neighbours.get(edge.from)!.push(edge.to);
		neighbours.get(edge.to)!.push(edge.from);
	}

	const seen = new Set<string>([graph.nodes[0].name]);
	const queue = [graph.nodes[0].name];
	while (queue.length > 0) {
		for (const next of neighbours.get(queue.shift()!)!) {
			if (seen.has(next)) continue;
			seen.add(next);
			queue.push(next);
		}
	}

	const orphans = graph.nodes.filter((node) => !seen.has(node.name));
	if (orphans.length > 0) {
		throw new FlowError(
			`Diagram rozpada sie na dwa niepolaczone kawalki - poza glownym przeplywem zostaly: ` +
				`${orphans.map((n) => `"${n.name}"`).join(', ')}. Najczestsza przyczyna to literowka ` +
				'w nazwie (pierwsza wzmianka o nazwie tworzy nowy nod). Jesli to celowo dwa niezalezne ' +
				'przeplywy, narysuj je jako dwa osobne <Flow>.',
			orphans[0].line
		);
	}
}

function layerNodes(graph: FlowGraph, aiChildren: Set<string>): Map<string, number> {
	const main = graph.edges.filter((e) => e.kind === 'main');
	const flow = graph.nodes.filter((n) => !aiChildren.has(n.name));

	const indegree = new Map<string, number>();
	const layer = new Map<string, number>();
	for (const node of flow) {
		indegree.set(node.name, 0);
		layer.set(node.name, 0);
	}
	for (const edge of main) {
		if (indegree.has(edge.to)) indegree.set(edge.to, indegree.get(edge.to)! + 1);
	}

	const queue = flow.filter((n) => indegree.get(n.name) === 0).map((n) => n.name);
	let settled = 0;

	while (queue.length > 0) {
		const name = queue.shift()!;
		settled += 1;
		for (const edge of main.filter((e) => e.from === name && indegree.has(e.to))) {
			layer.set(edge.to, Math.max(layer.get(edge.to)!, layer.get(name)! + 1));
			const left = indegree.get(edge.to)! - 1;
			indegree.set(edge.to, left);
			if (left === 0) queue.push(edge.to);
		}
	}

	if (settled !== flow.length) {
		const stuck = flow.filter((n) => (indegree.get(n.name) ?? 0) > 0).map((n) => `"${n.name}"`);
		throw new FlowError(
			`Cykl w krawedziach "->": ${stuck.join(', ')}. Petla wraca strzalka "~>", ktora ` +
				'jest rysowana lukiem i nie bierze udzialu w ukladaniu kolumn.'
		);
	}

	return layer;
}

export function layoutFlow(graph: FlowGraph, dir: Direction): Layout {
	assertConnected(graph);

	const aiEdges = graph.edges.filter((e) => e.kind === 'ai');
	const aiChildren = new Set(aiEdges.map((e) => e.to));
	const layer = layerNodes(graph, aiChildren);

	const width = new Map<string, number>();
	for (const node of graph.nodes) width.set(node.name, nodeWidth(node));

	// Tory w kolejnosci pierwszego wystapienia - autor steruje ukladem kolejnoscia linii.
	const tracks = new Map<number, FlowNodeSpec[]>();
	for (const node of graph.nodes) {
		if (aiChildren.has(node.name)) continue;
		const index = layer.get(node.name)!;
		if (!tracks.has(index)) tracks.set(index, []);
		tracks.get(index)!.push(node);
	}

	const layers = [...tracks.keys()].sort((a, b) => a - b);
	const maxTrack = Math.max(...layers.map((index) => tracks.get(index)!.length));
	const step = NODE_H + TRACK_GAP;
	const boxes: Box[] = [];
	const byName = new Map<string, Box>();

	if (dir === 'lr') {
		let x = PAD;
		for (const index of layers) {
			const column = tracks.get(index)!;
			const columnW = Math.max(...column.map((n) => width.get(n.name)!));
			const offset = ((maxTrack - column.length) * step) / 2;
			column.forEach((node, track) => {
				const box: Box = {
					node,
					x,
					y: Math.round(PAD + offset + track * step),
					w: width.get(node.name)!,
					h: NODE_H,
				};
				boxes.push(box);
				byName.set(node.name, box);
			});
			x += columnW + LAYER_GAP_LR;
		}
	} else {
		const rowStep = NODE_H + LAYER_GAP_TB;
		const widest = Math.max(
			...layers.map((index) => {
				const row = tracks.get(index)!;
				return (
					row.reduce((sum, n) => sum + width.get(n.name)!, 0) + (row.length - 1) * TRACK_GAP
				);
			})
		);
		layers.forEach((index, rowIndex) => {
			const row = tracks.get(index)!;
			const rowW =
				row.reduce((sum, n) => sum + width.get(n.name)!, 0) + (row.length - 1) * TRACK_GAP;
			let x = Math.round(PAD + (widest - rowW) / 2);
			for (const node of row) {
				const box: Box = {
					node,
					x,
					y: PAD + rowIndex * rowStep,
					w: width.get(node.name)!,
					h: NODE_H,
				};
				boxes.push(box);
				byName.set(node.name, box);
				x += box.w + TRACK_GAP;
			}
		});
	}

	// Sub-nody AI wisza przy rodzicu, poza siatka warstw - tak jak w edytorze n8n.
	const childrenOf = new Map<string, FlowNodeSpec[]>();
	for (const edge of aiEdges) {
		const child = graph.nodes.find((n) => n.name === edge.to)!;
		if (!childrenOf.has(edge.from)) childrenOf.set(edge.from, []);
		childrenOf.get(edge.from)!.push(child);
	}

	for (const [parentName, children] of childrenOf) {
		const parent = byName.get(parentName)!;
		let cursor = dir === 'lr' ? parent.x : parent.y;
		for (const child of children) {
			const w = width.get(child.name)!;
			const box: Box =
				dir === 'lr'
					? { node: child, x: cursor, y: parent.y + NODE_H + AI_GAP, w, h: NODE_H }
					: { node: child, x: parent.x + parent.w + AI_GAP, y: cursor, w, h: NODE_H };
			boxes.push(box);
			byName.set(child.name, box);
			cursor += (dir === 'lr' ? w : NODE_H) + AI_SIBLING_GAP;
		}
	}

	// Luk petli w ukladzie pionowym idzie w LEWO od kolumny, a .k-flow ma
	// overflow: hidden - bez tego marginesu polowa luku zostalaby przycieta.
	const hasLoop = graph.edges.some((e) => e.kind === 'loop');
	if (dir === 'tb' && hasLoop) {
		for (const box of boxes) box.x += 48;
	}

	const bottom = Math.max(...boxes.map((b) => b.y + b.h));
	const left = Math.min(...boxes.map((b) => b.x));

	const paths: EdgePath[] = graph.edges.map((edge) => cubicFor(edge, byName, dir, bottom, left));

	return {
		boxes,
		paths,
		width: Math.max(...boxes.map((b) => b.x + b.w)) + PAD,
		height: bottom + PAD + (hasLoop && dir === 'lr' ? 48 : 0),
	};
}

function cubicFor(
	edge: FlowEdgeSpec,
	byName: Map<string, Box>,
	dir: Direction,
	bottom: number,
	left: number
): EdgePath {
	const a = byName.get(edge.from)!;
	const b = byName.get(edge.to)!;
	let cubic: Cubic;

	if (edge.kind === 'loop') {
		if (dir === 'lr') {
			const k = bottom - Math.min(a.y, b.y) + 40;
			cubic = {
				x1: a.x + a.w / 2, y1: a.y + a.h,
				cx1: a.x + a.w / 2, cy1: a.y + a.h + k,
				cx2: b.x + b.w / 2, cy2: b.y + b.h + k,
				x2: b.x + b.w / 2, y2: b.y + b.h,
			};
		} else {
			const k = Math.max(a.x, b.x) - left + 40;
			cubic = {
				x1: a.x, y1: a.y + a.h / 2,
				cx1: a.x - k, cy1: a.y + a.h / 2,
				cx2: b.x - k, cy2: b.y + b.h / 2,
				x2: b.x, y2: b.y + b.h / 2,
			};
		}
	} else if (edge.kind === 'ai') {
		cubic =
			dir === 'lr'
				? {
						x1: a.x + a.w / 2, y1: a.y + a.h,
						cx1: a.x + a.w / 2, cy1: a.y + a.h + 24,
						cx2: b.x + b.w / 2, cy2: b.y - 24,
						x2: b.x + b.w / 2, y2: b.y,
					}
				: {
						x1: a.x + a.w, y1: a.y + a.h / 2,
						cx1: a.x + a.w + 24, cy1: a.y + a.h / 2,
						cx2: b.x - 24, cy2: b.y + b.h / 2,
						x2: b.x, y2: b.y + b.h / 2,
					};
	} else if (dir === 'lr') {
		const d = Math.max(24, (b.x - (a.x + a.w)) / 2);
		cubic = {
			x1: a.x + a.w, y1: a.y + a.h / 2,
			cx1: a.x + a.w + d, cy1: a.y + a.h / 2,
			cx2: b.x - d, cy2: b.y + b.h / 2,
			x2: b.x, y2: b.y + b.h / 2,
		};
	} else {
		const d = Math.max(24, (b.y - (a.y + a.h)) / 2);
		cubic = {
			x1: a.x + a.w / 2, y1: a.y + a.h,
			cx1: a.x + a.w / 2, cy1: a.y + a.h + d,
			cx2: b.x + b.w / 2, cy2: b.y - d,
			x2: b.x + b.w / 2, y2: b.y,
		};
	}

	const mid = midOf(cubic);
	return { d: toPath(cubic), kind: edge.kind, label: edge.label, lx: mid.x, ly: mid.y };
}
