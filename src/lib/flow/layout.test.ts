import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlow } from './parse.ts';
import { layoutFlow, nodeWidth, NODE_H } from './layout.ts';

const boxOf = (layout: ReturnType<typeof layoutFlow>, name: string) =>
	layout.boxes.find((b) => b.node.name === name)!;

test('lancuch uklada sie w jednym torze, kolejne kolumny w prawo', () => {
	const layout = layoutFlow(parseFlow('A -> B\nB -> C'), 'lr');
	assert.equal(layout.boxes.length, 3);
	assert.equal(boxOf(layout, 'A').y, boxOf(layout, 'B').y);
	assert.ok(boxOf(layout, 'A').x < boxOf(layout, 'B').x);
	assert.ok(boxOf(layout, 'B').x < boxOf(layout, 'C').x);
});

test('rozgalezienie rozklada cele na dwa tory w tej samej kolumnie', () => {
	const layout = layoutFlow(parseFlow('IF -true-> Tak\nIF -false-> Nie'), 'lr');
	assert.equal(boxOf(layout, 'Tak').x, boxOf(layout, 'Nie').x);
	assert.notEqual(boxOf(layout, 'Tak').y, boxOf(layout, 'Nie').y);
});

test('zbieganie stawia cel w kolumnie za obydwoma zrodlami', () => {
	const layout = layoutFlow(parseFlow('A -> M\nB -> M\nM -> W'), 'lr');
	assert.ok(boxOf(layout, 'M').x > boxOf(layout, 'A').x);
	assert.ok(boxOf(layout, 'M').x > boxOf(layout, 'B').x);
	assert.equal(boxOf(layout, 'A').x, boxOf(layout, 'B').x);
});

test('krawedz zwrotna nie przesuwa kolumn', () => {
	const prosty = layoutFlow(parseFlow('A -> B'), 'lr');
	const zPetla = layoutFlow(parseFlow('A -> B\nB ~> A'), 'lr');
	assert.equal(boxOf(prosty, 'B').x, boxOf(zPetla, 'B').x);
	assert.equal(zPetla.paths.filter((p) => p.kind === 'loop').length, 1);
});

test('petla w ukladzie pionowym dostaje miejsce na luk', () => {
	const prosty = layoutFlow(parseFlow('A -> B'), 'tb');
	const zPetla = layoutFlow(parseFlow('A -> B\nB ~> A'), 'tb');
	assert.ok(boxOf(zPetla, 'A').x > boxOf(prosty, 'A').x);
});

test('sub-nody AI ida pod rodzica w ukladzie poziomym', () => {
	const layout = layoutFlow(parseFlow('Agent <- Model, Pamiec'), 'lr');
	assert.ok(boxOf(layout, 'Model').y > boxOf(layout, 'Agent').y);
	assert.ok(boxOf(layout, 'Pamiec').x > boxOf(layout, 'Model').x);
	assert.equal(layout.paths.filter((p) => p.kind === 'ai').length, 2);
});

test('sub-nody AI ida obok rodzica w ukladzie pionowym', () => {
	const layout = layoutFlow(parseFlow('Agent <- Model, Pamiec'), 'tb');
	assert.ok(boxOf(layout, 'Model').x > boxOf(layout, 'Agent').x);
	assert.ok(boxOf(layout, 'Pamiec').y > boxOf(layout, 'Model').y);
});

test('uklad pionowy schodzi w dol, nie w prawo', () => {
	const layout = layoutFlow(parseFlow('A -> B\nB -> C'), 'tb');
	assert.ok(boxOf(layout, 'A').y < boxOf(layout, 'B').y);
	assert.equal(boxOf(layout, 'A').x, boxOf(layout, 'B').x);
});

test('etykieta krawedzi ma pozycje w polowie odcinka', () => {
	const layout = layoutFlow(parseFlow('IF -true-> Tak'), 'lr');
	const path = layout.paths[0];
	assert.equal(path.label, 'true');
	assert.ok(path.lx > boxOf(layout, 'IF').x);
	assert.ok(path.lx < boxOf(layout, 'Tak').x + boxOf(layout, 'Tak').w);
});

test('ten sam spec daje identyczny uklad', () => {
	const spec = 'A -> B\nA -> C\nB -> D\nC -> D';
	assert.deepEqual(layoutFlow(parseFlow(spec), 'lr'), layoutFlow(parseFlow(spec), 'lr'));
});

test('cykl w krawedziach main wywraca build z podpowiedzia', () => {
	assert.throws(() => layoutFlow(parseFlow('A -> B\nB -> A'), 'lr'), /~>/);
});

test('rozpadniety graf wywraca build', () => {
	assert.throws(() => layoutFlow(parseFlow('A -> B\nC -> D'), 'lr'), /dwa/);
});

test('szerokosc kafelka rosnie z dluzszym podtytulem', () => {
	const krotki = nodeWidth({ name: 'A', line: 1 });
	const dlugi = nodeWidth({ name: 'A', sub: 'root node - decyduje i orkiestruje', line: 1 });
	assert.ok(dlugi > krotki);
	assert.ok(dlugi <= 320);
});

test('kafelek ma stala wysokosc', () => {
	const layout = layoutFlow(parseFlow('A (dlugi podtytul):list -> B'), 'lr');
	assert.equal(boxOf(layout, 'A').h, NODE_H);
});

test('za dluga etykieta wywraca build', () => {
	assert.throws(
		() => nodeWidth({ name: 'A'.repeat(60), line: 3 }),
		/linia 3/
	);
});

const pointsOf = (d: string): number[][] => {
	const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
	const out: number[][] = [];
	for (let i = 0; i < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
	return out;
};

test('luk petli miesci sie w plotnie takze przy kilku torach', () => {
	const spec = 'A -> B\nA -> C\nA -> D\nB -> M\nC ~> B';
	for (const dir of ['lr', 'tb'] as const) {
		const layout = layoutFlow(parseFlow(spec), dir);
		for (const path of layout.paths) {
			for (const [x, y] of pointsOf(path.d)) {
				assert.ok(x >= 0 && x <= layout.width, `x ${x} poza plotnem (${dir}, ${path.kind})`);
				assert.ok(y >= 0 && y <= layout.height, `y ${y} poza plotnem (${dir}, ${path.kind})`);
			}
		}
	}
});

test('diagram bez nodow wywraca build', () => {
	assert.throws(() => layoutFlow(parseFlow('# tylko komentarz'), 'lr'), /ani jednego noda/);
});
