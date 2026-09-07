import fs from 'node:fs';
import path from 'node:path';

/**
 * Jednorazowa migracja diagramow z <FlowNode> na props `spec`. Zostaje w repo
 * jako zapis tego, co i dlaczego sie stalo. Wszystkie 20 istniejacych diagramow
 * jest liniowych, wiec kazdy zamienia sie w prosty lancuch A -> B -> C.
 */

const DOCS = 'src/content/docs';

const TONES = new Map([
	['#16a34a|#15803d', 'green'],
	['#2563eb|#1e40af', 'blue'],
	['#ea4b71|#6d28d9', 'pink'],
	['#64748b|#475569', 'slate'],
	['#0ea5e9|#0369a1', 'sky'],
	['#d97706|#b45309', 'amber'],
	['#dc2626|#b91c1c', 'red'],
	['#6d28d9|#4c1d95', 'violet'],
]);

const attr = (source, name) => {
	const match = new RegExp(`${name}="([^"]*)"`).exec(source);
	return match ? match[1] : undefined;
};

// Nawias, dwukropek, malpa i cudzyslow maja w DSL swoje znaczenie.
const quoteName = (label) => (/[:@()"]/.test(label) ? `"${label}"` : label);

const unknown = [];

function nodeToken(source, file) {
	const label = attr(source, 'label');
	const sub = attr(source, 'sub');
	const icon = attr(source, 'icon');
	const family = attr(source, 'family');
	const from = attr(source, 'from');
	const to = attr(source, 'to');

	let token = quoteName(label);
	if (sub) token += ` (${sub})`;
	if (icon) token += `:${family === 'fab' ? 'fab/' : ''}${icon.replace(/^fa-/, '')}`;

	const tone = TONES.get(`${from}|${to}`);
	if (tone) token += ` @${tone}`;
	else if (from && to) {
		token += ` @${from}/${to}`;
		unknown.push(`${file}: ${label} -> ${from}/${to}`);
	}

	return token;
}

function migrateBlock(block, file) {
	const title = attr(block, 'title');
	const alt = attr(block, 'alt');
	const caption = attr(block, 'caption');

	const nodes = [...block.matchAll(/<FlowNode\b[^>]*\/>/g)].map((m) => m[0]);
	const tokens = nodes.map((node) => nodeToken(node, file));
	const names = nodes.map((node) => quoteName(attr(node, 'label')));

	const lines = tokens
		.slice(0, -1)
		.map((token, index) => `    ${index === 0 ? token : names[index]} -> ${tokens[index + 1]}`);

	const head = [`  title="${title}"`, `  alt="${alt}"`];
	if (caption) head.push(`  caption="${caption}"`);

	return `<Flow\n${head.join('\n')}\n  spec={\`\n${lines.join('\n')}\n  \`}\n/>`;
}

let changed = 0;

for (const name of fs.readdirSync(DOCS).filter((f) => f.endsWith('.mdx'))) {
	const file = path.join(DOCS, name);
	const source = fs.readFileSync(file, 'utf8');
	if (!source.includes('<FlowNode')) continue;

	let output = source.replace(/<Flow\b[\s\S]*?<\/Flow>/g, (block) => {
		changed += 1;
		return migrateBlock(block, name);
	});

	// Import FlowNode zostaje bez uzytkownika - usuwamy cala linie.
	output = output.replace(/^import FlowNode from '[^']*';\r?\n/m, '');

	// Cale repo trzyma CRLF (patrz CLAUDE.md), a szablony w migrateBlock licza
	// nowe linie znakiem \n. Bez tej normalizacji nowo wstawiony blok <Flow>
	// mialby LF w pliku, ktory wszedzie indziej ma CRLF - konczyny linii
	// istniejacego pliku nie moga sie zmienic.
	output = output.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

	fs.writeFileSync(file, output, 'utf8');
	console.log(`zmigrowano: ${file}`);
}

console.log(`\nblokow przepisanych: ${changed}`);
if (unknown.length > 0) {
	console.log('\nTONY SPOZA PALETY - do recznego przejrzenia:');
	for (const entry of unknown) console.log(`  ${entry}`);
} else {
	console.log('wszystkie kolory trafily w palete');
}
