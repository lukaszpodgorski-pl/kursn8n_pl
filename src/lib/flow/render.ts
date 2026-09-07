import { iconClass } from './icons.ts';
import { layoutFlow, type Box, type EdgePath, type Layout } from './layout.ts';
import type { FlowGraph } from './parse.ts';
import { resolveTone } from './tokens.ts';

export interface FlowMeta {
	title: string;
	alt: string;
	/** Rozroznia markery strzalek - identyfikatory SVG sa globalne w dokumencie. */
	uid: string;
}

const esc = (text: string): string =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

/** FNV-1a - krotki, stabilny identyfikator liczony z tresci diagramu. */
export function hashSpec(spec: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < spec.length; i += 1) {
		hash ^= spec.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(36);
}

function renderNode(box: Box): string {
	const { node } = box;
	const tone = resolveTone(node.tone, node.line);
	const sub = node.sub ? `<div class="k-node-sub">${esc(node.sub)}</div>` : '';

	return (
		`<div class="k-node" style="left:${box.x}px;top:${box.y}px;width:${box.w}px">` +
		`<div class="k-node-ic" style="--c1:${tone.from};--c2:${tone.to}">` +
		`<i aria-hidden="true" class="${iconClass(node.icon)}"></i></div>` +
		`<div class="k-node-tx"><div class="k-node-label">${esc(node.name)}</div>${sub}</div>` +
		'</div>'
	);
}

function renderEdge(path: EdgePath, uid: string): string {
	const line =
		`<path class="k-edge k-edge-${path.kind}" d="${path.d}" ` +
		`marker-end="url(#k-arrow-${uid})" />`;
	if (!path.label) return line;

	const w = Math.round(path.label.length * 6.1 + 12);
	return (
		line +
		`<g class="k-edge-label"><rect x="${path.lx - w / 2}" y="${path.ly - 9}" ` +
		`width="${w}" height="18" rx="5" /><text x="${path.lx}" y="${path.ly + 4}">` +
		`${esc(path.label)}</text></g>`
	);
}

function renderStage(layout: Layout, variant: 'lr' | 'tb', uid: string): string {
	const marker =
		`<defs><marker id="k-arrow-${uid}" viewBox="0 0 8 8" refX="7" refY="4" ` +
		'markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
		'<path d="M0,0 L8,4 L0,8 z" /></marker></defs>';

	return (
		`<div class="k-flow-stage k-flow-${variant}" aria-hidden="true" ` +
		`style="width:${layout.width}px;height:${layout.height}px">` +
		`<svg class="k-flow-edges" viewBox="0 0 ${layout.width} ${layout.height}" ` +
		`width="${layout.width}" height="${layout.height}" aria-hidden="true">${marker}` +
		layout.paths.map((path) => renderEdge(path, uid)).join('') +
		'</svg>' +
		layout.boxes.map(renderNode).join('') +
		'</div>'
	);
}

export function renderFlow(graph: FlowGraph, meta: FlowMeta): string {
	// Oba uklady lecza do HTML, przelacza je media query. Skalowanie jednego
	// przez viewBox dawaloby na telefonie font rzedu 5 px.
	const lr = renderStage(layoutFlow(graph, 'lr'), 'lr', `${meta.uid}-lr`);
	const tb = renderStage(layoutFlow(graph, 'tb'), 'tb', `${meta.uid}-tb`);

	return (
		`<div class="k-flow not-content" role="img" aria-label="${esc(meta.alt)}">` +
		'<div class="k-flow-bar" aria-hidden="true">' +
		'<span class="k-d k-r"></span><span class="k-d k-y"></span><span class="k-d k-g"></span>' +
		`<span class="k-flow-title">${esc(meta.title)}</span></div>` +
		lr +
		tb +
		'</div>'
	);
}
